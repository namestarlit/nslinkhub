import { afterAll, beforeAll, describe, expect, it } from "bun:test";
import { INestApplication } from "@nestjs/common";
import { Test } from "@nestjs/testing";
import request from "supertest";
import { App } from "supertest/types";
import { AppModule } from "../src/app.module";
import { configureApp } from "../src/app.setup";

// Locks the import response contract: camelCase keys, partial-failure counts.
describe("Imports (e2e)", () => {
  let app: INestApplication<App>;
  let bearer: string;
  let collectionId: string;
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

    const signUp = await request(app.getHttpServer())
      .post("/api/v1/auth/sign-up/email")
      .send({
        email: `imp_${sfx}@example.com`,
        password: "Password123!",
        name: `imp_${sfx}`,
      })
      .expect(200);
    bearer = signUp.headers["set-auth-token"];

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
    const csv = `url,title\nhttps://example.com/imp-${sfx}-a,A\nhttps://example.com/imp-${sfx}-b,B\nnot-a-url,Bad\n`;

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
});
