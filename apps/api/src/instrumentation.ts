import "dotenv/config";
import { initializeTelemetry } from "./common/observability/telemetry";

// Imported by the entrypoint before any Nest, Prisma or better-auth modules.
// Route synchronous configuration/file failures through the entrypoint's
// sanitized failure path too, rather than a raw module-evaluation stack.
export const telemetryReady = Promise.resolve().then(() => initializeTelemetry());
