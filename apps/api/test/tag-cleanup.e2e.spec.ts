import { afterAll, beforeAll, describe, expect, it } from "bun:test";
import { INestApplication } from "@nestjs/common";
import { Test } from "@nestjs/testing";
import request from "supertest";
import { App } from "supertest/types";
import { AppModule } from "../src/app.module";
import { configureApp } from "../src/app.setup";
import { PrismaService } from "../src/database/prisma.service";

// Locks the "no dangling tags" behavior: a global tag survives while any
// collection/resource still references it, and is deleted once the last
// reference (via detach or a cascading delete) is gone.
describe("Tag cleanup (e2e)", () => {
  let app: INestApplication<App>;
  let prisma: PrismaService;
  let bearer: string;
  let collectionId: string;
  let resourceId: string;
  const sfx = Date.now().toString(36);
  const tagName = (label: string) => `tag${label}${sfx}`;

  const tagExists = async (name: string) =>
    (await prisma.tag.findUnique({ where: { name } })) !== null;

  beforeAll(async () => {
    const moduleFixture = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();
    app = moduleFixture.createNestApplication<INestApplication<App>>({
      bodyParser: false,
    });
    configureApp(app);
    await app.init();
    prisma = app.get(PrismaService);

    const signUp = await request(app.getHttpServer())
      .post("/api/v1/auth/sign-up/email")
      .send({
        email: `tag_${sfx}@example.com`,
        password: "Password123!",
        name: `tag_${sfx}`,
      })
      .expect(200);
    bearer = signUp.headers["set-auth-token"];

    const collection = await request(app.getHttpServer())
      .post("/api/v1/collections")
      .set("Authorization", `Bearer ${bearer}`)
      .send({ slug: `tag-col-${sfx}`, title: "Tag Target" })
      .expect(201);
    collectionId = (collection.body as { data: { id: string } }).data.id;

    const resource = await request(app.getHttpServer())
      .post(`/api/v1/collections/${collectionId}/resources/external`)
      .set("Authorization", `Bearer ${bearer}`)
      .send({ url: `https://example.com/tag-${sfx}`, position: 0 })
      .expect(201);
    resourceId = (resource.body as { data: { id: string } }).data.id;
  });

  afterAll(async () => {
    await app.close();
  });

  it("keeps a tag while any reference remains, deletes it when the last goes", async () => {
    const name = tagName("shared");

    await request(app.getHttpServer())
      .post(`/api/v1/resources/${resourceId}/tags`)
      .set("Authorization", `Bearer ${bearer}`)
      .send({ name })
      .expect(201);
    await request(app.getHttpServer())
      .post(`/api/v1/collections/${collectionId}/tags`)
      .set("Authorization", `Bearer ${bearer}`)
      .send({ name })
      .expect(201);
    expect(await tagExists(name)).toBe(true);

    // Remove one of two references — the tag survives.
    await request(app.getHttpServer())
      .delete(`/api/v1/resources/${resourceId}/tags/${name}`)
      .set("Authorization", `Bearer ${bearer}`)
      .expect(200);
    expect(await tagExists(name)).toBe(true);

    // Remove the last reference — the tag is pruned.
    await request(app.getHttpServer())
      .delete(`/api/v1/collections/${collectionId}/tags/${name}`)
      .set("Authorization", `Bearer ${bearer}`)
      .expect(200);
    expect(await tagExists(name)).toBe(false);
  });

  it("prunes a tag orphaned by deleting its only resource", async () => {
    const name = tagName("ondelete");

    const resource = await request(app.getHttpServer())
      .post(`/api/v1/collections/${collectionId}/resources/external`)
      .set("Authorization", `Bearer ${bearer}`)
      .send({ url: `https://example.com/tag-del-${sfx}`, position: 1 })
      .expect(201);
    const rid = (resource.body as { data: { id: string } }).data.id;

    await request(app.getHttpServer())
      .post(`/api/v1/resources/${rid}/tags`)
      .set("Authorization", `Bearer ${bearer}`)
      .send({ name })
      .expect(201);
    expect(await tagExists(name)).toBe(true);

    await request(app.getHttpServer())
      .delete(`/api/v1/collections/${collectionId}/resources/${rid}`)
      .set("Authorization", `Bearer ${bearer}`)
      .expect(200);
    expect(await tagExists(name)).toBe(false);
  });
});
