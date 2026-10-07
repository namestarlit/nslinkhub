import { createHash, randomBytes } from "node:crypto";
import { Injectable, NotFoundException } from "@nestjs/common";
import type {
  AuditEntry,
  CollectionShareView,
  CursorMeta,
  HubPage,
  OperationReason,
  SavedCollection,
  SharedCollection,
  Collection as WireCollection,
} from "@nslinkhub/types";
import { auditActions } from "@nslinkhub/types";
import { isUUID } from "class-validator";
import { CursorQueryDto } from "src/common/dto/cursor-query.dto";
import { AuthUser } from "src/common/interfaces/auth-user.interface";
import { decodeCursor, encodeCursor } from "src/common/utils/cursor.util";
import { parseIfMatchVersion, toVersionEtag } from "src/common/utils/etag.util";
import { normalizeTags } from "src/common/utils/tags.util";
import { PrismaService } from "src/database/prisma.service";
import { Collection, Hub, Prisma } from "src/generated/prisma/client";
import { type AuditInput, recordAudit } from "../../common/audit";
import { appError } from "../../common/errors/app-exception";
import { wireToken } from "../../common/utils/wire-token";
import { emailConfig } from "../../email/config";
import { availableCollections } from "../hubs/availability";
import { CollectionPolicyService } from "../hubs/collection-policy.service";
import { HubsService } from "../hubs/hubs.service";
import { CreateCollectionDto } from "./dto/create-collection.dto";
import { CreateShareDto } from "./dto/create-share.dto";
import { SetLinkSharingDto } from "./dto/set-link-sharing.dto";
import { TransferCollectionDto } from "./dto/transfer-collection.dto";
import { UpdateCollectionDto } from "./dto/update-collection.dto";

