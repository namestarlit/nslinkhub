import { afterAll, beforeAll, describe, expect, it } from "bun:test";
import { INestApplication } from "@nestjs/common";
import { Test } from "@nestjs/testing";
import request, { Response as SupertestResponse } from "supertest";
import { App } from "supertest/types";
import { AppModule } from "../src/app.module";
import { configureApp } from "../src/app.setup";

// Collects binary bodies (pdf/docx/zip) that supertest would otherwise drop.
function binaryParser(res: SupertestResponse, callback: (err: null, body: Buffer) => void) {
  const chunks: Buffer[] = [];
  res.on("data", (chunk: Buffer) => chunks.push(chunk));
  res.on("end", () => callback(null, Buffer.concat(chunks)));
}

// Locks synchronous export: one request, the response body IS the file.
// Sections expand by default; expand:false collapses them; several
// collections come back as a zip.
describe("Export (e2e)", () => {
  let app: INestApplication<App>;
  let bearer: string;
  let otherBearer: string;
  let guide: string;
  let section: string;
  const sfx = Date.now().toString(36);

  const signUp = async (email: string, name: string) => {
    const res = await request(app.getHttpServer())
      .post("/api/v1/auth/sign-up/email")
      .send({ email, password: "Password123!", name })
      .expect(200);
    return res.headers["set-auth-token"];
  };
  const createCollection = async (slug: string) => {
    const res = await request(app.getHttpServer())
      .post("/api/v1/collections")
      .set("Authorization", `Bearer ${bearer}`)
      .send({ slug, title: slug })
      .expect(201);
    return (res.body as { data: { id: string } }).data.id;
  };
  const addLink = (collectionId: string, url: string, position: number) =>
    request(app.getHttpServer())
      .post(`/api/v1/collections/${collectionId}/resources/external`)
      .set("Authorization", `Bearer ${bearer}`)
      .send({ url, position });
  const exportAs = (body: Record<string, unknown>, token = bearer) =>
    request(app.getHttpServer())
      .post("/api/v1/exports")
      .set("Authorization", `Bearer ${token}`)
      .send(body)
      .buffer(true)
      .parse(binaryParser);

  beforeAll(async () => {
    const moduleFixture = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleFixture.createNestApplication<INestApplication<App>>({ bodyParser: false });
    configureApp(app);
    await app.init();
    bearer = await signUp(`exp_${sfx}@example.com`, `exp ${sfx}`);
    otherBearer = await signUp(`exp2_${sfx}@example.com`, `exp2 ${sfx}`);

    guide = await createCollection(`guide-${sfx}`);
    section = await createCollection(`section-${sfx}`);
    await addLink(guide, `https://example.com/top-${sfx}`, 0).expect(201);
    await addLink(section, `https://example.com/sec-${sfx}`, 0).expect(201);
    await request(app.getHttpServer())
      .post(`/api/v1/collections/${guide}/collections`)
      .set("Authorization", `Bearer ${bearer}`)
      .send({ collectionId: section })
      .expect(201);
  });

  afterAll(async () => {
    await app.close();
  });

  it("exports one collection as markdown, expanding sections by default", async () => {
    const res = await exportAs({ format: "markdown", collectionIds: [guide] }).expect(201);
    expect(res.headers["content-type"]).toContain("text/markdown");
    expect(res.headers["content-disposition"]).toContain(`guide-${sfx}.md`);
    const content = (res.body as Buffer).toString("utf8");
    expect(content).toContain(`# guide-${sfx}`);
    expect(content).toContain(`## section-${sfx}`);
    expect(content).toContain(`https://example.com/top-${sfx}`);
    expect(content).toContain(`https://example.com/sec-${sfx}`);
  });

  it("collapses sub-collections to a line when expand is false", async () => {
    const res = await exportAs({
      format: "markdown",
      collectionIds: [guide],
      expand: false,
    }).expect(201);
    const content = (res.body as Buffer).toString("utf8");
    expect(content).not.toContain(`## section-${sfx}`);
    expect(content).not.toContain(`https://example.com/sec-${sfx}`);
    expect(content).toContain(`section-${sfx} _(collection)_`);
  });

  it("zips the documents when several collections are selected", async () => {
    const res = await exportAs({ format: "markdown", collectionIds: [guide, section] }).expect(201);
    expect(res.headers["content-type"]).toContain("application/zip");
    expect((res.body as Buffer).subarray(0, 2).toString("latin1")).toBe("PK");
  });

  it("renders pdf and docx", async () => {
    const pdf = await exportAs({ format: "pdf", collectionIds: [guide] }).expect(201);
    expect(pdf.headers["content-type"]).toContain("application/pdf");
    expect((pdf.body as Buffer).subarray(0, 4).toString("latin1")).toBe("%PDF");

    const docx = await exportAs({ format: "docx", collectionIds: [guide] }).expect(201);
    expect(docx.headers["content-type"]).toContain("wordprocessingml");
    expect((docx.body as Buffer).subarray(0, 2).toString("latin1")).toBe("PK");
  });

  it("rejects the whole request when any collection is unreadable", async () => {
    // 404, not 403: unreadable collections must not leak their existence.
    await exportAs({ format: "markdown", collectionIds: [guide] }, otherBearer).expect(404);
  });
});
