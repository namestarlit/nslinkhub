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

  it("nests an existing collection and enforces the two-level limit", async () => {
    const alice = await signUp("s_depth");
    const nest = (containerId: string, collectionId: string) =>
      request(app.getHttpServer())
        .post(`/api/v1/collections/${containerId}/collections`)
        .set("Authorization", `Bearer ${alice}`)
        .send({ collectionId });

    const root = await createCollection(alice, `root-${sfx}`);
    const section = await createCollection(alice, `sec-${sfx}`);
    const other = await createCollection(alice, `other-${sfx}`);

    // Nest an existing collection into a top-level collection — allowed.
    await nest(root, section).expect(201);

    // A section cannot contain collections (would be depth 3).
    await nest(section, other).expect(400);

    // A collection already nested elsewhere cannot be nested again.
    await nest(other, section).expect(400);

    // A collection that already has sections cannot itself be nested.
    const otherRoot = await createCollection(alice, `oroot-${sfx}`);
    await nest(otherRoot, root).expect(400);
  });

  it("removing a section entry un-nests the collection", async () => {
    const alice = await signUp("s_unnest");
    const root = await createCollection(alice, `unroot-${sfx}`);
    const sec = await createCollection(alice, `unsec-${sfx}`);
    const dest = await createCollection(alice, `undest-${sfx}`);

    await request(app.getHttpServer())
      .post(`/api/v1/collections/${root}/collections`)
      .set("Authorization", `Bearer ${alice}`)
      .send({ collectionId: sec })
      .expect(201);

    // While nested, it cannot be nested elsewhere.
    await request(app.getHttpServer())
      .post(`/api/v1/collections/${dest}/collections`)
      .set("Authorization", `Bearer ${alice}`)
      .send({ collectionId: sec })
      .expect(400);

    // Remove the section entry from root.
    const resources = await request(app.getHttpServer())
      .get(`/api/v1/collections/${root}/resources`)
      .set("Authorization", `Bearer ${alice}`)
      .expect(200);
    const entry = (
      resources.body as {
        data: Array<{ id: string; linkedCollectionId: string | null }>;
      }
    ).data.find((r) => r.linkedCollectionId === sec);
    await request(app.getHttpServer())
      .delete(`/api/v1/collections/${root}/resources/${entry?.id}`)
      .set("Authorization", `Bearer ${alice}`)
      .expect(200);

    // Now it is free to nest elsewhere (proving it was un-nested).
    await request(app.getHttpServer())
      .post(`/api/v1/collections/${dest}/collections`)
      .set("Authorization", `Bearer ${alice}`)
      .send({ collectionId: sec })
      .expect(201);
  });
});
