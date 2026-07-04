import { beforeEach, describe, expect, it } from "bun:test";
import { HealthService } from "./modules/health/health.service";

describe("HealthService", () => {
  let healthService: HealthService;

  beforeEach(() => {
    healthService = new HealthService();
  });

  it("returns ok health payload", () => {
    expect(healthService.health()).toEqual({ status: "ok" });
  });
});
