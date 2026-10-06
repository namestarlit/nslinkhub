import { spawn } from "node:child_process";
import { resolve } from "node:path";

const stage = process.argv[2];
if (stage === "root" || stage === "api-parent") {
  // Match dev's Node spawn and browser's nested Bun spawn. Inherited empty
  // strings must survive the cwd and NODE_ENV changes in both paths.
  const cwd = stage === "root" ? resolve("apps/api") : resolve("../web");
  const env = { ...process.env, ...(stage === "api-parent" ? { NODE_ENV: "production" } : {}) };
  const cmd = [resolve(import.meta.path), stage === "root" ? process.argv[3] : "web"];
  if (stage === "root") {
    const child = spawn("bun", cmd, { cwd, env, stdio: "inherit" });
    child.once("error", () => process.exit(1));
    child.once("exit", (code) => process.exit(code ?? 1));
  } else {
    const child = Bun.spawn(["bun", ...cmd], { cwd, env, stdout: "inherit", stderr: "inherit" });
    process.exit(await child.exited);
  }
} else if (stage === "api") {
  // Prisma's real config loads dotenv; worker and API use these same resolvers.
  const { default: prisma } = await import("../../apps/api/prisma.config");
  const { emailConfig } = await import("../../apps/api/src/email/config");
  const { readSecret } = await import("../../apps/api/src/config/secret");
  const { telemetryConfig } = await import("../../apps/api/src/config/telemetry");
  const email = emailConfig(process.env, true);
  console.log(
    JSON.stringify({
      database: prisma.datasource?.url,
      workerDatabase: readSecret("DATABASE_URL"),
      redis: email.redisUrl,
      auth: email.secret,
      suppression: email.suppressionSecret,
      provider: email.provider,
      queue: email.prefix,
      apiKey: email.apiKey ?? null,
      webhookSecret: email.webhookSecret ?? null,
      telemetry: telemetryConfig().dsn ?? null,
      databaseFile: process.env.DATABASE_URL_FILE,
      trustedProxies: process.env.TRUSTED_PROXY_CIDRS,
    }),
  );
} else if (stage === "web") {
  const { webServerConfig } = await import("../../packages/config/src/web-server");
  const config = webServerConfig();
  console.log(JSON.stringify(config));
} else {
  throw new Error("Unknown environment fixture stage");
}
