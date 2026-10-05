import { captureFailure, emitEvent, shutdownTelemetry } from "./common/observability/telemetry";
import { telemetryReady } from "./instrumentation";

let stopping = false;
async function fail(error: unknown): Promise<void> {
  if (stopping) return;
  stopping = true;
  captureFailure(error);
  emitEvent("application.failed", {}, "error");
  await shutdownTelemetry();
  process.exit(1);
}
process.on("uncaughtException", (error) => void fail(error));
process.on("unhandledRejection", (error) => void fail(error));

async function start(): Promise<void> {
  await telemetryReady;
  // Dynamic import is required: static import evaluation would initialize
  // auth/Prisma before telemetry even when written below the await.
  const { bootstrap } = await import("./main.js");
  const app = await bootstrap();
  emitEvent("application.started");
  const stop = async () => {
    if (stopping) return;
    stopping = true;
    const deadline = setTimeout(() => process.exit(1), 5000);
    try {
      await app.close();
      emitEvent("application.stopped");
      await shutdownTelemetry();
      clearTimeout(deadline);
      process.exit(0);
    } catch (error) {
      captureFailure(error);
      await shutdownTelemetry();
      process.exit(1);
    }
  };
  process.once("SIGINT", () => void stop());
  process.once("SIGTERM", () => void stop());
}
void start().catch(fail);
