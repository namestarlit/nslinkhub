import { resolve } from "node:path";
import { withTestDatabase } from "./test-database";
import { maskVerificationOverrides } from "./verification-env";

const root = resolve(import.meta.dir, "..");
let child: ReturnType<typeof Bun.spawn> | undefined;
async function stop() {
  const current = child;
  if (!current) return;
  current.kill("SIGTERM");
  const timer = setTimeout(() => current.kill("SIGKILL"), 5000);
  await current.exited;
  clearTimeout(timer);
  child = undefined;
}
await withTestDatabase(async ({ url }) => {
  const api = Bun.serve({ hostname: "127.0.0.1", port: 0, fetch: () => new Response() });
  const web = Bun.serve({ hostname: "127.0.0.1", port: 0, fetch: () => new Response() });
  const apiPort = api.port,
    webPort = web.port;
  await api.stop(true);
  await web.stop(true);
  const env = maskVerificationOverrides({
    ...process.env,
    DATABASE_URL: url,
    PORT: String(apiPort),
    WEB_PORT: String(webPort),
    EMAIL_PROVIDER: "capture",
    BETTER_AUTH_SECRET: "dev-loop-check-secret-synthetic-only",
    EMAIL_SUPPRESSION_SECRET: "dev-loop-check-suppression-independent",
    QUEUE_NAMESPACE: `dev-loop-${crypto.randomUUID()}`,
    REDIS_URL: process.env.TEST_REDIS_URL ?? "redis://127.0.0.1:6383",
  });
  const migration = Bun.spawn(["bunx", "prisma", "migrate", "deploy"], {
    cwd: `${root}/apps/api`,
    env,
    stdout: "ignore",
    stderr: "ignore",
  });
  if (await migration.exited) throw new Error("Dev fixture migration failed");
  child = Bun.spawn(["bun", "tooling/dev.ts"], {
    cwd: root,
    env,
    stdout: Bun.file("/tmp/w3-dev-loop.log"),
    stderr: Bun.file("/tmp/w3-dev-loop-errors.log"),
  });
  let ready = false;
  for (let i = 0; i < 90; i++) {
    if (child.exitCode !== null) throw new Error("Dev orchestrator exited early");
    try {
      const response = await fetch(`http://127.0.0.1:${webPort}`, {
        signal: AbortSignal.timeout(2000),
      });
      if (response.ok && (await response.text()).includes("No published collections yet.")) {
        ready = true;
        break;
      }
    } catch {}
    await Bun.sleep(250);
  }
  if (!ready) throw new Error("Dev web did not become ready");
  const signIn = await fetch(`http://127.0.0.1:${webPort}/sign-in`);
  if (!signIn.ok || !(await signIn.text()).includes("Sign in to nslinkhub"))
    throw new Error("Dev sign-in page did not render");
  const output = await Bun.file("/tmp/w3-dev-loop.log").text();
  if (!output.includes(`[web] Ready at http://localhost:${webPort}`))
    throw new Error("Dev web did not announce its ready URL");
  const proxied = await fetch(`http://127.0.0.1:${webPort}/api/v1/discover`);
  if (!proxied.ok || (await proxied.json()).data.length !== 0)
    throw new Error("Dev rewrite failed");
  await stop();
  for (const port of [apiPort, webPort]) {
    try {
      await fetch(`http://127.0.0.1:${port}`, { signal: AbortSignal.timeout(500) });
      throw new Error(`Owned dev process still serves ${port}`);
    } catch (e) {
      if (e instanceof Error && e.message.startsWith("Owned dev")) throw e;
    }
  }
  console.log("Dev loop passed: API/worker/web scripts, ready URL, sign-in, rewrite and shutdown.");
}, stop);
