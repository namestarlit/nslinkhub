import { type ChildProcess, spawn } from "node:child_process";
import { createServer } from "node:net";
import { resolveApiPort } from "./dev-config";

// Pigfarm's pattern: infrastructure first, three host processes, fail together.
// Refuse occupied ports rather than terminate independently started processes.
async function requireFree(port: number) {
  if (!Number.isInteger(port) || port < 1 || port > 65535)
    throw new Error("Invalid development port");
  await new Promise<void>((resolve, reject) => {
    const server = createServer();
    server.once("error", () =>
      reject(new Error(`Port ${port} is occupied; stop its server before starting dev.`)),
    );
    server.listen(port, "127.0.0.1", () => server.close(() => resolve()));
  });
}
const apiPort = await resolveApiPort();
const webPort = Number(process.env.WEB_PORT ?? 3000);
if (apiPort === webPort) throw new Error("API and web need different ports");
await Promise.all([requireFree(apiPort), requireFree(webPort)]);
const infra = Bun.spawn(["bun", "run", "infra:up"], { stdout: "inherit", stderr: "inherit" });
if (await infra.exited) process.exit(1);
const env = {
  ...process.env,
  NODE_ENV: "development",
  PORT: String(apiPort),
  WEB_PORT: String(webPort),
  WEB_SOURCE_SECRET: crypto.randomUUID() + crypto.randomUUID(),
  WEB_SOURCE_SECRET_FILE: "",
  WEB_TRUSTED_PROXY_CIDRS: "",
  BETTER_AUTH_URL: `http://localhost:${webPort}`,
  API_INTERNAL_ORIGIN: `http://127.0.0.1:${apiPort}`,
  API_INTERNAL_ORIGIN_FILE: "",
};
const children: ChildProcess[] = [];
let stopping = false;
function stop(code: number) {
  if (stopping) return;
  stopping = true;
  for (const child of children) {
    try {
      if (child.pid) process.kill(-child.pid, "SIGTERM");
    } catch {}
  }
  const deadline = setTimeout(() => {
    for (const child of children) {
      try {
        if (child.pid) process.kill(-child.pid, "SIGKILL");
      } catch {}
    }
    process.exit(code);
  }, 3000);
  Promise.all(
    children.map((child) =>
      child.exitCode !== null || child.signalCode !== null
        ? Promise.resolve()
        : new Promise<void>((resolve) => child.once("exit", () => resolve())),
    ),
  ).then(() => {
    clearTimeout(deadline);
    process.exit(code);
  });
}
for (const [cwd, args] of [
  ["apps/api", ["--watch", "src/entrypoint.ts"]],
  ["apps/api", ["--watch", "src/email/worker.ts"]],
  ["apps/web", ["server.ts", "--dev"]],
] as const) {
  const child = spawn("bun", [...args], { cwd, env, stdio: "inherit", detached: true });
  children.push(child);
  child.once("error", () => stop(1));
  child.once("exit", (code) => {
    if (!stopping) stop(code || 1);
  });
}
process.once("SIGINT", () => stop(130));
process.once("SIGTERM", () => stop(143));
