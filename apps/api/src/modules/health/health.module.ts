import { Module } from "@nestjs/common";
import { HealthController } from "./health.controller";
import { HealthService } from "./health.service";
import { RedisQueueReadinessService } from "./redis-queue-readiness.service";

@Module({
  controllers: [HealthController],
  providers: [HealthService, RedisQueueReadinessService],
})
export class HealthModule {}
