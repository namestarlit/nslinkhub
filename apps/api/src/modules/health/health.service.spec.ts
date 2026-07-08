import { describe, expect, it } from "bun:test";
import { PrismaService } from "src/database/prisma.service";
import { HealthService } from "./health.service";
import { RedisQueueReadinessService } from "./redis-queue-readiness.service";

const up = { ping: async () => {} };
const down = {
  ping: async () => {
    throw new Error("down");
  },
};

function service(prisma: typeof up, redis: typeof up) {
  return new HealthService(
    prisma as unknown as PrismaService,
    redis as unknown as RedisQueueReadinessService,
  );
}

describe("HealthService", () => {
  it("liveness never touches dependencies", () => {
    expect(service(down, down).health()).toEqual({ status: "ok" });
  });

  it("is ready when both dependencies answer", async () => {
    const readiness = await service(up, up).readiness();
    expect(readiness.status).toBe("ready");
    expect(readiness.dependencies).toEqual({ postgres: "ready", redis_queue: "ready" });
  });

  it("degrades — not fails — when only the queue Redis is down", async () => {
    const readiness = await service(up, down).readiness();
    expect(readiness.status).toBe("degraded");
    expect(readiness.dependencies.redis_queue).toBe("unavailable");
  });

  it("is unavailable when the authoritative store is down", async () => {
    const readiness = await service(down, up).readiness();
    expect(readiness.status).toBe("unavailable");
  });
});
