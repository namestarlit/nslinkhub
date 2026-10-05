import { randomBytes } from "node:crypto";
import { readdirSync } from "node:fs";
import { resolve } from "node:path";
import { SQL } from "bun";

const api = resolve(import.meta.dir, "../apps/api");
const mode = process.argv[2];
function tests(directory: string): string[] {
  return readdirSync(resolve(api, directory), { withFileTypes: true })
    .flatMap((entry) => {
      if (["generated", "dist", "node_modules"].includes(entry.name)) return [];
      const path = `${directory}/${entry.name}`;
      return entry.isDirectory()
        ? tests(path)
        : /\.(spec|test)\.ts$/.test(path)
          ? [`./${path}`]
          : [];
    })
    .sort();
}
const env: Record<string, string | undefined> = { ...process.env, NODE_ENV: "test" };
delete env.SENTRY_DSN;
delete env.SENTRY_DSN_FILE;
delete env.RELEASE_SHA;
delete env.TRUSTED_PROXY_CIDRS;
let child: ReturnType<typeof Bun.spawn> | undefined;
async function run(command: string[]): Promise<number> {
  child = Bun.spawn(command, { cwd: api, env, stdout: "inherit", stderr: "inherit" });
  const status = await child.exited;
  child = undefined;
  return status;
}
if (mode === "unit") process.exit(await run(["bun", "test", ...tests("src")]));
if (mode !== "e2e") throw new Error("Expected unit or e2e test mode");
if (process.env.NODE_ENV === "production")
  throw new Error("Refusing production test configuration");

// Never derive a destructive test target from DATABASE_URL or a secret file.
// The admin URL is an explicit test-only input; default is the local +4 port.
const adminUrl =
  process.env.TEST_DATABASE_ADMIN_URL ?? "postgresql://postgres:postgres@127.0.0.1:5436/postgres";
const parsed = new URL(adminUrl);
if (!["127.0.0.1", "localhost", "[::1]"].includes(parsed.hostname))
  throw new Error("Test database admin must be loopback");
const name = `test_${randomBytes(12).toString("hex")}`;
const admin = new SQL(adminUrl, { max: 1 });
let database: SQL | undefined;
let created = false;
let cleanupPromise: Promise<void> | undefined;
function cleanup(): Promise<void> {
  cleanupPromise ??= (async () => {
    child?.kill();
    await database?.close();
    if (created) await admin.unsafe(`DROP DATABASE "${name}" WITH (FORCE)`);
    await admin.close();
  })();
  return cleanupPromise;
}
for (const signal of ["SIGINT", "SIGTERM"] as const)
  process.once(signal, () => {
    void cleanup().finally(() => process.exit(signal === "SIGINT" ? 130 : 143));
  });
let status = 1;
try {
  await admin.unsafe(`CREATE DATABASE "${name}"`);
  created = true;
  parsed.pathname = `/${name}`;
  env.DATABASE_URL = parsed.toString();
  delete env.DATABASE_URL_FILE;
  env.REDIS_URL = process.env.TEST_REDIS_URL ?? "redis://127.0.0.1:6383";
  delete env.REDIS_URL_FILE;
  database = new SQL(env.DATABASE_URL, { max: 1 });
  status = await run(["bunx", "prisma", "migrate", "deploy"]);
  if (status === 0)
    for (const file of tests("test")) {
      // Each suite exercises the real limiter. Reset only disposable test
      // budgets between suites; never touch development or production counters.
      await database`DELETE FROM request_budgets`;
      status = await run(["bun", "test", file]);
      if (status !== 0) break;
    }
} finally {
  await cleanup();
}
process.exit(status);
