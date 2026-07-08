import { Injectable } from "@nestjs/common";
import { PrismaService } from "src/database/prisma.service";
import { RedisQueueReadinessService } from "./redis-queue-readiness.service";

type Dependency = "postgres" | "redis_queue";
type DependencyStatus = Record<Dependency, "ready" | "unavailable">;
export type SystemStatus = "ready" | "degraded" | "unavailable";

export interface Readiness {
  status: SystemStatus;
  dependencies: DependencyStatus;
}

@Injectable()
export class HealthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly redisQueue: RedisQueueReadinessService,
  ) {}

  // Liveness: the process is up and serving. No dependency checks.
  health() {
    return { status: "ok" };
  }

  // Readiness: dependency-by-dependency system status.
  async readiness(): Promise<Readiness> {
    const [postgres, redisQueue] = await Promise.allSettled([
      this.prisma.ping(),
      this.redisQueue.ping(),
    ]);

    const dependencies: DependencyStatus = {
      postgres: postgres.status === "fulfilled" ? "ready" : "unavailable",
      redis_queue: redisQueue.status === "fulfilled" ? "ready" : "unavailable",
    };

    // PostgreSQL is authoritative — without it nothing works. The queue Redis
    // only backs future email/notification delivery, so the product remains
    // fully usable without it: degraded, not unavailable.
    let status: SystemStatus;
    if (dependencies.postgres === "unavailable") {
      status = "unavailable";
    } else if (dependencies.redis_queue === "unavailable") {
      status = "degraded";
    } else {
      status = "ready";
    }

    return { status, dependencies };
  }
}
