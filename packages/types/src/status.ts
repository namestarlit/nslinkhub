// Preserve the existing readiness wire contract, including redis_queue.
export type DependencyStatus = Record<"postgres" | "redis_queue", "ready" | "unavailable">;
export type SystemStatus = "ready" | "degraded" | "unavailable";
export interface Readiness {
  status: SystemStatus;
  dependencies: DependencyStatus;
}
export interface Health {
  status: "ok";
}
