import { randomBytes } from "node:crypto";
import { SQL } from "bun";

export function testAdminUrl(env: Record<string, string | undefined> = process.env): string {
  if (env.NODE_ENV === "production") throw new Error("Refusing production test configuration");
  const value =
    env.TEST_DATABASE_ADMIN_URL ?? "postgresql://postgres:postgres@127.0.0.1:5436/postgres";
  let parsed: URL;
  try {
    parsed = new URL(value);
  } catch {
    throw new Error("Invalid test database admin URL");
  }
  if (
    !["postgres:", "postgresql:"].includes(parsed.protocol) ||
    !["127.0.0.1", "localhost", "[::1]"].includes(parsed.hostname)
  )
    throw new Error("Test database admin must be loopback PostgreSQL");
  return value;
}

// One lifecycle per child process. Never derive a destructive target from the
// app DATABASE_URL. Only the random database successfully created here is owned.
export async function withTestDatabase<T>(
  operation: (db: { name: string; url: string; sql: SQL }) => Promise<T>,
  stopChild: () => Promise<void> = async () => {},
): Promise<T> {
  const adminUrl = testAdminUrl();
  const parsed = new URL(adminUrl);
  const name = `test_${randomBytes(12).toString("hex")}`;
  const admin = new SQL(adminUrl, { max: 1 });
  let database: SQL | undefined;
  let created = false;
  let interrupted = false;
  let cleanupPromise: Promise<void> | undefined;
  const setup = (async () => {
    await admin.unsafe(`CREATE DATABASE "${name}"`);
    created = true;
  })();
  function cleanup(): Promise<void> {
    cleanupPromise ??= (async () => {
      // A signal during CREATE must not race ownership assignment and orphan
      // the newly created DB. Always settle setup before deciding what to drop.
      await setup.catch(() => undefined);
      await stopChild();
      await database?.close();
      try {
        if (created) await admin.unsafe(`DROP DATABASE "${name}" WITH (FORCE)`);
      } finally {
        await admin.close();
      }
    })();
    return cleanupPromise;
  }
  const interrupt = (code: number) => {
    interrupted = true;
    void cleanup().then(
      () => process.exit(code),
      () => process.exit(1),
    );
  };
  const onInt = () => interrupt(130);
  const onTerm = () => interrupt(143);
  process.once("SIGINT", onInt);
  process.once("SIGTERM", onTerm);
  try {
    await setup;
    if (interrupted) throw new Error("Test run interrupted");
    parsed.pathname = `/${name}`;
    const url = parsed.toString();
    database = new SQL(url, { max: 1 });
    return await operation({ name, url, sql: database });
  } finally {
    await cleanup();
    process.off("SIGINT", onInt);
    process.off("SIGTERM", onTerm);
  }
}
