import { afterAll, beforeAll, describe, expect, it } from "bun:test";
import { INestApplication } from "@nestjs/common";
import { Test } from "@nestjs/testing";
import request from "supertest";
import { App } from "supertest/types";
import { AppModule } from "../src/app.module";
import { configureApp } from "../src/app.setup";

// Phase D: invitations, membership management, and ownership transfer.
describe("Hub members and invitations (e2e)", () => {
  let app: INestApplication<App>;
  const sfx = Date.now().toString(36);

  interface Account {
    bearer: string;
    userId: string;
    username: string;
    email: string;
  }

  const signUp = async (tag: string): Promise<Account> => {
    const username = `${tag}_${sfx}`;
    const email = `${username}@example.com`;
    const res = await request(app.getHttpServer())
      .post("/api/v1/auth/sign-up/email")
      .send({ email, password: "Password123!", name: username, username })
      .expect(200);
    const profile = await request(app.getHttpServer()).get(`/api/v1/users/${username}`).expect(200);
    return {
      bearer: res.headers["set-auth-token"],
      userId: (profile.body as { data: { id: string } }).data.id,
      username,
      email,
    };
  };

  let owner: Account;
  let invitee: Account;
  let other: Account;
  let hubId: string;

  const invite = async (bearer: string, email: string, role: string, status: number) =>
    request(app.getHttpServer())
      .post(`/api/v1/hubs/${hubId}/invitations`)
      .set("Authorization", `Bearer ${bearer}`)
      .send({ email, role })
      .expect(status);

  beforeAll(async () => {
    const moduleFixture = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();
    app = moduleFixture.createNestApplication<INestApplication<App>>({
      bodyParser: false,
    });
    configureApp(app);
    await app.init();

    owner = await signUp("own");
    invitee = await signUp("inv");
    other = await signUp("oth");

    const col = await request(app.getHttpServer())
      .post("/api/v1/collections")
      .set("Authorization", `Bearer ${owner.bearer}`)
      .send({ slug: `hubcol-${sfx}`, title: "Hub Col" })
      .expect(201);
    hubId = (col.body as { data: { hubId: string } }).data.hubId;
  });

  afterAll(async () => {
    await app.close();
  });

  it("invites and accepts, granting hub content write", async () => {
    const created = await invite(owner.bearer, invitee.email, "member", 201);
    const token = (created.body as { data: { token: string } }).data.token;

    // Wrong account cannot accept (email mismatch).
    await request(app.getHttpServer())
      .post("/api/v1/invitations/accept")
      .set("Authorization", `Bearer ${other.bearer}`)
      .send({ token })
      .expect(403);

    // The invited account accepts.
    await request(app.getHttpServer())
      .post("/api/v1/invitations/accept")
      .set("Authorization", `Bearer ${invitee.bearer}`)
      .send({ token })
      .expect(201);

    // Now a member: can create a collection in the shared hub's content.
    const col = await request(app.getHttpServer())
      .post("/api/v1/collections")
      .set("Authorization", `Bearer ${owner.bearer}`)
      .send({ slug: `shared-col-${sfx}`, title: "Shared" })
      .expect(201);
    const colId = (col.body as { data: { id: string } }).data.id;
    await request(app.getHttpServer())
      .post(`/api/v1/collections/${colId}/resources/external`)
      .set("Authorization", `Bearer ${invitee.bearer}`)
      .send({ url: `https://example.com/hm-${sfx}`, position: 0 })
      .expect(201);

    // A used token cannot be reused.
    await request(app.getHttpServer())
      .post("/api/v1/invitations/accept")
      .set("Authorization", `Bearer ${invitee.bearer}`)
      .send({ token })
      .expect(400);
  });

  it("gates invitation roles: member cannot invite; admin cannot grant admin", async () => {
    // invitee is a plain member at this point -> cannot invite at all.
    await invite(invitee.bearer, other.email, "member", 403);

    // Owner promotes invitee to admin.
    await request(app.getHttpServer())
      .patch(`/api/v1/hubs/${hubId}/members/${invitee.userId}`)
      .set("Authorization", `Bearer ${owner.bearer}`)
      .send({ role: "admin" })
      .expect(200);

    // Admin can invite a member but not an admin.
    await invite(invitee.bearer, other.email, "admin", 403);
    await invite(invitee.bearer, other.email, "member", 201);
  });

  it("lists members and enforces the last-owner rule", async () => {
    const members = await request(app.getHttpServer())
      .get(`/api/v1/hubs/${hubId}/members`)
      .set("Authorization", `Bearer ${owner.bearer}`)
      .expect(200);
    const roles = (members.body as { data: Array<{ userId: string; role: string }> }).data;
    expect(roles.find((m) => m.userId === owner.userId)?.role).toBe("owner");
    expect(roles.find((m) => m.userId === invitee.userId)?.role).toBe("admin");

    // The sole owner cannot leave.
    await request(app.getHttpServer())
      .delete(`/api/v1/hubs/${hubId}/members/${owner.userId}`)
      .set("Authorization", `Bearer ${owner.bearer}`)
      .expect(400);
  });

  it("transfers ownership explicitly", async () => {
    // invitee is currently admin; transfer ownership to them.
    await request(app.getHttpServer())
      .post(`/api/v1/hubs/${hubId}/transfer-ownership`)
      .set("Authorization", `Bearer ${owner.bearer}`)
      .send({ userId: invitee.userId })
      .expect(201);

    const members = await request(app.getHttpServer())
      .get(`/api/v1/hubs/${hubId}/members`)
      .set("Authorization", `Bearer ${invitee.bearer}`)
      .expect(200);
    const roles = (members.body as { data: Array<{ userId: string; role: string }> }).data;
    expect(roles.find((m) => m.userId === invitee.userId)?.role).toBe("owner");
    expect(roles.find((m) => m.userId === owner.userId)?.role).toBe("admin");

    // The former owner (now admin) can no longer transfer ownership.
    await request(app.getHttpServer())
      .post(`/api/v1/hubs/${hubId}/transfer-ownership`)
      .set("Authorization", `Bearer ${owner.bearer}`)
      .send({ userId: owner.userId })
      .expect(403);
  });
});
