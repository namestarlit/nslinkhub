import { afterAll, beforeAll, describe, expect, it } from "bun:test";
import { INestApplication } from "@nestjs/common";
import { Test } from "@nestjs/testing";
import request from "supertest";
import { App } from "supertest/types";
import { AppModule } from "../src/app.module";
import { configureApp } from "../src/app.setup";

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

  it("never auto-issues a reserved handle at sign-up", async () => {
    // "Explore" slugifies to the reserved handle "explore".
    const signUp = await request(app.getHttpServer())
      .post("/api/v1/auth/sign-up/email")
      .send({ email: `explore_${sfx}@example.com`, password: "Password123!", name: "Explore" })
      .expect(200);
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
    const signUp = await request(app.getHttpServer())
      .post("/api/v1/auth/sign-up/email")
      .send({ email: `hname_${sfx}@example.com`, password: "Password123!", name: `hname ${sfx}` })
      .expect(200);
    const bearer = signUp.headers["set-auth-token"];

    await request(app.getHttpServer())
      .patch("/api/v1/profile")
      .set("Authorization", `Bearer ${bearer}`)
      .send({ handle: "api" })
      .expect(400);
  });
});
