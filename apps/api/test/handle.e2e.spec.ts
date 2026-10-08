import { afterAll, beforeAll, describe, expect, it } from "bun:test";
import { INestApplication } from "@nestjs/common";
import { Test } from "@nestjs/testing";
import request from "supertest";
import { App } from "supertest/types";
import { AppModule } from "../src/app.module";
import { configureApp } from "../src/app.setup";
import { PrismaService } from "../src/database/prisma.service";
import { signInWithCode } from "./fixtures/sign-in";

// Locks hub-handle rules: a reserved word is never issued at sign-up (the
// auto-generated handle) and never accepted on rename.
describe("Hub handles (e2e)", () => {
  let app: INestApplication<App>;
  const sfx = Date.now().toString(36);

  beforeAll(async () => {
    const moduleFixture = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleFixture.createNestApplication<INestApplication<App>>({ bodyParser: false });
    configureApp(app);
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  it("gives email-only accounts readable unique handles without exposing the email", async () => {
    const handles: string[] = [];
    for (const name of [undefined, "李", "ab"]) {
      const email = `private-mailbox-${crypto.randomUUID()}@example.com`;
      const signUp = await signInWithCode(app.getHttpServer(), { email, name });
      const profile = await request(app.getHttpServer())
        .get("/api/v1/profile")
        .auth(signUp.headers["set-auth-token"], { type: "bearer" })
        .expect(200);
      const handle = profile.body.data.handle;
      expect(handle).toMatch(/^[a-z]+-[a-z]+-[a-f0-9]{4}$/);
      expect(handle).not.toContain("private-mailbox");
      handles.push(handle);
    }
    expect(new Set(handles).size).toBe(handles.length);
  });

  it("never auto-issues a reserved handle at sign-up", async () => {
    // "Explore" slugifies to the reserved handle "explore".
    const signUp = await signInWithCode(app.getHttpServer(), {
      email: `explore_${sfx}@example.com`,
      name: "Explore",
    });
    const bearer = signUp.headers["set-auth-token"];

    const profile = await request(app.getHttpServer())
      .get("/api/v1/profile")
      .set("Authorization", `Bearer ${bearer}`)
      .expect(200);
    const handle = (profile.body as { data: { handle: string } }).data.handle;

    expect(handle).not.toBe("explore");
    expect(handle.startsWith("explore")).toBe(true);
  });

  it("rejects renaming to a reserved handle", async () => {
    const signUp = await signInWithCode(app.getHttpServer(), {
      email: `hname_${sfx}@example.com`,
      name: `hname ${sfx}`,
    });
    const bearer = signUp.headers["set-auth-token"];

    await request(app.getHttpServer())
      .patch("/api/v1/profile")
      .set("Authorization", `Bearer ${bearer}`)
      .send({ handle: "api" })
      .expect(400);
  });

  it("checks availability for the authenticated account without exposing account details", async () => {
    const signUp = await signInWithCode(app.getHttpServer(), {
      email: `availability_${sfx}@example.com`,
      name: `availability ${sfx}`,
    });
    const bearer = signUp.headers["set-auth-token"];
    const profile = await request(app.getHttpServer())
      .get("/api/v1/profile")
      .auth(bearer, { type: "bearer" })
      .expect(200);
    const endpoint = "/api/v1/profile/handle-availability";
    await request(app.getHttpServer()).get(`${endpoint}?handle=example`).expect(401);
    for (const [handle, status] of [
      [profile.body.data.handle, "current"],
      [`free-${sfx}`, "available"],
      ["api", "reserved"],
      ["ab", "invalid"],
      ["has--gap", "invalid"],
    ]) {
      const response = await request(app.getHttpServer())
        .get(endpoint)
        .query({ handle })
        .auth(bearer, { type: "bearer" })
        .expect(200);
      expect(response.body).toEqual({ data: { handle, status } });
      expect(response.headers["cache-control"]).toContain("no-store");
    }
    for (const query of [{}, { handle: "x".repeat(61) }, { handle: ["one", "two"] }]) {
      await request(app.getHttpServer())
        .get(endpoint)
        .query(query)
        .auth(bearer, { type: "bearer" })
        .expect(400);
    }
  });

  it("treats availability as advisory and allows only one concurrent handle claim", async () => {
    const tokens: string[] = [];
    for (const n of [1, 2]) {
      const response = await signInWithCode(app.getHttpServer(), {
        email: `claim-${n}-${sfx}@example.com`,
        name: `Claim ${n} ${sfx}`,
      });
      tokens.push(response.headers["set-auth-token"]);
    }
    const handle = `claimed-${sfx}`;
    for (const token of tokens) {
      const response = await request(app.getHttpServer())
        .get("/api/v1/profile/handle-availability")
        .query({ handle })
        .auth(token, { type: "bearer" })
        .expect(200);
      expect(response.body.data.status).toBe("available");
    }
    const claims = await Promise.all(
      tokens.map((token) =>
        request(app.getHttpServer())
          .patch("/api/v1/profile")
          .auth(token, { type: "bearer" })
          .send({ handle }),
      ),
    );
    expect(claims.map((r) => r.status).sort()).toEqual([200, 400]);
    const loser = claims.findIndex((r) => r.status === 400);
    expect(claims[loser].body.error.code).toBe("handle_unavailable");
    const response = await request(app.getHttpServer())
      .get("/api/v1/profile/handle-availability")
      .query({ handle })
      .auth(tokens[loser], { type: "bearer" })
      .expect(200);
    expect(response.body).toEqual({ data: { handle, status: "taken" } });
  });
  it("reports public totals across pages without counting private or held collections", async () => {
    const signed = await signInWithCode(app.getHttpServer(), {
      email: `hub-metadata-${crypto.randomUUID()}@example.com`,
    });
    const prisma = app.get(PrismaService);
    const hub = await prisma.hub.findUniqueOrThrow({ where: { ownerUserId: signed.body.user.id } });
    for (const slug of ["first", "second", "private", "held"]) {
      const item = await prisma.collection.create({
        data: { hubId: hub.id, slug, title: slug, published: slug !== "private" },
      });
      if (slug === "held")
        await prisma.collectionHold.create({
          data: { collectionId: item.id, actorUserId: signed.body.user.id, reason: "spam" },
        });
    }
    for (const path of [`/api/v1/hubs/${hub.id}`, `/api/v1/hubs/by-handle/${hub.handle}`]) {
      const first = await request(app.getHttpServer()).get(`${path}?limit=1`).expect(200);
      expect(first.body.data.collections).toHaveLength(1);
      expect(first.body.data.hub).toMatchObject({
        publishedCollectionCount: 2,
        createdAt: hub.createdAt.toISOString(),
        updatedAt: hub.updatedAt.toISOString(),
      });
      const second = await request(app.getHttpServer())
        .get(`${path}?limit=1&cursor=${encodeURIComponent(first.body.meta.nextCursor)}`)
        .expect(200);
      expect(second.body.data.hub.publishedCollectionCount).toBe(2);
      expect(second.body.data.collections).toHaveLength(1);
      expect(second.body.meta.nextCursor).toBeNull();
    }
  });

  it("keeps hub names independent of owner identity and resolves the same hub by ID and handle", async () => {
    const email = `hub-identity-${crypto.randomUUID()}@example.com`;
    const signed = await signInWithCode(app.getHttpServer(), { email, name: "First Owner" });
    const token = signed.headers["set-auth-token"];
    const initial = await request(app.getHttpServer())
      .get("/api/v1/profile")
      .auth(token, { type: "bearer" })
      .expect(200);
    const id = initial.body.data.hubId;
    const handle = `independent-${crypto.randomUUID().slice(0, 8)}`;
    await request(app.getHttpServer())
      .patch("/api/v1/profile")
      .auth(token, { type: "bearer" })
      .send({
        hubName: "Field Notes",
        hubDescription: " A home for curious readers. ",
        handle,
        displayName: "Owner Full Name",
      })
      .expect(200);
    const collection = await request(app.getHttpServer())
      .post("/api/v1/collections")
      .auth(token, { type: "bearer" })
      .send({
        slug: "links",
        title: "Useful references",
        description: "A focused reading list",
        tags: ["reading"],
        published: true,
      })
      .expect(201);
    for (const path of [`/api/v1/hubs/${id}`, `/api/v1/hubs/by-handle/${handle}`]) {
      const result = await request(app.getHttpServer()).get(path).expect(200);
      expect(result.body.data.hub).toMatchObject({
        id,
        handle,
        name: "Field Notes",
        description: "A home for curious readers.",
        ownerName: "Owner Full Name",
      });
      expect(result.body.data.collections[0]).toMatchObject({
        description: "A focused reading list",
        tags: ["reading"],
        hub: { name: "Field Notes" },
      });
      // A name shows only on the hub itself; collections carry the handle only.
      expect(result.body.data.collections[0].hub.ownerName).toBeUndefined();
      expect(JSON.stringify(result.body)).not.toContain(email);
    }
    await request(app.getHttpServer())
      .patch("/api/v1/profile")
      .auth(token, { type: "bearer" })
      .send({ displayName: "Changed Owner" })
      .expect(200);
    await request(app.getHttpServer())
      .patch("/api/v1/profile")
      .auth(token, { type: "bearer" })
      .send({ hubName: "   " })
      .expect(400);
    await request(app.getHttpServer())
      .patch("/api/v1/profile")
      .auth(token, { type: "bearer" })
      .send({ hubDescription: "x".repeat(5001) })
      .expect(400);
    const prisma = app.get(PrismaService);
    await prisma.user.update({
      where: { id: signed.body.user.id },
      data: { email: `changed-${crypto.randomUUID()}@example.com` },
    });
    expect((await prisma.hub.findUniqueOrThrow({ where: { id } })).name).toBe("Field Notes");
    const second = await signInWithCode(app.getHttpServer(), {
      email: `new-owner-${crypto.randomUUID()}@example.com`,
      name: "Next Owner",
    });
    await prisma.hub.delete({ where: { ownerUserId: second.body.user.id } });
    await prisma.hub.update({ where: { id }, data: { ownerUserId: second.body.user.id } });
    const stable = await request(app.getHttpServer()).get(`/api/v1/hubs/${id}`).expect(200);
    expect(stable.body.data.hub).toMatchObject({
      id,
      handle,
      name: "Field Notes",
      description: "A home for curious readers.",
      ownerName: "Next Owner",
    });
    const discover = await request(app.getHttpServer())
      .get("/api/v1/discover?limit=100")
      .expect(200);
    expect(
      discover.body.data.find((item: { id: string }) => item.id === collection.body.data.id).hub,
    ).toEqual({ id, handle, name: "Field Notes" }); // the owner's name is only on the hub page
    await request(app.getHttpServer())
      .patch("/api/v1/profile")
      .auth(token, { type: "bearer" })
      .send({ hubDescription: "Former owner cannot change this" })
      .expect(404);
    const cleared = await request(app.getHttpServer())
      .patch("/api/v1/profile")
      .auth(second.headers["set-auth-token"], { type: "bearer" })
      .send({ hubDescription: "   " })
      .expect(200);
    expect(cleared.body.data.hubDescription).toBeNull();
    expect((await prisma.hub.findUniqueOrThrow({ where: { id } })).description).toBeNull();
  });
  it("lets owners hide attribution without clearing their account or hub names", async () => {
    const signed = await signInWithCode(app.getHttpServer(), {
      email: `attribution-${crypto.randomUUID()}@example.com`,
      name: "Owner Attribution",
    });
    const token = signed.headers["set-auth-token"];
    const patch = (body: object) =>
      request(app.getHttpServer())
        .patch("/api/v1/profile")
        .auth(token, { type: "bearer" })
        .send(body);
    const initial = await request(app.getHttpServer())
      .get("/api/v1/profile")
      .auth(token, { type: "bearer" })
      .expect(200);
    expect(initial.body.data.showNameOnHub).toBe(true);
    const { hubId, handle } = initial.body.data;
    const created = await request(app.getHttpServer())
      .post("/api/v1/collections")
      .auth(token, { type: "bearer" })
      .send({ title: "Attribution references", slug: "references", published: true })
      .expect(201);
    for (const invalid of [null, "false", 0]) await patch({ showNameOnHub: invalid }).expect(400);
    for (const enabled of [false, true]) {
      const saved = await patch({ showNameOnHub: enabled }).expect(200);
      expect(saved.body.data.showNameOnHub).toBe(enabled);
      expect(saved.body.data.displayName).toBe("Owner Attribution");
      const unchanged = await patch({ hubName: "Independent Hub" }).expect(200);
      expect(unchanged.body.data.showNameOnHub).toBe(enabled);
      for (const path of [`/api/v1/hubs/${hubId}`, `/api/v1/hubs/by-handle/${handle}`]) {
        const result = await request(app.getHttpServer()).get(path).expect(200);
        expect(result.body.data.hub).toMatchObject({
          name: "Independent Hub",
          handle,
          ownerName: enabled ? "Owner Attribution" : null,
        });
        expect(result.body.data.collections[0].hub.ownerName).toBeUndefined();
      }
      const discover = await request(app.getHttpServer())
        .get("/api/v1/discover?limit=100")
        .expect(200);
      expect(
        discover.body.data.find((item: { id: string }) => item.id === created.body.data.id).hub
          .ownerName,
      ).toBeUndefined();
    }
    await patch({ displayName: "   " }).expect(200);
    const blank = await request(app.getHttpServer()).get(`/api/v1/hubs/${hubId}`).expect(200);
    expect(blank.body.data.hub.ownerName).toBeNull();
  });
});
