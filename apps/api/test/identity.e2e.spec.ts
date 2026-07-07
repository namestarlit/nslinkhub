import { afterAll, beforeAll, describe, expect, it } from "bun:test";
import { INestApplication } from "@nestjs/common";
import { Test } from "@nestjs/testing";
import request from "supertest";
import { App } from "supertest/types";
import { AppModule } from "../src/app.module";
import { configureApp } from "../src/app.setup";

// The Google-Drive identity model: one hub per user, a derived unique handle
// (the mutable public identity) and a free-form display name; no username.
describe("Identity & profile (e2e)", () => {
  let app: INestApplication<App>;
  const sfx = Date.now().toString(36);

  const signUp = async (name: string, email: string) => {
    const res = await request(app.getHttpServer())
      .post("/api/v1/auth/sign-up/email")
      .send({ email, password: "Password123!", name })
      .expect(200);
    return res.headers["set-auth-token"];
  };

  const profile = async (bearer: string) =>
    (
      await request(app.getHttpServer())
        .get("/api/v1/profile")
        .set("Authorization", `Bearer ${bearer}`)
        .expect(200)
    ).body as {
      data: { displayName: string; handle: string; hubId: string };
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

  it("gives each user one hub with a derived handle and a display name", async () => {
    const name = `Ada ${sfx}`;
    const bearer = await signUp(name, `ada_${sfx}@example.com`);
    const { data } = await profile(bearer);

    expect(data.displayName).toBe(name);
    expect(data.hubId).toBeTruthy();
    expect(data.handle).toMatch(/^ada-/);
  });

  it("derives distinct handles when two users share a name", async () => {
    const name = `Grace ${sfx}`;
    const a = await profile(await signUp(name, `grace1_${sfx}@example.com`));
    const b = await profile(await signUp(name, `grace2_${sfx}@example.com`));
    expect(a.data.handle).not.toBe(b.data.handle);
  });

  it("renames the handle and rejects reserved handles", async () => {
    const bearer = await signUp(`Linus ${sfx}`, `linus_${sfx}@example.com`);
    const newHandle = `renamed-${sfx}`;

    await request(app.getHttpServer())
      .patch("/api/v1/profile")
      .set("Authorization", `Bearer ${bearer}`)
      .send({ handle: newHandle })
      .expect(200);

    const { data } = await profile(bearer);
    expect(data.handle).toBe(newHandle);

    await request(app.getHttpServer())
      .patch("/api/v1/profile")
      .set("Authorization", `Bearer ${bearer}`)
      .send({ handle: "api" })
      .expect(400);
  });
});
