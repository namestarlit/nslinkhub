import { afterAll, beforeAll, describe, expect, it, spyOn } from "bun:test";
import http from "node:http";
import { INestApplication } from "@nestjs/common";
import { INTERCEPTORS_METADATA } from "@nestjs/common/constants";
import { Test } from "@nestjs/testing";
import request from "supertest";
import { App } from "supertest/types";
import { AppModule } from "../src/app.module";
import { configureApp } from "../src/app.setup";
import { PrismaService } from "../src/database/prisma.service";
import { ImportsController } from "../src/modules/imports/imports.controller";
import { signInWithCode } from "./fixtures/sign-in";

// Locks the import response contract: camelCase keys, partial-failure counts.
describe("Imports (e2e)", () => {
  let app: INestApplication<App>;
  let bearer: string;
  let collectionId: string;
  let userId: string;
  const sfx = Date.now().toString(36);

  beforeAll(async () => {
    const moduleFixture = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();
    app = moduleFixture.createNestApplication<INestApplication<App>>({
      bodyParser: false,
    });
    configureApp(app);
    await app.init();

    const signUp = await signInWithCode(app.getHttpServer(), {
      email: `imp_${sfx}@example.com`,
      name: `imp_${sfx}`,
    });
    bearer = signUp.headers["set-auth-token"];
    userId = signUp.body.user.id;

    const collection = await request(app.getHttpServer())
      .post("/api/v1/collections")
      .set("Authorization", `Bearer ${bearer}`)
      .send({ slug: `imp-col-${sfx}`, title: "Import Target" })
      .expect(201);
    collectionId = (collection.body as { data: { id: string } }).data.id;
  });

  afterAll(async () => {
    await app.close();
  });

  it("imports a CSV and reports camelCase counts", async () => {
    const csv = `url,title\nhttps://fixture-links.dev/imp-${sfx}-a,A\nhttps://fixture-links.dev/imp-${sfx}-b,B\nnot-a-url,Bad\n`;

    const res = await request(app.getHttpServer())
      .post("/api/v1/imports/csv")
      .set("Authorization", `Bearer ${bearer}`)
      .field("targetCollectionId", collectionId)
      .attach("file", Buffer.from(csv), "import.csv")
      .expect(201);

    const body = res.body as {
      data: {
        totalRows: number;
        processedRows: number;
        importedCount: number;
        skippedCount: number;
        errorCount: number;
        errors: Array<{ row: number; reason: string; value: string }>;
      };
    };

    expect(body.data.importedCount).toBe(2);
    expect(body.data.errorCount).toBe(1);
    expect(body.data.totalRows).toBe(3);
    // No snake_case keys leaked into the payload.
    expect(Object.keys(body.data)).not.toContain("imported_count");
  });
  it("commits valid CSV and bookmark rows on both sides of a database-invalid row", async () => {
    const prisma = app.get(PrismaService);
    for (const kind of ["csv", "bookmarks-html"]) {
      const urls = [0, 1, 2].map((n) => `https://fixture-links.dev/${kind}-${sfx}-${n}`);
      const titles = ["Before", "x".repeat(256), "After"];
      const text =
        kind === "csv"
          ? `url,title\n${urls.map((url, n) => `${url},${titles[n]}`).join("\n")}`
          : urls.map((url, n) => `<A HREF="${url}">${titles[n]}</A>`).join("\n");
      const response = await request(app.getHttpServer())
        .post(`/api/v1/imports/${kind}`)
        .set("Authorization", `Bearer ${bearer}`)
        .field("targetCollectionId", collectionId)
        .attach("file", Buffer.from(text), `import.${kind === "csv" ? "csv" : "html"}`)
        .expect(201);
      expect(response.body.data).toMatchObject({
        importedCount: 2,
        errorCount: 1,
        skippedCount: 0,
      });
      const saved = await prisma.resource.findMany({
        where: { collectionId, url: { in: urls } },
        orderBy: { position: "asc" },
      });
      expect(saved.map((row) => row.url)).toEqual([urls[0], urls[2]]);
      expect(saved[1].position).toBe(saved[0].position + 1);
    }
  });

  it("rejects an oversized file during multipart parsing", async () => {
    await request(app.getHttpServer())
      .post("/api/v1/imports/csv")
      .set("Authorization", `Bearer ${bearer}`)
      .field("targetCollectionId", collectionId)
      .attach("file", Buffer.alloc(10 * 1024 * 1024 + 1), "large.csv")
      .expect(413);
  });
  it("keeps unfinished uploads outside authority and rechecks revoked sessions after parsing", async () => {
    const [parser] = Reflect.getMetadata(
      INTERCEPTORS_METADATA,
      ImportsController.prototype.importCsv,
    );
    const original = parser.prototype.intercept;
    let entered: () => void = () => {};
    const parsing = new Promise<void>((resolve) => {
      entered = resolve;
    });
    const spy = spyOn(parser.prototype, "intercept").mockImplementation(function (
      this: unknown,
      ...args: unknown[]
    ) {
      entered();
      return original.apply(this, args);
    });
    await app.listen(0, "127.0.0.1");
    const address = (app.getHttpServer() as http.Server).address();
    if (!address || typeof address === "string") throw new Error("Missing server");
    const boundary = "test-slow-import-boundary";
    const upload = http.request({
      host: "127.0.0.1",
      port: address.port,
      method: "POST",
      path: "/api/v1/imports/csv",
      headers: {
        authorization: `Bearer ${bearer}`,
        "content-type": `multipart/form-data; boundary=${boundary}`,
      },
    });
    const response = new Promise<number | undefined>((resolve, reject) => {
      upload.on("response", (res) => {
        res.resume();
        res.on("end", () => resolve(res.statusCode));
      });
      upload.on("error", reject);
    });
    // Attach a rejection handler even if an assertion fails before awaiting it.
    void response.catch(() => {});
    try {
      upload.write(
        `--${boundary}\r\nContent-Disposition: form-data; name="targetCollectionId"\r\n\r\n${collectionId}\r\n--${boundary}\r\nContent-Disposition: form-data; name="file"; filename="slow.csv"\r\nContent-Type: text/csv\r\n\r\nurl,title\nhttps://fixture-links.dev/slow-upload,Slow\n`,
      );
      await parsing;
      const prisma = app.get(PrismaService);
      const acquired = await prisma.$transaction(async (tx) => {
        const [row] = await tx.$queryRaw<
          Array<{ acquired: boolean }>
        >`SELECT pg_try_advisory_xact_lock(74201931) AS acquired`;
        if (row.acquired) await tx.session.deleteMany({ where: { userId } });
        return row.acquired;
      });
      expect(acquired).toBe(true);
      upload.end(`\r\n--${boundary}--\r\n`);
      expect(await response).toBe(401);
      expect(
        await prisma.resource.count({
          where: { collectionId, url: "https://fixture-links.dev/slow-upload" },
        }),
      ).toBe(0);
    } finally {
      upload.destroy();
      spy.mockRestore();
    }
  });
});
