import { afterAll, beforeAll, beforeEach, describe, expect, it } from "bun:test";
import { randomUUID } from "node:crypto";
import { INestApplication } from "@nestjs/common";
import { Test } from "@nestjs/testing";
import type { OperationAction } from "@nslinkhub/types";
import request from "supertest";
import { AppModule } from "../src/app.module";
import { configureApp } from "../src/app.setup";
import { RequestBudgetMaintenance } from "../src/common/request-budget-maintenance";
import { readSecret } from "../src/config/secret";
import { PrismaService } from "../src/database/prisma.service";
import { emailConfig } from "../src/email/config";
import { emailKey, unseal } from "../src/email/outbox";
import { changeOperatorGrant } from "./fixtures/operator";
import { signInWithCode } from "./fixtures/sign-in";

describe("service operator authority (HTTP)", () => {
  let app: INestApplication, prisma: PrismaService;
  type Actor = { id: string; cookie: string; token: string; email: string };
  let operator: Actor, owner: Actor, reader: Actor;
  const origin = process.env.BETTER_AUTH_URL ?? "http://localhost:4000";
  const server = () => app.getHttpServer();
  async function login(name: string): Promise<Actor> {
    const email = `ops-${name}-${randomUUID()}@example.com`;
    const response = await signInWithCode(server(), { email, name });
    return {
      id: response.body.user.id,
      email,
      token: response.headers["set-auth-token"],
      cookie: (response.headers["set-cookie"] as unknown as string[])
        .map((c: string) => c.split(";")[0])
        .join("; "),
    };
  }
  const as = (method: "get" | "post" | "patch" | "delete", path: string, actor = operator) =>
    request(server())[method](path).set("Cookie", actor.cookie).set("Origin", origin);
  async function create(published = true) {
    const r = await as("post", "/api/v1/collections", owner)
      .send({ slug: `ops-${randomUUID()}`, title: "Operator public fixture", published })
      .expect(201);
    return r.body.data;
  }
  function command(
    action: OperationAction,
    targetId: string,
    version: number,
    extra: Record<string, unknown> = {},
    actor = operator,
  ) {
    const reason =
      action.endsWith("reactivate") || action.endsWith("release")
        ? "review_completed"
        : action === "sessions.revoke"
          ? "account_compromise"
          : "spam";
    return as("post", "/api/v1/operations/commands", actor).send({
      action,
      targetId,
      version,
      reason,
      operationId: randomUUID(),
      ...extra,
    });
  }
  beforeAll(async () => {
    const module = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = module.createNestApplication({ bodyParser: false });
    configureApp(app);
    await app.init();
    prisma = app.get(PrismaService);
    operator = await login("operator");
    await prisma.adminGrant.create({ data: { userId: operator.id, invitationId: randomUUID() } });
    owner = await login("owner");
    reader = await login("reader");
    await changeOperatorGrant(prisma, {
      userId: operator.id,
      grant: true,
      authority: "test-deployment",
      version: 1,
    });
  });
  beforeEach(async () => {
    await prisma.requestBudget.deleteMany();
  });
  afterAll(async () => {
    await app?.close();
  });

  it("requires an explicit live grant, cookie authority, exact Origin and recent code verification", async () => {
    await as("get", "/api/v1/operations/accounts", owner).expect(403);
    await request(server())
      .get("/api/v1/operations/accounts")
      .set("Authorization", `Bearer ${operator.token}`)
      .expect(403);
    await request(server())
      .post("/api/v1/operations/accounts/lookup")
      .set("Cookie", operator.cookie)
      .send({ lookup: owner.email })
      .expect(403);
    const lookup = await as("post", "/api/v1/operations/accounts/lookup")
      .send({ lookup: owner.email })
      .expect(201);
    expect(lookup.body.data[0].id).toBe(owner.id);
    expect(JSON.stringify(lookup.body)).not.toContain("token");
    await prisma.session.updateMany({
      where: { userId: operator.id },
      data: { verifiedAt: new Date(Date.now() - 360000) },
    });
    const stale = await command("sessions.revoke", reader.id, 1).expect(403);
    expect(stale.body.error.code).toBe("recent_auth_required");
    await prisma.session.updateMany({
      where: { userId: operator.id },
      data: { verifiedAt: new Date() },
    });
  });
  it("does not inspect private collections or turn operator status into a content grant", async () => {
    const c = await create(false);
    const result = await as("get", `/api/v1/operations/collections/${c.id}`).expect(200);
    expect(result.body.data).toBeNull();
    await as("get", `/api/v1/collections/${c.id}`).expect(404);
    await command("collection.hold", c.id, 0).expect(404);
  });
  it("holds only the destination, redacts reference metadata and permits owner correction", async () => {
    const source = await create(),
      target = await create();
    await as("post", `/api/v1/collections/${source.id}/resources/collection`, owner)
      .send({ linkedCollectionId: target.id, position: 0 })
      .expect(201);
    await as("post", `/api/v1/collections/${target.id}/shares`, owner)
      .send({ email: reader.email, role: "editor" })
      .expect(201);
    await as("post", `/api/v1/collections/${target.id}/save`, reader).expect(201);
    const token = await as("post", `/api/v1/collections/${target.id}/resources/external`, owner)
      .send({ url: "https://fixture-links.dev/held-secret", position: 0 })
      .expect(201);
    expect(token.body.data.id).toBeDefined();
    await command("collection.hold", target.id, 0).expect(201);
    await request(server()).get(`/api/v1/collections/${target.id}`).expect(404);
    await as("get", `/api/v1/collections/${target.id}`, reader).expect(404);
    const resources = await request(server())
      .get(`/api/v1/collections/${source.id}/resources`)
      .expect(200);
    expect(resources.body.data[0].linkedCollection).toBeNull();
    const file = await as("post", "/api/v1/exports", reader)
      .send({ collectionIds: [source.id], format: "markdown", expand: true })
      .expect(201);
    expect(file.text).not.toContain("held-secret");
    const own = await as("get", `/api/v1/collections/${target.id}`, owner).expect(200);
    expect(own.body.data.restriction.reason).toBe("spam");
    await as("patch", `/api/v1/collections/${target.id}`, owner)
      .send({ version: own.body.data.version, title: "Corrected" })
      .expect(200);
    await as("post", `/api/v1/collections/${target.id}/publish`, owner).expect(403);
    await as("delete", `/api/v1/collections/${source.id}`, owner).expect(200);
    const saved = await as("get", "/api/v1/me/saved", reader).expect(200);
    expect(saved.body.data.find((s: { id: string }) => s.id === target.id).available).toBe(false);
    await command("collection.release", target.id, 1).expect(201);
    await request(server()).get(`/api/v1/collections/${target.id}`).expect(200);
  });
  it("keeps held collections excluded through public pagination but visible to their owner", async () => {
    const older = await create();
    const held = await create();
    const newer = await create();
    await command("collection.hold", held.id, 0).expect(201);
    const profile = await as("get", "/api/v1/profile", owner).expect(200);
    const hubId = profile.body.data.hubId;
    const publicPath = `/api/v1/hubs/${hubId}/collections?limit=1`;
    const first = await request(server()).get(publicPath).expect(200);
    expect(first.body.data[0].id).toBe(newer.id);
    const second = await request(server())
      .get(`${publicPath}&cursor=${encodeURIComponent(first.body.meta.nextCursor)}`)
      .expect(200);
    expect(second.body.data[0].id).toBe(older.id);
    const own = await as("get", `/api/v1/hubs/${hubId}/collections?limit=100`, owner).expect(200);
    expect(own.body.data.some((c: { id: string }) => c.id === held.id)).toBe(true);
  });
  it("suspends sessions and distribution atomically; reactivation requires fresh sign-in", async () => {
    const target = await login("suspended");
    await changeOperatorGrant(prisma, {
      userId: target.id,
      grant: true,
      authority: "test-deployment",
      version: 1,
    });
    const c = await as("post", "/api/v1/collections", target)
      .send({ slug: `s-${randomUUID()}`, title: "Suspended fixture", published: true })
      .expect(201);
    const account = await as("get", `/api/v1/operations/accounts/${target.id}`).expect(200);
    await command("account.suspend", target.id, account.body.data.version).expect(201);
    expect(await prisma.operatorGrant.findUnique({ where: { userId: target.id } })).toBeNull();
    await as("get", "/api/v1/profile", target).expect(401);
    const raw = await as("get", "/api/v1/auth/get-session", target).expect(200);
    expect(raw.body).toBeNull();
    await request(server()).get(`/api/v1/collections/${c.body.data.id}`).expect(404);
    await as("post", "/api/v1/auth/code/send", target).send({ email: target.email }).expect(200);
    await command("account.reactivate", target.id, account.body.data.version + 1).expect(201);
    await as("get", "/api/v1/profile", target).expect(401);
    expect(await prisma.operatorGrant.findUnique({ where: { userId: target.id } })).toBeNull();
    await request(server()).get(`/api/v1/collections/${c.body.data.id}`).expect(200);
  });
  it("deduplicates action retries, rejects stale/conflicting submissions and protects self suspension", async () => {
    const c = await create();
    const operationId = randomUUID();
    const first = await command("collection.hold", c.id, 0, { operationId }).expect(201);
    const again = await command("collection.hold", c.id, 0, { operationId }).expect(201);
    expect(again.body.data).toEqual(first.body.data);
    await command("collection.release", c.id, 0, { operationId }).expect(409);
    await command("collection.release", c.id, 0).expect(409);
    expect(await prisma.operatorAudit.count({ where: { operationId } })).toBe(1);
    const account = await as("get", `/api/v1/operations/accounts/${operator.id}`).expect(200);
    await command("account.suspend", operator.id, account.body.data.version).expect(403);
  });
  it("rolls back restrictions if audit persistence fails", async () => {
    const c = await create();
    // A database trigger exercises the actual transaction client, not a mock
    // on a different Prisma delegate.
    await prisma.$executeRawUnsafe(
      `CREATE FUNCTION test_fail_operator_audit() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'synthetic audit failure'; END $$`,
    );
    await prisma.$executeRawUnsafe(
      `CREATE TRIGGER test_fail_operator_audit BEFORE INSERT ON operator_audit FOR EACH ROW EXECUTE FUNCTION test_fail_operator_audit()`,
    );
    try {
      await command("collection.hold", c.id, 0).expect(500);
    } finally {
      await prisma.$executeRawUnsafe("DROP TRIGGER test_fail_operator_audit ON operator_audit");
      await prisma.$executeRawUnsafe("DROP FUNCTION test_fail_operator_audit()");
    }
    expect(await prisma.collectionHold.findUnique({ where: { collectionId: c.id } })).toBeNull();
  });
  it("audits lookup without its email and cleans history without lifting restrictions", async () => {
    await as("post", "/api/v1/operations/accounts/lookup")
      .send({ lookup: owner.email })
      .expect(201);
    const audit = await as("get", `/api/v1/operations/audit?target=${owner.id}&limit=1`).expect(
      200,
    );
    expect(audit.body.data).toHaveLength(1);
    expect(JSON.stringify(audit.body)).not.toContain(owner.email);
    const c = await create();
    await command("collection.hold", c.id, 0).expect(201);
    await prisma.operatorAudit.updateMany({
      where: { collectionId: c.id },
      data: { createdAt: new Date(Date.now() - 366 * 86400000) },
    });
    await app.get(RequestBudgetMaintenance).prune();
    expect(await prisma.operatorAudit.count({ where: { collectionId: c.id } })).toBe(0);
    expect(
      (await prisma.collectionHold.findUniqueOrThrow({ where: { collectionId: c.id } })).active,
    ).toBe(true);
  });
  async function codeFor(email: string) {
    const row = await prisma.emailOutbox.findFirstOrThrow({
      where: {
        recipientKey: emailKey(emailConfig().suppressionSecret, "recipient", email),
        state: "pending",
      },
      orderBy: { createdAt: "desc" },
    });
    const code = unseal(
      row.payload ?? "",
      readSecret("BETTER_AUTH_SECRET") ?? "dev-better-auth-secret",
    ).text.match(/^\d{8}$/m)?.[0];
    if (!code) throw new Error("Expected captured standalone code");
    return code;
  }
  it("revokes pending code proofs and composes suspension with a retained collection hold", async () => {
    const target = await login("proof-revocation");
    const c = await as("post", "/api/v1/collections", target)
      .send({ slug: `proof-${randomUUID()}`, title: "Held through reactivation", published: true })
      .expect(201);
    await command("collection.hold", c.body.data.id, 0).expect(201);
    await request(server())
      .post("/api/v1/auth/code/send")
      .send({ email: target.email })
      .expect(200);
    const code = await codeFor(target.email);
    await command("account.suspend", target.id, 1).expect(201);
    await command("account.reactivate", target.id, 2).expect(201);
    await request(server())
      .post("/api/v1/auth/code/verify")
      .send({ email: target.email, code })
      .expect(400);
    await request(server()).get(`/api/v1/collections/${c.body.data.id}`).expect(404);
    await command("collection.release", c.body.data.id, 1).expect(201);
    await request(server()).get(`/api/v1/collections/${c.body.data.id}`).expect(200);
  });
  it("removes both service roles and authored invitations during verified email handover", async () => {
    const target = await login("handover"),
      newEmail = `next-${randomUUID()}@example.com`;
    await changeOperatorGrant(prisma, {
      userId: target.id,
      grant: true,
      authority: "test-deployment",
      version: 1,
    });
    await prisma.adminGrant.create({ data: { userId: target.id, invitationId: randomUUID() } });
    const pending = await as("post", "/api/v1/operations/operator-invitations", target)
      .send({ email: `handover-invite-${randomUUID()}@example.com`, operationId: randomUUID() })
      .expect(201);
    await as("post", "/api/v1/auth/email-change/start", target).send({ newEmail }).expect(200);
    await as("post", "/api/v1/auth/email-change/confirm-current", target)
      .send({ code: await codeFor(target.email) })
      .expect(200);
    await as("post", "/api/v1/auth/email-change/confirm-new", target)
      .send({ code: await codeFor(newEmail) })
      .expect(200);
    expect(await prisma.operatorGrant.findUnique({ where: { userId: target.id } })).toBeNull();
    expect(await prisma.adminGrant.findUnique({ where: { userId: target.id } })).toBeNull();
    expect(
      (await prisma.serviceInvitation.findUniqueOrThrow({ where: { id: pending.body.data.id } }))
        .state,
    ).toBe("cancelled");
    expect(await prisma.session.count({ where: { userId: target.id } })).toBe(0);
    expect(
      await prisma.operatorAudit.count({
        where: { targetUserId: target.id, action: "account.handover" },
      }),
    ).toBe(1);
  });
  it("serializes competing operator actions without propagating holds through references", async () => {
    const a = await login("race-a"),
      b = await login("race-b");
    for (const actor of [a, b])
      await changeOperatorGrant(prisma, {
        userId: actor.id,
        grant: true,
        authority: "test-deployment",
        version: 1,
      });
    const responses = await Promise.all([
      command("account.suspend", b.id, 2, {}, a),
      command("account.suspend", a.id, 2, {}, b),
    ]);
    expect(responses.map((r) => r.status).sort()).toEqual([403, 403]);
    const source = await create(),
      target = await create();
    const [hold, reference] = await Promise.all([
      command("collection.hold", source.id, 0),
      as("post", `/api/v1/collections/${source.id}/resources/collection`, owner).send({
        linkedCollectionId: target.id,
        position: 0,
      }),
    ]);
    expect(hold.status).toBe(201);
    expect(reference.status).toBe(201);
    await request(server()).get(`/api/v1/collections/${target.id}`).expect(200);
  });
});
