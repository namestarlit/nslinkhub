import { afterAll, beforeAll, beforeEach, describe, expect, it } from "bun:test";
import { randomUUID } from "node:crypto";
import type { INestApplication } from "@nestjs/common";
import { Test } from "@nestjs/testing";
import request from "supertest";
import { AppModule } from "../src/app.module";
import { configureApp } from "../src/app.setup";
import { PrismaService } from "../src/database/prisma.service";
import { signInWithCode } from "./fixtures/sign-in";

describe("activity and attribution", () => {
  let app: INestApplication, prisma: PrismaService;
  let owner: string, editor: string, reader: string, stranger: string;
  let editorEmail: string, readerEmail: string, editorId: string, ownerId: string;
  let ownerHandle: string, editorHandle: string;
  const api = () => request(app.getHttpServer());

  beforeAll(async () => {
    const module = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = module.createNestApplication({ bodyParser: false });
    configureApp(app);
    await app.init();
    prisma = app.get(PrismaService);
    const login = async (label: string, name: string) => {
      const email = `${label}-${randomUUID()}@example.com`;
      const res = await signInWithCode(app.getHttpServer(), { email, name });
      return { token: res.headers["set-auth-token"] as string, email, id: res.body.user.id };
    };
    const o = await login("activity-owner", "Owner Person");
    const e = await login("activity-editor", "Editor Person");
    const r = await login("activity-reader", "Reader Person");
    const s = await login("activity-stranger", "Stranger");
    [owner, editor, reader, stranger] = [o.token, e.token, r.token, s.token];
    [editorEmail, readerEmail, editorId, ownerId] = [e.email, r.email, e.id, o.id];
    const handle = async (email: string) =>
      (await prisma.hub.findFirstOrThrow({ where: { owner: { email } } })).handle;
    [ownerHandle, editorHandle] = [await handle(o.email), await handle(e.email)];
  });
  beforeEach(async () => {
    await prisma.requestBudget.deleteMany();
  });
  afterAll(async () => {
    await app.close();
  });

  it("records content changes and derives contributors, addedBy and history from them", async () => {
    const created = await api()
      .post("/api/v1/collections")
      .auth(owner, { type: "bearer" })
      .send({ slug: `act-${randomUUID().slice(0, 8)}`, title: "Guide" })
      .expect(201);
    const id = created.body.data.id as string;
    for (const [email, role] of [
      [editorEmail, "editor"],
      [readerEmail, "reader"],
    ])
      await api()
        .post(`/api/v1/collections/${id}/shares`)
        .auth(owner, { type: "bearer" })
        .send({ email, role })
        .expect(201);

    // The editor adds a link and a section; the owner renames the collection.
    const link = await api()
      .post(`/api/v1/collections/${id}/resources/external`)
      .auth(editor, { type: "bearer" })
      .send({ url: `https://fixture-links.dev/act-${randomUUID()}`, position: 0 })
      .expect(201);
    // People appear by @handle only; names are never sent (only the hub page has one).
    expect(link.body.data.addedBy).toEqual({ hubId: expect.any(String), handle: editorHandle });
    const section = await api()
      .post(`/api/v1/collections/${id}/resources/heading`)
      .auth(editor, { type: "bearer" })
      .send({ title: "Basics", position: 1 })
      .expect(201);
    const current = await api().get(`/api/v1/collections/${id}`).auth(owner, { type: "bearer" });
    await api()
      .patch(`/api/v1/collections/${id}`)
      .auth(owner, { type: "bearer" })
      .send({ title: "Guide, renamed", version: current.body.data.version })
      .expect(200);

    // A no-op save (same title) records nothing.
    const again = await api().get(`/api/v1/collections/${id}`).auth(owner, { type: "bearer" });
    await api()
      .patch(`/api/v1/collections/${id}`)
      .auth(owner, { type: "bearer" })
      .send({ title: "Guide, renamed", version: again.body.data.version })
      .expect(200);

    const entries = await prisma.auditRecord.findMany({
      where: { collectionId: id },
      orderBy: { createdAt: "asc" },
    });
    expect(entries.map((e) => [e.action, e.actorUserId, e.resourceId])).toEqual([
      ["collection.created", ownerId, null],
      ["share.granted", ownerId, null],
      ["share.granted", ownerId, null],
      ["item.link_added", editorId, link.body.data.id],
      ["item.section_added", editorId, section.body.data.id],
      ["collection.updated", ownerId, null],
    ]);

    // Contributors: everyone who shaped the content, most recent first.
    const view = await api().get(`/api/v1/collections/${id}`).auth(reader, { type: "bearer" });
    expect(view.body.data.contributors.total).toBe(2);
    expect(view.body.data.contributors.people.map((p: { handle: string }) => p.handle)).toEqual([
      ownerHandle,
      editorHandle,
    ]);
    expect(JSON.stringify(view.body)).not.toContain("Owner Person");

    // Readers see items' adders; history is for contributors only.
    const items = await api()
      .get(`/api/v1/collections/${id}/resources`)
      .auth(reader, { type: "bearer" })
      .expect(200);
    expect(items.body.data[0].addedBy.handle).toBeString();
    await api()
      .get(`/api/v1/collections/${id}/activity`)
      .auth(reader, { type: "bearer" })
      .expect(403);
    await api()
      .get(`/api/v1/collections/${id}/activity`)
      .auth(stranger, { type: "bearer" })
      .expect(404);

    // Removing an item keeps its history, without the item.
    await api()
      .delete(`/api/v1/collections/${id}/resources/${section.body.data.id}`)
      .auth(editor, { type: "bearer" })
      .expect(200);
    const history = await api()
      .get(`/api/v1/collections/${id}/activity?limit=3`)
      .auth(editor, { type: "bearer" })
      .expect(200);
    expect(history.body.data.map((e: { action: string }) => e.action)).toEqual([
      "item.removed",
      "collection.updated",
      "item.section_added",
    ]);
    expect(history.body.data[0]).toMatchObject({
      actor: { handle: editorHandle },
      item: null,
    });
    const next = await api()
      .get(
        `/api/v1/collections/${id}/activity?limit=3&cursor=${encodeURIComponent(history.body.meta.nextCursor)}`,
      )
      .auth(owner, { type: "bearer" })
      .expect(200);
    expect(next.body.data.map((e: { action: string }) => e.action)).toEqual([
      "item.link_added",
      "share.granted",
      "share.granted",
    ]);
    expect(next.body.data[0].item).toMatchObject({ kind: "external_link" });
    expect(next.body.data[1].target).not.toBeNull();

    // Who has access is the owner's to see: an editor's history leaves out
    // sharing entries and never names the reader.
    const editorView = await api()
      .get(`/api/v1/collections/${id}/activity?limit=100`)
      .auth(editor, { type: "bearer" })
      .expect(200);
    const readerHub = await prisma.hub.findFirstOrThrow({
      where: { owner: { email: readerEmail } },
    });
    expect(editorView.body.data.map((e: { action: string }) => e.action)).not.toContain(
      "share.granted",
    );
    expect(JSON.stringify(editorView.body)).not.toContain(readerHub.handle);
  });

  it("writes nothing when the change fails", async () => {
    const created = await api()
      .post("/api/v1/collections")
      .auth(owner, { type: "bearer" })
      .send({ slug: `act-fail-${randomUUID().slice(0, 8)}`, title: "Fails" })
      .expect(201);
    const id = created.body.data.id as string;
    const url = `https://fixture-links.dev/act-dup-${randomUUID()}`;
    await api()
      .post(`/api/v1/collections/${id}/resources/external`)
      .auth(owner, { type: "bearer" })
      .send({ url, position: 0 })
      .expect(201);
    const before = await prisma.auditRecord.count({ where: { collectionId: id } });
    await api()
      .post(`/api/v1/collections/${id}/resources/external`)
      .auth(owner, { type: "bearer" })
      .send({ url, position: 1 })
      .expect((res) => expect(res.status).toBeGreaterThanOrEqual(400));
    expect(await prisma.auditRecord.count({ where: { collectionId: id } })).toBe(before);
  });
});
