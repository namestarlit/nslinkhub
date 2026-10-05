import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { SQL } from "bun";
import { testAdminUrl } from "./test-database";

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}
const adminUrl = testAdminUrl();
for (const env of [
  { NODE_ENV: "production" },
  { TEST_DATABASE_ADMIN_URL: "postgresql://private@remote.invalid/postgres" },
]) {
  let refused = false;
  try {
    testAdminUrl(env);
  } catch {
    refused = true;
  }
  assert(refused, "Unsafe test configuration was accepted");
}
const admin = new SQL(adminUrl, { max: 1 });
const directory = await mkdtemp(join(tmpdir(), "test-isolation-"));
const children: ReturnType<typeof Bun.spawn>[] = [];
try {
  async function start(mode: string) {
    const ready = join(directory, mode);
    const child = Bun.spawn(
      ["bun", resolve(import.meta.dir, "fixtures/test-database-child.ts"), mode, ready],
      {
        env: process.env,
        stdin: "pipe",
        stdout: "ignore",
        stderr: "pipe",
      },
    );
    children.push(child);
    for (let i = 0; i < 200; i++) {
      if (await Bun.file(ready).exists())
        return { child, name: (await Bun.file(ready).text()).trim() };
      if (child.exitCode !== null) throw new Error("Isolation fixture failed before readiness");
      await Bun.sleep(25);
    }
    throw new Error("Isolation fixture readiness timed out");
  }
  // Keep a database alive before the runs under test. Unrelated runs may
  // legitimately drop their databases, so a cluster-wide snapshot is not stable.
  const sentinel = await start("sentinel");
  const runs = await Promise.all([
    start("success"),
    start("failure"),
    start("interrupt"),
    start("survivor"),
  ]);
  const fixtures = [sentinel, ...runs];
  assert(new Set(fixtures.map((r) => r.name)).size === 5, "Parallel runs shared a database");
  for (const run of fixtures) {
    const target = new URL(adminUrl);
    target.pathname = `/${run.name}`;
    const connection = new SQL(target.toString(), { max: 1 });
    try {
      const rows = await connection`SELECT value FROM isolation_marker`;
      assert(rows.length === 1 && rows[0].value === run.name, "Fixture database isolation failed");
    } finally {
      await connection.close();
    }
  }
  const [success, failure, interrupt, survivor] = runs;
  for (const { child } of [success, failure])
    if (child.stdin && typeof child.stdin !== "number") child.stdin.end();
  interrupt.child.kill("SIGTERM");
  const exits = await Promise.all([
    success.child.exited,
    failure.child.exited,
    interrupt.child.exited,
  ]);
  assert(exits[0] === 0 && exits[1] === 1 && exits[2] === 143, "Unexpected fixture exits");
  const remaining = await admin`SELECT datname FROM pg_database`;
  const names = new Set(remaining.map((row) => row.datname));
  assert(
    [success, failure, interrupt].every((run) => !names.has(run.name)),
    "Owned database was not cleaned",
  );
  assert(names.has(survivor.name), "Cleanup removed another active test database");
  assert(names.has(sentinel.name), "Cleanup removed the pre-existing sentinel database");
  for (const run of [survivor, sentinel]) {
    if (run.child.stdin && typeof run.child.stdin !== "number") run.child.stdin.end();
    assert((await run.child.exited) === 0, "Preserved fixture failed");
    assert(
      (await admin`SELECT datname FROM pg_database WHERE datname = ${run.name}`).length === 0,
      "Preserved fixture DB was not cleaned",
    );
  }
  console.log(
    "Parallel test databases, success/failure/SIGTERM cleanup and unsafe-config refusal passed.",
  );
} finally {
  for (const child of children) {
    if (child.exitCode === null) {
      child.kill("SIGTERM");
      await child.exited;
    }
  }
  await admin.close();
  await rm(directory, { recursive: true, force: true });
}
