import { afterAll, beforeAll, describe, it } from "bun:test";
import { INestApplication } from "@nestjs/common";
import { Test } from "@nestjs/testing";
import request from "supertest";
import { App } from "supertest/types";
import { AppModule } from "../src/app.module";
import { configureApp } from "../src/app.setup";

// Drive-style inheritance: a grant (share or publish) on a parent collection
// flows down to its children — sharing a folder shares its contents.
describe("Nested access inheritance (e2e)", () => {
  let app: INestApplication<App>;
  const sfx = Date.now().toString(36);

  const signUp = async (label: string) => {
    const res = await request(app.getHttpServer())
      .post("/api/v1/auth/sign-up/email")
      .send({ email: `${label}_${sfx}@example.com`, password: "Password123!", name: label })
      .expect(200);
    return res.headers["set-auth-token"] as string;
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

  it("a share or publish on a parent grants access to its child collections", async () => {
    const alice = await signUp("nowner");
    const bob = await signUp("neditor");
    const carol = await signUp("nstranger");

    // Alice: parent P with a nested child C.
    const parent = await request(app.getHttpServer())
      .post("/api/v1/collections")
      .set("Authorization", `Bearer ${alice}`)
      .send({ slug: `par-${sfx}`, title: "Parent" })
      .expect(201);
    const pid = (parent.body as { data: { id: string } }).data.id;

    const child = await request(app.getHttpServer())
      .post(`/api/v1/collections/${pid}/children`)
      .set("Authorization", `Bearer ${alice}`)
      .send({ slug: `chi-${sfx}`, title: "Child" })
      .expect(201);
    const cid = (child.body as { data: { id: string } }).data.id;

    // Before any grant, Bob cannot see the child.
    await request(app.getHttpServer())
      .get(`/api/v1/collections/${cid}/resources`)
      .set("Authorization", `Bearer ${bob}`)
      .expect(404);

    // Alice shares the PARENT with Bob as editor.
    await request(app.getHttpServer())
      .post(`/api/v1/collections/${pid}/shares`)
      .set("Authorization", `Bearer ${alice}`)
      .send({ email: `neditor_${sfx}@example.com`, role: "editor" })
      .expect(201);

    // Bob now inherits editor access to the child: reads and writes it.
    await request(app.getHttpServer())
      .get(`/api/v1/collections/${cid}/resources`)
      .set("Authorization", `Bearer ${bob}`)
      .expect(200);
    await request(app.getHttpServer())
      .post(`/api/v1/collections/${cid}/resources/external`)
      .set("Authorization", `Bearer ${bob}`)
      .send({ url: `https://example.com/nested-${sfx}`, position: 0 })
      .expect(201);

    // Carol (no grant) still cannot read the child.
    await request(app.getHttpServer())
      .get(`/api/v1/collections/${cid}/resources`)
      .set("Authorization", `Bearer ${carol}`)
      .expect(404);

    // Alice publishes the PARENT → the child becomes readable through inheritance.
    await request(app.getHttpServer())
      .post(`/api/v1/collections/${pid}/publish`)
      .set("Authorization", `Bearer ${alice}`)
      .expect(201);
    await request(app.getHttpServer())
      .get(`/api/v1/collections/${cid}/resources`)
      .set("Authorization", `Bearer ${carol}`)
      .expect(200);
  });
});
