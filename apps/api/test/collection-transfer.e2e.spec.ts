import { afterAll, beforeAll, describe, expect, it } from "bun:test";
import { INestApplication } from "@nestjs/common";
import { Test } from "@nestjs/testing";
import request from "supertest";
import { App } from "supertest/types";
import { AppModule } from "../src/app.module";
import { configureApp } from "../src/app.setup";

// Drive-style collection ownership transfer: only the owner can transfer, only
// to an existing editor; the collection moves into the recipient's hub and the
// previous owner keeps editor access in their shared/ surface.
describe("Collection transfer (e2e)", () => {
  let app: INestApplication<App>;
  const sfx = Date.now().toString(36);

  const signUp = async (label: string) => {
    const email = `${label}_${sfx}@example.com`;
    const res = await request(app.getHttpServer())
      .post("/api/v1/auth/sign-up/email")
      .send({ email, password: "Password123!", name: `${label} ${sfx}` })
      .expect(200);
    const bearer = res.headers["set-auth-token"];
    const profile = await request(app.getHttpServer())
      .get("/api/v1/profile")
      .set("Authorization", `Bearer ${bearer}`)
      .expect(200);
    return { bearer, email, userId: (profile.body as { data: { id: string } }).data.id };
  };

  const createCollection = async (bearer: string, slug: string) => {
    const res = await request(app.getHttpServer())
      .post("/api/v1/collections")
      .set("Authorization", `Bearer ${bearer}`)
      .send({ slug, title: slug })
      .expect(201);
    return (res.body as { data: { id: string } }).data.id;
  };

  beforeAll(async () => {
    const moduleFixture = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleFixture.createNestApplication<INestApplication<App>>({ bodyParser: false });
    configureApp(app);
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  it("transfers ownership to an existing editor and flips authority", async () => {
    const alice = await signUp("owner");
    const bob = await signUp("editor");
    const cid = await createCollection(alice.bearer, `xfer-${sfx}`);

    // Alice shares with Bob as editor (the precondition for transfer).
    await request(app.getHttpServer())
      .post(`/api/v1/collections/${cid}/shares`)
      .set("Authorization", `Bearer ${alice.bearer}`)
      .send({ email: bob.email, role: "editor" })
      .expect(201);

    // Transfer.
    const res = await request(app.getHttpServer())
      .post(`/api/v1/collections/${cid}/transfer`)
      .set("Authorization", `Bearer ${alice.bearer}`)
      .send({ email: bob.email })
      .expect(201);
    expect((res.body as { data: { transferredTo: string } }).data.transferredTo).toBe(bob.userId);

    // Bob now owns it: he can manage (publish).
    await request(app.getHttpServer())
      .post(`/api/v1/collections/${cid}/publish`)
      .set("Authorization", `Bearer ${bob.bearer}`)
      .expect(201);

    // Alice can no longer manage it (403), but still reads it as an editor.
    await request(app.getHttpServer())
      .post(`/api/v1/collections/${cid}/publish`)
      .set("Authorization", `Bearer ${alice.bearer}`)
      .expect(403);
    await request(app.getHttpServer())
      .get(`/api/v1/collections/${cid}/resources`)
      .set("Authorization", `Bearer ${alice.bearer}`)
      .expect(200);

    // It lands in Alice's shared/ surface.
    const shared = await request(app.getHttpServer())
      .get("/api/v1/me/shared")
      .set("Authorization", `Bearer ${alice.bearer}`)
      .expect(200);
    expect(JSON.stringify(shared.body)).toContain(cid);
  });

  it("leaves other editors and viewers untouched after transfer", async () => {
    const alice = await signUp("owner3");
    const bob = await signUp("newowner3");
    const dave = await signUp("editor3");
    const eve = await signUp("viewer3");
    const cid = await createCollection(alice.bearer, `xfer3-${sfx}`);

    // Bob is the transfer target (editor); Dave is a third-party editor; Eve a
    // third-party reader. Only Bob and the previous owner should change.
    for (const [who, role] of [
      [bob, "editor"],
      [dave, "editor"],
      [eve, "reader"],
    ] as const) {
      await request(app.getHttpServer())
        .post(`/api/v1/collections/${cid}/shares`)
        .set("Authorization", `Bearer ${alice.bearer}`)
        .send({ email: who.email, role })
        .expect(201);
    }

    await request(app.getHttpServer())
      .post(`/api/v1/collections/${cid}/transfer`)
      .set("Authorization", `Bearer ${alice.bearer}`)
      .send({ email: bob.email })
      .expect(201);

    // Dave still has editor access — can write content.
    await request(app.getHttpServer())
      .post(`/api/v1/collections/${cid}/resources/external`)
      .set("Authorization", `Bearer ${dave.bearer}`)
      .send({ url: `https://example.com/dave-${sfx}`, position: 0 })
      .expect(201);

    // Eve still has reader access — can read, cannot write.
    await request(app.getHttpServer())
      .get(`/api/v1/collections/${cid}/resources`)
      .set("Authorization", `Bearer ${eve.bearer}`)
      .expect(200);
    await request(app.getHttpServer())
      .post(`/api/v1/collections/${cid}/resources/external`)
      .set("Authorization", `Bearer ${eve.bearer}`)
      .send({ url: `https://example.com/eve-${sfx}`, position: 1 })
      .expect(403);
  });

  it("rejects transfer to a non-editor and to self", async () => {
    const alice = await signUp("owner2");
    const carol = await signUp("stranger");
    const cid = await createCollection(alice.bearer, `xfer2-${sfx}`);

    // Carol is not an editor → rejected.
    await request(app.getHttpServer())
      .post(`/api/v1/collections/${cid}/transfer`)
      .set("Authorization", `Bearer ${alice.bearer}`)
      .send({ email: carol.email })
      .expect(400);

    // Transferring to self → rejected.
    await request(app.getHttpServer())
      .post(`/api/v1/collections/${cid}/transfer`)
      .set("Authorization", `Bearer ${alice.bearer}`)
      .send({ email: alice.email })
      .expect(400);
  });
});
