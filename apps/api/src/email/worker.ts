import "dotenv/config";
import { PrismaPg } from "@prisma/adapter-pg";
import {
  emitEvent,
  initializeTelemetry,
  shutdownTelemetry,
} from "../common/observability/telemetry";
import { validateEnv } from "../config/env.validation";
import { readSecret } from "../config/secret";
import { PrismaClient } from "../generated/prisma/client";
import {
  LinkMetadataLookup,
  startLinkMetadataQueue,
} from "../modules/resources/link-metadata-lookup";
import { linkTitlesEnabled } from "../modules/resources/page-metadata";
import { emailConfig } from "./config";
import { EmailDelivery, startEmailQueue } from "./delivery";
import { CaptureProvider, ResendProvider } from "./provider";

async function main() {
  await initializeTelemetry();
  validateEnv(process.env);
  const config = emailConfig(process.env, true);
  const prisma = new PrismaClient({
    adapter: new PrismaPg({
      connectionString:
        readSecret("DATABASE_URL") ?? "postgresql://postgres:postgres@127.0.0.1:5436/nslinkhub",
    }),
  });
  const provider =
    config.provider === "resend"
      ? new ResendProvider(config.apiKey ?? "", config.from ?? "")
      : new CaptureProvider();
  const runtime = startEmailQueue(
    new EmailDelivery(prisma, provider, config.secret),
    config.redisUrl,
    config.prefix,
  );
  // Link metadata lookups share the worker process and Redis (not under test
  // unless LINK_TITLES=on, never when LINK_TITLES=off).
  const metadata = linkTitlesEnabled()
    ? startLinkMetadataQueue(new LinkMetadataLookup(prisma), config.redisUrl, config.prefix)
    : null;
  emitEvent("email.worker_started");
  let stopping = false;
  async function stop(failed = false) {
    if (stopping) return;
    stopping = true;
    const deadline = setTimeout(() => process.exit(1), 10_000);
    try {
      await Promise.all([runtime.close(), metadata?.close()]);
      await prisma.$disconnect();
      emitEvent("email.worker_stopped");
      await shutdownTelemetry();
      clearTimeout(deadline);
      process.exit(failed ? 1 : 0);
    } catch {
      process.exit(1);
    }
  }
  process.once("SIGTERM", () => void stop());
  process.once("SIGINT", () => void stop());
  // No raw exception output from a credential-bearing worker.
  process.on("uncaughtException", () => void stop(true));
  process.on("unhandledRejection", () => void stop(true));
}
void main().catch(async () => {
  await shutdownTelemetry();
  process.exit(1);
});