@Injectable()
export class CollectionsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly hubs: HubsService,
    private readonly policy: CollectionPolicyService,
  ) {}

  // --- creation -----------------------------------------------------------

  async create(user: AuthUser, dto: CreateCollectionDto) {
    const hubId = await this.requireUserHub(user);
    return this.createInHub(user, hubId, dto);
  }

  // --- settings / lifecycle ----------------------------------------------

  async update(id: string, user: AuthUser, dto: UpdateCollectionDto, ifMatch?: string) {
    const collection = await this.requireCollection(id);
    await this.policy.requireManage(collection, user);

    if (dto.published === true) await this.policy.requireUnrestricted(collection);
    const versionFromHeader = parseIfMatchVersion(ifMatch);
    if (versionFromHeader !== null && versionFromHeader !== Number(collection.version)) {
      throw appError("version_conflict");
    }
    if (Number(dto.version) !== Number(collection.version)) {
      throw appError("version_conflict");
    }

    if (dto.slug && dto.slug !== collection.slug) {
      const exists = await this.prisma.collection.findUnique({
        where: { hubId_slug: { hubId: collection.hubId, slug: dto.slug } },
        select: { id: true },
      });
      if (exists) {
        throw appError("slug_conflict");
      }
    }

    const saved = await this.mutateOwned(
      collection,
      user,
      dto.published === undefined
        ? undefined
        : {
            action: dto.published ? "collection.published" : "collection.unpublished",
          },
      async (tx) => {
        const current = await tx.collection.findUniqueOrThrow({
          where: { id: collection.id, hubId: collection.hubId },
        });
        if (current.version !== collection.version) throw appError("version_conflict");
        return tx.collection.update({
          where: { id: collection.id, hubId: collection.hubId, version: collection.version },
          data: {
            slug: dto.slug ?? collection.slug,
            title: dto.title ?? collection.title,
            description: dto.description ?? collection.description,
            ...(dto.tags !== undefined ? { tags: normalizeTags(dto.tags) } : {}),
            published: dto.published ?? collection.published,
            commentsEnabled: dto.commentsEnabled ?? collection.commentsEnabled,
            version: { increment: 1 },
          },
        });
      },
    );
    return this.toPublicCollection(saved);
  }

  async remove(id: string, user: AuthUser) {
    const collection = await this.requireCollection(id);
    await this.policy.requireManage(collection, user);
    await this.mutateOwned(collection, user, { action: "collection.deleted" }, (tx) =>
      tx.collection.delete({ where: { id: collection.id, hubId: collection.hubId } }),
    );
    return { id, deleted: true };
  }

  async setPublished(id: string, user: AuthUser, published: boolean) {
    const collection = await this.requireCollection(id);
    await this.policy.requireManage(collection, user);
    if (published) await this.policy.requireUnrestricted(collection);
    const saved = await this.mutateOwned(
      collection,
      user,
      { action: published ? "collection.published" : "collection.unpublished" },
      async (tx) => {
        return tx.collection.update({
          where: { id: collection.id },
          data: { published, version: { increment: 1 } },
        });
      },
    );
    return this.toPublicCollection(saved);
  }

  async setLinkSharing(id: string, user: AuthUser, dto: SetLinkSharingDto) {
    const collection = await this.requireCollection(id);
    await this.policy.requireManage(collection, user);

    if (!dto.enabled) {
      // Disabling clears the token so an old link can never be resurrected.
      await this.mutateOwned(collection, user, { action: "link.disabled" }, async (tx) => {
        return tx.collection.update({
          where: { id: collection.id },
          data: {
            linkSharingEnabled: false,
            shareTokenHash: null,
            version: { increment: 1 },
          },
        });
      });
      return { collectionId: collection.id, linkSharingEnabled: false };
    }

    await this.policy.requireUnrestricted(collection);
    let token: string | undefined;
    await this.mutateOwned(
      collection,
      user,
      { action: dto.rotate ? "link.rotated" : "link.enabled" },
      async (tx) => {
        const current = await tx.collection.findUniqueOrThrow({
          where: { id: collection.id, hubId: collection.hubId },
        });
        // Decide from locked state: ordinary enable must never restore a
        // token invalidated by a concurrent rotation or disable.
        let shareTokenHash = current.shareTokenHash;
        if (!shareTokenHash || dto.rotate === true) {
          token = randomBytes(24).toString("base64url");
          shareTokenHash = createHash("sha256").update(token).digest("hex");
        }
        return tx.collection.update({
          where: { id: collection.id },
          data: {
            linkSharingEnabled: true,
            shareTokenHash,
            version: { increment: 1 },
          },
        });
      },
    );

    return {
      collectionId: collection.id,
      linkSharingEnabled: true,
      // Raw token is shown once, only when freshly minted.
      ...(token ? { token, queryParam: `?s=${token}` } : {}),
    };
  }

  // --- direct sharing -----------------------------------------------------

  async createShare(id: string, user: AuthUser, dto: CreateShareDto) {
    const collection = await this.requireCollection(id);
    await this.policy.requireManage(collection, user);

    await this.policy.requireUnrestricted(collection);
    const target = await this.prisma.user.findFirst({
      where: { email: dto.email.trim().toLowerCase(), accountState: "active" },
      select: { id: true },
    });
    if (!target) {
      throw new NotFoundException("No account found for that email");
    }

    const role = dto.role ?? "reader";
    await this.mutateOwned(
      collection,
      user,
      { action: "share.granted", targetUserId: target.id, role },
      async (tx) => {
        return tx.collectionShare.upsert({
          where: {
            collectionId_userId: { collectionId: collection.id, userId: target.id },
          },
          update: { role, source: "direct" },
          create: {
            collectionId: collection.id,
            userId: target.id,
            role,
            source: "direct",
          },
        });
      },
    );

    return { collectionId: collection.id, userId: target.id, role };
  }

  async removeShare(id: string, user: AuthUser, targetUserId: string) {
    const collection = await this.requireCollection(id);
    await this.policy.requireManage(collection, user);
    await this.mutateOwned(
      collection,
      user,
      { action: "share.revoked", targetUserId },
      async (tx) => {
        return tx.collectionShare.deleteMany({
          where: { collectionId: collection.id, userId: targetUserId },
        });
      },
    );
    return { collectionId: collection.id, userId: targetUserId, removed: true };
  }

  async listShares(id: string, user: AuthUser): Promise<CollectionShareView[]> {
    const collection = await this.requireCollection(id);
    await this.policy.requireManage(collection, user);
    const shares = await this.prisma.collectionShare.findMany({
      where: { collectionId: collection.id },
      include: { user: { select: { id: true, name: true, email: true } } },
      orderBy: { createdAt: "asc" },
    });
    return shares.map((share) => ({
      userId: share.userId,
      displayName: share.user.name,
      // Display names are not unique, so direct shares echo back the email the
      // owner shared with. Link-source viewers never gave the owner their
      // email, so it is not exposed for them.
      email: share.source === "direct" ? share.user.email : null,
      role: wireToken(share.role, ["reader", "editor"]),
      source: wireToken(share.source, ["direct", "link"]),
    }));
  }

  // --- ownership transfer -------------------------------------------------

  // Google-Drive ownership transfer: only the current owner can transfer, and
  // only to a user who is already an editor. The collection moves into
  // the recipient's hub (their "MyDrive"); the previous owner keeps editor
  // access (lands in their shared/); the immutable creator is untouched.
  async transfer(id: string, user: AuthUser, dto: TransferCollectionDto) {
    const collection = await this.requireCollection(id);
    await this.policy.requireManage(collection, user); // owner-only

    await this.policy.requireUnrestricted(collection);
    const recipient = await this.prisma.user.findFirst({
      where: { email: dto.email.trim().toLowerCase(), accountState: "active" },
      select: { id: true },
    });
    if (!recipient) {
      throw new NotFoundException("No account found for that email");
    }
    if (recipient.id === user.userId) {
      throw appError("invalid_transfer");
    }

    // Drive rule: the recipient must already be an editor on the collection.
    const share = await this.prisma.collectionShare.findUnique({
      where: { collectionId_userId: { collectionId: collection.id, userId: recipient.id } },
      select: { role: true },
    });
    if (share?.role !== "editor") {
      throw appError("transfer_requires_editor");
    }

    const recipientHub = await this.prisma.hub.findUnique({
      where: { ownerUserId: recipient.id },
      select: { id: true },
    });
    if (!recipientHub) {
      throw appError("invalid_transfer");
    }

    const conflict = await this.prisma.collection.findFirst({
      where: {
        hubId: recipientHub.id,
        slug: collection.slug,
      },
      select: { slug: true },
    });
    if (conflict) {
      throw appError("slug_conflict");
    }

    const previousOwnerId = user.userId;
    await this.mutateOwned(
      collection,
      user,
      { action: "collection.transferred_out", targetUserId: recipient.id },
      async (tx) => {
        // Share management takes the same collection lock. Recheck after
        // acquiring it so a concurrent revocation cannot authorize transfer.
        const currentShare = await tx.collectionShare.findUnique({
          where: { collectionId_userId: { collectionId: collection.id, userId: recipient.id } },
          select: { role: true },
        });
        if (currentShare?.role !== "editor") throw appError("transfer_requires_editor");
        await recordAudit(tx, {
          hubId: recipientHub.id,
          actorUserId: user.userId,
          collectionId: collection.id,
          targetUserId: recipient.id,
          action: "collection.transferred_in",
        });
        await tx.collection.update({
          where: { id: collection.id, hubId: collection.hubId },
          data: { hubId: recipientHub.id, version: { increment: 1 } },
        });
        // The recipient now owns the collection, so their shares on it are redundant.
        await tx.collectionShare.deleteMany({
          where: { collectionId: collection.id, userId: recipient.id },
        });
        // Give the previous owner editor access on this collection (their shared/).
        await tx.collectionShare.upsert({
          where: { collectionId_userId: { collectionId: collection.id, userId: previousOwnerId } },
          update: { role: "editor", source: "direct" },
          create: {
            collectionId: collection.id,
            userId: previousOwnerId,
            role: "editor",
            source: "direct",
          },
        });
      },
    );

    return {
      collectionId: collection.id,
      transferredTo: recipient.id,
      previousOwner: previousOwnerId,
    };
  }

  // --- saves --------------------------------------------------------------

  async save(id: string, user: AuthUser) {
    const collection = await this.requireCollection(id);
    await this.policy.requireRead(collection, user);
    if (!collection.published || !(await this.policy.resolve(collection, null)).canRead) {
      throw appError("collection_not_published");
    }
    await this.prisma.collectionSave.upsert({
      where: {
        collectionId_userId: {
          collectionId: collection.id,
          userId: user.userId,
        },
      },
      update: {},
      create: { collectionId: collection.id, userId: user.userId },
    });
    return { collectionId: collection.id, saved: true };
  }

  async unsave(id: string, user: AuthUser) {
    await this.prisma.collectionSave.deleteMany({
      where: { collectionId: id, userId: user.userId },
    });
    return { collectionId: id, saved: false };
  }

  // --- user surfaces ------------------------------------------------------

  async listShared(user: AuthUser): Promise<SharedCollection[]> {
    const shares = await this.prisma.collectionShare.findMany({
      where: { userId: user.userId, collection: availableCollections(user.userId) },
      include: { collection: true },
      orderBy: { createdAt: "desc" },
    });
    // Link-sourced access is valid only while link sharing stays enabled.
    return shares
      .filter((s) => s.source === "direct" || s.collection.linkSharingEnabled)
      .map((s) => ({
        ...this.toPublicCollection(s.collection),
        shareRole: wireToken(s.role, ["reader", "editor"]),
        shareSource: wireToken(s.source, ["direct", "link"]),
      }));
  }

  async listSaved(user: AuthUser): Promise<SavedCollection[]> {
    const saves = await this.prisma.collectionSave.findMany({
      where: { userId: user.userId },
      include: { collection: true },
      orderBy: { savedAt: "desc" },
    });
    // Dormant handling: an unpublished save stays listed but marked
    // unavailable, and revives when the collection is republished.
    return Promise.all(
      saves.map(async (s) => {
        const available =
          s.collection.published && (await this.policy.resolve(s.collection, null)).canRead;
        return {
          ...this.toPublicCollection(s.collection),
          ...(!available ? { description: null, tags: [] } : {}),
          savedAt: s.savedAt.toISOString(),
          available,
        };
      }),
    );
  }

  // --- discovery / lookup -------------------------------------------------

  async discover(query: CursorQueryDto) {
    return this.listPublishedCollections(query, {});
  }

  async getHubPage(hubId: string, query: CursorQueryDto) {
    const hub = await this.prisma.hub.findUnique({ where: { id: hubId } });
    return this.buildHubPage(hub, query);
  }

  // Handle resolution for /@handle pages. The handle is the handy way in; the
  // payload carries the immutable hubId, which is what clients keep. Handle
  // semantics stay in the hubs module.
  async getHubPageByHandle(handle: string, query: CursorQueryDto) {
    const hub = await this.hubs.getHubByHandle(handle);
    return this.buildHubPage(hub, query);
  }

  private async buildHubPage(
    hub: Hub | null,
    query: CursorQueryDto,
  ): Promise<HubPage & { meta: CursorMeta }> {
    const visible =
      hub &&
      (await this.prisma.hub.findFirst({
        where: { id: hub.id, owner: { accountState: "active" } },
        select: { owner: { select: { name: true, showNameOnHub: true } } },
      }));
    if (!hub || !visible) throw new NotFoundException("Hub not found");
    const [collections, publishedCollectionCount] = await Promise.all([
      this.listPublishedCollections(query, { hubId: hub.id }),
      this.prisma.collection.count({
        where: { hubId: hub.id, published: true, ...availableCollections() },
      }),
    ]);
    return {
      hub: {
        id: hub.id,
        handle: hub.handle,
        name: hub.name,
        ownerName: visible.owner.showNameOnHub ? visible.owner.name.trim() || null : null,
        description: hub.description,
        publishedCollectionCount,
        createdAt: hub.createdAt.toISOString(),
        updatedAt: hub.updatedAt.toISOString(),
      },
      collections: collections.items,
      meta: collections.meta,
    };
  }

  async listHubCollections(hubId: string, viewer: AuthUser | null, query: CursorQueryDto) {
    const hub = await this.prisma.hub.findUnique({
      where: { id: hubId },
      select: { id: true },
    });
    if (
      !hub ||
      !(await this.prisma.hub.findFirst({
        where: { id: hub.id, owner: { accountState: "active" } },
      }))
    ) {
      throw new NotFoundException("Hub not found");
    }

    const isOwner = viewer !== null && (await this.hubs.isOwner(hubId, viewer.userId));

    // The owner sees every collection; everyone else sees the published subset.
    return this.listCollectionsKeyset(query, {
      hubId,
      ...(isOwner
        ? availableCollections(viewer?.userId)
        : { published: true, ...availableCollections() }),
    });
  }

  async getHubCollectionBySlug(
    hubId: string,
    slug: string,
    viewer: AuthUser | null,
    shareToken?: string,
  ) {
    const collection = await this.prisma.collection.findUnique({
      where: { hubId_slug: { hubId, slug } },
    });
    if (!collection) {
      throw new NotFoundException("Collection not found");
    }
    return this.readCollectionView(collection, viewer, shareToken);
  }

  // Durable lookup by the immutable collection id — the reference that
  // survives a slug rename (hub+slug is the pretty URL, this is the permalink).
  async getById(id: string, viewer: AuthUser | null, shareToken?: string) {
    const collection = await this.requireCollection(id);
    return this.readCollectionView(collection, viewer, shareToken);
  }

  private async readCollectionView(
    collection: Collection,
    viewer: AuthUser | null,
    shareToken?: string,
  ) {
    const access = await this.policy.requireRead(collection, viewer, shareToken);
    if (access.viaLinkToken && viewer) {
      await this.policy.recordLinkAccess(collection.id, viewer.userId);
    }

    const reason = access.isOwner ? await this.policy.holdReason(collection) : null;
    const creator = collection.creatorUserId
      ? await this.prisma.user.findFirst({
          where: { id: collection.creatorUserId, accountState: "active" },
          select: { name: true, showNameOnHub: true, hub: { select: { id: true, handle: true } } },
        })
      : null;
    return {
      collection: {
        ...this.toPublicCollection(collection),
        creator: creator?.hub
          ? {
              hubId: creator.hub.id,
              handle: creator.hub.handle,
              name: creator.showNameOnHub ? creator.name.trim() || null : null,
            }
          : null,
        capabilities: { canManage: access.isOwner },
        ...(reason
          ? {
              restriction: {
                reason: reason as OperationReason,
                supportUrl: emailConfig().supportUrl,
              },
            }
          : {}),
      },
      etag: toVersionEtag(Number(collection.version)),
      lastModified: collection.updatedAt.toUTCString(),
    };
  }

  async listAudit(user: AuthUser, query: CursorQueryDto) {
    const hubId = await this.requireUserHub(user);
    const limit = query.limit ?? 20;
    let cursorId: string | undefined;
    if (query.cursor) {
      const cursor = decodeCursor<{ id: string }>(query.cursor);
      if (
        !cursor ||
        typeof cursor.id !== "string" ||
        !/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/.test(cursor.id) ||
        !(await this.prisma.auditRecord.findFirst({ where: { id: cursor.id, hubId } }))
      ) {
        throw appError("invalid_cursor");
      }
      cursorId = cursor.id;
    }
    const rows = await this.prisma.$transaction(async (tx) => {
      const entries = await tx.auditRecord.findMany({
        where: { hubId },
        orderBy: [{ createdAt: "desc" }, { id: "desc" }],
        take: limit + 1,
        ...(cursorId ? { cursor: { id: cursorId }, skip: 1 } : {}),
      });
      await recordAudit(tx, { hubId, actorUserId: user.userId, action: "audit.read" });
      return entries;
    });
    const hasMore = rows.length > limit;
    const items = rows.slice(0, limit).map(
      (row): AuditEntry => ({
        id: row.id,
        hubId: row.hubId,
        actorUserId: row.actorUserId,
        collectionId: row.collectionId,
        targetUserId: row.targetUserId,
        action: wireToken(row.action, auditActions),
        role: row.role === null ? null : wireToken(row.role, ["reader", "editor"]),
        createdAt: row.createdAt.toISOString(),
      }),
    );
    return {
      items,
      meta: { limit, nextCursor: hasMore ? encodeCursor({ id: items.at(-1)?.id }) : null },
    };
  }

  private async mutateOwned<T>(
    collection: Collection,
    user: AuthUser,
    event: Omit<AuditInput, "hubId" | "actorUserId" | "collectionId"> | undefined,
    mutate: (tx: Prisma.TransactionClient) => Promise<T>,
  ): Promise<T> {
    return this.prisma.$transaction(async (tx) => {
      const locked = await tx.$queryRaw<Array<{ id: string }>>`
        SELECT c.id FROM collections c JOIN hubs h ON h.id = c.hub_id
        WHERE c.id = ${collection.id}::uuid AND c.hub_id = ${collection.hubId}::uuid
          AND h.owner_user_id = ${user.userId}::uuid FOR UPDATE OF c`;
      if (locked.length !== 1) throw new NotFoundException("Collection not found");
      const result = await mutate(tx);
      if (event)
        await recordAudit(tx, {
          ...event,
          hubId: collection.hubId,
          actorUserId: user.userId,
          collectionId: collection.id,
        });
      return result;
    });
  }

  // --- internals ----------------------------------------------------------

  // Collections are independent containers.
  private async createInHub(user: AuthUser, hubId: string, dto: CreateCollectionDto) {
    const exists = await this.prisma.collection.findUnique({
      where: { hubId_slug: { hubId, slug: dto.slug } },
      select: { id: true },
    });
    if (exists) {
      throw appError("slug_conflict");
    }

    const saved = await this.prisma.$transaction(async (tx) => {
      const created = await tx.collection.create({
        data: {
          hubId,
          // Immutable creator/provenance: unchanged if ownership is later
          // transferred (the owning hubId changes, the creator does not).
          creatorUserId: user.userId,
          slug: dto.slug,
          title: dto.title,
          description: dto.description,
          tags: normalizeTags(dto.tags),
          published: dto.published ?? false,
        },
      });
      if (created.published)
        await recordAudit(tx, {
          hubId,
          actorUserId: user.userId,
          collectionId: created.id,
          action: "collection.published",
        });
      return created;
    });
    return this.toPublicCollection(saved);
  }

  private async listPublishedCollections(query: CursorQueryDto, extraWhere: { hubId?: string }) {
    return this.listCollectionsKeyset(query, {
      published: true,
      ...availableCollections(),
      ...extraWhere,
    });
  }

  private async listCollectionsKeyset(query: CursorQueryDto, where: Prisma.CollectionWhereInput) {
    const limit = query.limit ?? 20;
    const cursor = query.cursor ? decodeCursor<{ u: string; id: string }>(query.cursor) : null;
    if (
      query.cursor &&
      (cursor === null ||
        typeof cursor.u !== "string" ||
        typeof cursor.id !== "string" ||
        !isUUID(cursor.id) ||
        Number.isNaN(Date.parse(cursor.u)))
    ) {
      throw appError("invalid_cursor");
    }

    const rows = await this.prisma.collection.findMany({
      where: {
        AND: [
          where,
          ...(cursor
            ? [
                {
                  OR: [
                    { updatedAt: { lt: new Date(cursor.u) } },
                    { updatedAt: new Date(cursor.u), id: { lt: cursor.id } },
                  ],
                },
              ]
            : []),
        ],
      },
      include: {
        hub: {
          select: {
            id: true,
            handle: true,
            name: true,
            owner: { select: { name: true, showNameOnHub: true } },
          },
        },
      },
      orderBy: [{ updatedAt: "desc" }, { id: "desc" }],
      take: limit + 1,
    });

    const items = rows.slice(0, limit);
    const last = items[items.length - 1];
    const nextCursor =
      rows.length > limit && last
        ? encodeCursor({ u: last.updatedAt.toISOString(), id: last.id })
        : null;

    return {
      items: items.map((item) => ({
        ...this.toPublicCollection(item),
        hub: {
          id: item.hub.id,
          handle: item.hub.handle,
          name: item.hub.name,
          ownerName: item.hub.owner.showNameOnHub ? item.hub.owner.name.trim() || null : null,
        },
      })),
      meta: { limit, nextCursor },
    };
  }

  private async requireUserHub(user: AuthUser): Promise<string> {
    const hubId = await this.hubs.getUserHubId(user.userId);
    if (!hubId) {
      throw appError("hub_unavailable");
    }
    return hubId;
  }

  private async requireCollection(
    id: string,
    message = "Collection not found",
  ): Promise<Collection> {
    const collection = await this.prisma.collection.findUnique({
      where: { id },
    });
    if (!collection) {
      throw new NotFoundException(message);
    }
    return collection;
  }

  private toPublicCollection(collection: Collection): WireCollection {
    return {
      id: collection.id,
      hubId: collection.hubId,
      slug: collection.slug,
      title: collection.title,
      description: collection.description,
      tags: collection.tags,
      published: collection.published,
      linkSharingEnabled: collection.linkSharingEnabled,
      commentsEnabled: collection.commentsEnabled,
      version: Number(collection.version),
      createdAt: collection.createdAt.toISOString(),
      updatedAt: collection.updatedAt.toISOString(),
    };
  }
}
