import { createHash } from "node:crypto";
import { Injectable } from "@nestjs/common";
import type {
  OperationAction,
  OperationCommand,
  OperationReason,
  OperationResult,
  OperatorAccount,
  OperatorAuditEntry,
  OperatorCollection,
} from "@nslinkhub/types";
import { isUUID } from "class-validator";
import { revokeAccountAccess } from "../../auth/revoke-account";
import type { CursorQueryDto } from "../../common/dto/cursor-query.dto";
import { AppException, appError } from "../../common/errors/app-exception";
import type { AuthUser } from "../../common/interfaces/auth-user.interface";
import type { RequestWithId } from "../../common/middleware/request-id";
import { decodeCursor, encodeCursor } from "../../common/utils/cursor.util";
import { readSecret } from "../../config/secret";
import { authorityContext } from "../../database/authority-context";
import { PrismaService } from "../../database/prisma.service";
import type { Prisma } from "../../generated/prisma/client";
import { CollectionPolicyService } from "../hubs/collection-policy.service";
import type { AuditQueryDto } from "./operations.dto";

export type OperatorRequest = RequestWithId & { user: AuthUser };
const reasons: Record<OperationAction, readonly OperationReason[]> = {
  "account.suspend": ["spam", "harmful_content", "account_compromise", "owner_request"],
  "account.reactivate": ["mistake_corrected", "review_completed", "owner_request"],
  "sessions.revoke": ["account_compromise", "owner_request", "access_administration"],
  "collection.hold": ["spam", "harmful_content", "owner_request"],
  "collection.release": ["mistake_corrected", "review_completed", "owner_request"],
};
@Injectable()
export class OperationsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly policy: CollectionPolicyService,
  ) {}

  async run<T>(
    req: OperatorRequest,
    mutation: boolean,
    work: () => Promise<T>,
    capability: "operator" | "admin" | "account" = "operator",
  ): Promise<T> {
    // Operations owns its transaction, including audited denials. Nest's ordinary
    // mutation interceptor deliberately excludes this module.
    const result = await this.prisma.withAuthority(async () => {
      const actor = req.user;
      const session =
        actor.sessionId &&
        (await this.prisma.session.findFirst({
          where: {
            id: actor.sessionId,
            userId: actor.userId,
            expiresAt: { gt: new Date() },
            user: { accountState: "active" },
          },
        }));
      if (!session) return { error: appError("unauthorized") };
      const grant = await this.prisma.operatorGrant.findUnique({ where: { userId: actor.userId } });
      const admin = await this.prisma.adminGrant.findUnique({ where: { userId: actor.userId } });
      const authorized =
        capability === "account" || (capability === "admin" ? !!admin : !!admin || !!grant);
      const cookie = /(?:^|;\s*)(?:__Secure-)?better-auth\.session_token=/.test(
        req.headers.cookie ?? "",
      );
      const error =
        !authorized || !cookie || req.headers.authorization
          ? appError("forbidden")
          : mutation && (!session.verifiedAt || session.verifiedAt.getTime() < Date.now() - 300_000)
            ? appError("recent_auth_required")
            : null;
      if (error) {
        await this.audit(req, { action: "access.denied", outcome: "denied" });
        return { error };
      }
      await this.prisma.$executeRawUnsafe("SAVEPOINT operator_work");
      try {
        return { value: await work() };
      } catch (error) {
        if (!(error instanceof AppException)) throw error;
        await this.prisma.$executeRawUnsafe("ROLLBACK TO SAVEPOINT operator_work");
        await this.audit(req, { action: "action.denied", outcome: "denied" });
        return { error };
      }
    });
    if ("error" in result) throw result.error;
    return result.value;
  }
  audit(
    req: OperatorRequest,
    data: Omit<Prisma.OperatorAuditUncheckedCreateInput, "actorKind" | "actorUserId">,
  ) {
    return this.prisma.operatorAudit.create({
      data: {
        ...data,
        actorKind: "user",
        actorUserId: req.user.userId,
        requestId: (req as RequestWithId).requestId,
      },
    });
  }
  private accountSelect = {
    id: true,
    name: true,
    email: true,
    emailVerified: true,
    createdAt: true,
    accountState: true,
    operationsVersion: true,
    hub: { select: { id: true, handle: true } },
    operatorGrant: { select: { userId: true } },
    adminGrant: { select: { userId: true } },
    _count: { select: { sessions: { where: { expiresAt: { gt: new Date() } } } } },
  } as const;
  async accounts(where: Prisma.UserWhereInput, take: number): Promise<OperatorAccount[]> {
    const rows = await this.prisma.user.findMany({
      where,
      select: {
        ...this.accountSelect,
        _count: { select: { sessions: { where: { expiresAt: { gt: new Date() } } } } },
      },
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      take,
    });
    return rows.map((u) => ({
      id: u.id,
      name: u.name,
      email: u.email,
      emailVerified: u.emailVerified,
      hub: u.hub,
      createdAt: u.createdAt.toISOString(),
      state: u.accountState as "active" | "suspended",
      version: u.operationsVersion,
      sessions: u._count.sessions,
      operator: !!u.operatorGrant,
      admin: !!u.adminGrant,
    }));
  }
  listAccounts(req: OperatorRequest, query: CursorQueryDto) {
    return this.run(req, false, async () => {
      const page = this.page(query, "accounts");
      const rows = await this.accounts(page.where, page.limit + 1);
      await this.audit(req, { action: "accounts.list", outcome: "success" });
      return this.paged(rows, page);
    });
  }
  lookup(req: OperatorRequest, lookup: string) {
    return this.run(req, false, async () => {
      const key = lookup.trim().toLowerCase().replace(/^@/, "");
      const where: Prisma.UserWhereInput = isUUID(key)
        ? { id: key }
        : key.includes("@")
          ? { email: key }
          : { hub: { handle: key } };
      const rows = await this.accounts(where, 1);
      await this.audit(req, {
        action: "accounts.lookup",
        targetUserId: rows[0]?.id,
        outcome: rows.length ? "success" : "no_match",
      });
      return rows;
    });
  }
  account(req: OperatorRequest, id: string) {
    return this.run(req, false, async () => {
      const [account] = await this.accounts({ id }, 1);
      await this.audit(req, {
        action: "account.read",
        targetUserId: account?.id,
        outcome: account ? "success" : "no_match",
      });
      return account ?? null;
    });
  }
  collection(req: OperatorRequest, id: string) {
    return this.run(req, false, async () => {
      const result = await this.collectionInfo(id);
      await this.audit(req, {
        action: "collection.inspect",
        collectionId: result?.id,
        outcome: result ? "success" : "no_match",
      });
      return result;
    });
  }
  private async collectionInfo(id: string): Promise<OperatorCollection | null> {
    const c = await this.prisma.collection.findUnique({ where: { id }, include: { hold: true } });
    if (!c) return null;
    if (!c.hold && !(await this.policy.resolve(c, null)).canRead) return null;
    return {
      id: c.id,
      hubId: c.hubId,
      held: c.hold?.active ?? false,
      version: c.hold?.version ?? 0,
      reason: (c.hold?.reason as OperationReason) ?? null,
      updatedAt: c.hold?.updatedAt.toISOString() ?? null,
    };
  }
  command(req: OperatorRequest, command: OperationCommand) {
    return this.run(req, true, async () => {
      const { action, targetId, reason, version, operationId } = command;
      if (!reasons[action].includes(reason)) throw appError("bad_request");
      const payloadHash = createHash("sha256")
        .update(JSON.stringify([action, targetId, reason, version]))
        .digest("hex");
      const previous = await this.prisma.operatorAudit.findUnique({
        where: { actorUserId_operationId: { actorUserId: req.user.userId, operationId } },
      });
      if (previous) {
        if (
          previous.payloadHash !== payloadHash ||
          previous.afterState === null ||
          previous.resultVersion === null
        )
          throw appError("conflict");
        return { action, targetId, state: previous.afterState, version: previous.resultVersion };
      }
      let beforeState: string;
      let state: string;
      let resultVersion: number;
      const collectionAction = action.startsWith("collection.");
      if (collectionAction) {
        const current = await this.collectionInfo(targetId);
        if (!current) throw appError("not_found");
        if (current.version !== version) throw appError("version_conflict");
        const held = action === "collection.hold";
        // An inactive historical hold does not authorize a new hold on private content.
        if (held && !current.held) {
          const c = await this.prisma.collection.findUniqueOrThrow({ where: { id: targetId } });
          if (!(await this.policy.resolve(c, null)).canRead) throw appError("not_found");
        }
        beforeState = current.held ? "held" : "clear";
        state = held ? "held" : "clear";
        if (beforeState === state) resultVersion = version;
        else {
          const row = await this.prisma.collectionHold.upsert({
            where: { collectionId: targetId },
            create: { collectionId: targetId, active: held, reason, actorUserId: req.user.userId },
            update: {
              active: held,
              reason,
              actorUserId: req.user.userId,
              version: { increment: 1 },
            },
          });
          resultVersion = row.version;
          await this.prisma.collection.update({
            where: { id: targetId },
            data: { version: { increment: 1 } },
          });
        }
      } else {
        const target = await this.prisma.user.findUnique({
          where: { id: targetId },
          include: { operatorGrant: true, adminGrant: true },
        });
        if (!target) throw appError("not_found");
        const actorAdmin = await this.prisma.adminGrant.findUnique({
          where: { userId: req.user.userId },
        });
        if (target.adminGrant && action !== "sessions.revoke") throw appError("forbidden");
        if (
          !actorAdmin &&
          targetId !== req.user.userId &&
          (target.adminGrant || target.operatorGrant)
        )
          throw appError("forbidden");

        if (target.operationsVersion !== version) throw appError("version_conflict");
        beforeState = target.accountState;
        state =
          action === "account.suspend"
            ? "suspended"
            : action === "account.reactivate"
              ? "active"
              : beforeState;
        if (action === "account.suspend") {
          if (targetId === req.user.userId) throw appError("forbidden");
        }
        if (action === "sessions.revoke")
          await this.prisma.session.deleteMany({ where: { userId: targetId } });
        if (state === "suspended" && beforeState !== state) {
          const tx = authorityContext.getStore();
          if (!tx) throw new Error("Missing authority transaction");
          await revokeAccountAccess(
            tx,
            targetId,
            target.email,
            readSecret("BETTER_AUTH_SECRET") ?? "dev-better-auth-secret",
          );
        }
        const changed = beforeState !== state || action === "sessions.revoke";
        resultVersion = changed ? version + 1 : version;
        if (changed)
          await this.prisma.user.update({
            where: { id: targetId },
            data: {
              accountState: state,
              operationsVersion: resultVersion,
              ...(action === "sessions.revoke"
                ? {}
                : {
                    suspensionReason: state === "suspended" ? reason : null,
                    suspendedAt: state === "suspended" ? new Date() : null,
                  }),
            },
          });
      }
      await this.audit(req, {
        action,
        reason,
        outcome: beforeState === state && action !== "sessions.revoke" ? "no_change" : "success",
        ...(collectionAction ? { collectionId: targetId } : { targetUserId: targetId }),
        beforeState,
        afterState: state,
        operationId,
        payloadHash,
        resultVersion,
      });
      return { action, targetId, state, version: resultVersion } satisfies OperationResult;
    });
  }
  auditList(req: OperatorRequest, query: AuditQueryDto) {
    return this.run(req, false, async () => {
      const filters = {
        actor: query.actor,
        target: query.target,
        action: query.action,
        from: query.from,
        to: query.to,
      };
      const page = this.page(query, JSON.stringify(filters));
      const rows = await this.prisma.operatorAudit.findMany({
        where: {
          AND: [
            page.where,
            {
              ...(query.actor ? { actorUserId: query.actor } : {}),
              ...(query.target
                ? {
                    OR: [
                      { targetUserId: query.target },
                      { collectionId: query.target },
                      { invitationId: query.target },
                    ],
                  }
                : {}),
              ...(query.action ? { action: query.action } : {}),
              createdAt: {
                ...(query.from ? { gte: new Date(query.from) } : {}),
                ...(query.to ? { lte: new Date(query.to) } : {}),
              },
            },
          ],
        },
        orderBy: [{ createdAt: "desc" }, { id: "desc" }],
        take: page.limit + 1,
      });
      await this.audit(req, { action: "audit.read", outcome: "success" });
      const items = rows.map(
        (r): OperatorAuditEntry => ({
          id: r.id,
          createdAt: r.createdAt.toISOString(),
          actorKind: r.actorKind as "user" | "deployment" | "invitee",
          actorUserId: r.actorUserId,
          authority: r.authority,
          targetUserId: r.targetUserId,
          collectionId: r.collectionId,
          invitationId: r.invitationId,
          action: r.action,
          reason: r.reason as OperationReason | null,
          outcome: r.outcome,
          beforeState: r.beforeState,
          afterState: r.afterState,
        }),
      );
      return this.paged(items, page);
    });
  }
  page(query: CursorQueryDto, scope: string) {
    const key = createHash("sha256").update(scope).digest("hex");
    const cursor = query.cursor
      ? decodeCursor<{ id: string; at: string; cutoff: string; scope: string }>(query.cursor)
      : null;
    if (
      query.cursor &&
      (!cursor ||
        !isUUID(cursor.id ?? "") ||
        cursor.scope !== key ||
        !Number.isFinite(Date.parse(cursor.at)) ||
        !Number.isFinite(Date.parse(cursor.cutoff)) ||
        Date.parse(cursor.cutoff) > Date.now())
    )
      throw appError("invalid_cursor");
    const cutoff = cursor?.cutoff ?? new Date().toISOString();
    const where = {
      AND: [
        { createdAt: { lte: new Date(cutoff) } },
        ...(cursor
          ? [
              {
                OR: [
                  { createdAt: { lt: new Date(cursor.at) } },
                  { createdAt: new Date(cursor.at), id: { lt: cursor.id } },
                ],
              },
            ]
          : []),
      ],
    };
    return { where, limit: query.limit ?? 20, cutoff, scope: key };
  }
  paged<T extends { id: string; createdAt: string }>(
    rows: T[],
    page: { limit: number; cutoff: string; scope: string },
  ) {
    const items = rows.slice(0, page.limit),
      last = items.at(-1);
    return {
      items,
      meta: {
        limit: page.limit,
        nextCursor:
          rows.length > page.limit && last
            ? encodeCursor({
                id: last.id,
                at: last.createdAt,
                cutoff: page.cutoff,
                scope: page.scope,
              })
            : null,
      },
    };
  }
}
