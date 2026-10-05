import { Controller, Get } from "@nestjs/common";
import { ApiTags } from "@nestjs/swagger";
import { apiOk } from "src/common/utils/response.util";
import { appError } from "../../common/errors/app-exception";
import { HealthService } from "./health.service";

@ApiTags("system")
@Controller("api/v1")
export class HealthController {
  constructor(private readonly healthService: HealthService) {}

  // Liveness probe: process is up. Never touches dependencies.
  @Get("health")
  health() {
    return apiOk(this.healthService.health());
  }

  // Readiness / system status: per-dependency report. 503 only when the
  // authoritative store is down (deploy orchestration gates on this).
  @Get("status")
  async status() {
    const readiness = await this.healthService.readiness();
    if (readiness.status === "unavailable") {
      throw appError("dependencies_unavailable", { dependencies: readiness.dependencies });
    }
    return apiOk(readiness);
  }
}
