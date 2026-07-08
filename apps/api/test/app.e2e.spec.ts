import { beforeEach, describe, expect, it } from "bun:test";
import { INestApplication } from "@nestjs/common";
import { Test, TestingModule } from "@nestjs/testing";
import request from "supertest";
import { App } from "supertest/types";
import { AppModule } from "./../src/app.module";

describe("AppController (e2e)", () => {
  let app: INestApplication<App>;

  beforeEach(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    await app.init();
  });

  it("/api/v1/health (GET) is a dependency-free liveness probe", () => {
    return request(app.getHttpServer())
      .get("/api/v1/health")
      .expect(200)
      .expect({ data: { status: "ok" } });
  });

  // e2e runs against the compose services, so both dependencies are up.
  it("/api/v1/status (GET) reports per-dependency readiness", async () => {
    const res = await request(app.getHttpServer()).get("/api/v1/status").expect(200);
    const body = res.body as {
      data: { status: string; dependencies: { postgres: string; redis_queue: string } };
    };
    expect(body.data.status).toBe("ready");
    expect(body.data.dependencies.postgres).toBe("ready");
    expect(body.data.dependencies.redis_queue).toBe("ready");
  });
});
