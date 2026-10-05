import { readdirSync } from "node:fs";
import { resolve } from "node:path";
import { withTestDatabase } from "./test-database";

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
const status = await withTestDatabase(
  async ({ url, sql }) => {
    env.DATABASE_URL = url;
    delete env.DATABASE_URL_FILE;
    env.REDIS_URL = process.env.TEST_REDIS_URL ?? "redis://127.0.0.1:6383";
    delete env.REDIS_URL_FILE;
    let result = await run(["bunx", "prisma", "migrate", "deploy"]);
    if (result === 0)
      for (const file of tests("test")) {
        await sql`DELETE FROM request_budgets`;
        result = await run(["bun", "test", file]);
        if (result !== 0) break;
      }
    return result;
  },
  async () => {
    const active = child;
    if (!active) return;
    active.kill();
    const deadline = setTimeout(() => active.kill("SIGKILL"), 2000);
    try {
      await active.exited;
    } finally {
      clearTimeout(deadline);
    }
  },
);
process.exit(status);
