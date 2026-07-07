import { afterAll, beforeAll, describe, it } from "bun:test";
import { INestApplication } from "@nestjs/common";
import { Test } from "@nestjs/testing";
import request from "supertest";
import { App } from "supertest/types";
import { AppModule } from "../src/app.module";
import { configureApp } from "../src/app.setup";

// Locks two structural rules: collection-links stay within the owner's hub, and
// collections nest at most two levels (a collection and its sections).
describe("Collection structure limits (e2e)", () => {
  let app: INestApplication<App>;
  const sfx = Date.now().toString(36);

  const signUp = async (label: string) => {
    const res = await request(app.getHttpServer())
      .post("/api/v1/auth/sign-up/email")
      .send({ email: `${label}_${sfx}@example.com`, password: "Password123!", name: label })
      .expect(200);
    return res.headers["set-auth-token"] as string;
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

  it("a collection-link must target a collection in the same hub", async () => {
    const alice = await signUp("s_alice");
    const bob = await signUp("s_bob");
    const a1 = await createCollection(alice, `a1-${sfx}`);
    const a2 = await createCollection(alice, `a2-${sfx}`);
    const b1 = await createCollection(bob, `b1-${sfx}`);

    // Same-hub link is allowed.
    await request(app.getHttpServer())
      .post(`/api/v1/collections/${a1}/resources/collection-link`)
      .set("Authorization", `Bearer ${alice}`)
      .send({ linkedCollectionId: a2, position: 0 })
      .expect(201);

    // Cross-hub link is rejected (no embedding another hub's collection).
    await request(app.getHttpServer())
      .post(`/api/v1/collections/${a1}/resources/collection-link`)
      .set("Authorization", `Bearer ${alice}`)
      .send({ linkedCollectionId: b1, position: 1 })
      .expect(400);
  });

  it("enforces a two-level nesting limit", async () => {
    const alice = await signUp("s_depth");
    const root = await createCollection(alice, `root-${sfx}`);

    // A section (child of a root) is allowed.
    const section = await request(app.getHttpServer())
      .post(`/api/v1/collections/${root}/children`)
      .set("Authorization", `Bearer ${alice}`)
      .send({ slug: `sec-${sfx}`, title: "Section" })
      .expect(201);
    const sid = (section.body as { data: { id: string } }).data.id;

    // A sub-section (child of a section) is rejected.
    await request(app.getHttpServer())
      .post(`/api/v1/collections/${sid}/children`)
      .set("Authorization", `Bearer ${alice}`)
      .send({ slug: `sub-${sfx}`, title: "Sub" })
      .expect(400);

    // Re-parenting a root under a section is rejected (would be depth 3).
    const other = await createCollection(alice, `other-${sfx}`);
    await request(app.getHttpServer())
      .patch(`/api/v1/collections/${other}`)
      .set("Authorization", `Bearer ${alice}`)
      .send({ parentCollectionId: sid, version: 1 })
      .expect(400);

    // A collection that already has sections cannot itself be nested.
    const otherRoot = await createCollection(alice, `oroot-${sfx}`);
    await request(app.getHttpServer())
      .patch(`/api/v1/collections/${root}`)
      .set("Authorization", `Bearer ${alice}`)
      .send({ parentCollectionId: otherRoot, version: 1 })
      .expect(400);
  });
});
