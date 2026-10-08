// Dependency readiness in the camelCase API wire contract.
export type DependencyStatus = Record<"postgres" | "redisQueue", "ready" | "unavailable">;
export type SystemStatus = "ready" | "degraded" | "unavailable";
export interface Readiness {
  status: SystemStatus;
  dependencies: DependencyStatus;
}
export interface Health {
  status: "ok";
}
