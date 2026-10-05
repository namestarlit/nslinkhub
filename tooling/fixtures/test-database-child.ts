import { withTestDatabase } from "../test-database";

const [mode, readyFile] = process.argv.slice(2);
try {
  await withTestDatabase(async ({ name, sql }) => {
    await sql`CREATE TABLE isolation_marker (value text NOT NULL)`;
    await sql`INSERT INTO isolation_marker VALUES (${name})`;
    await Bun.write(readyFile, name);
    await Bun.stdin.text();
    if (mode === "failure") throw new Error("Synthetic operation failure");
  });
} catch {
  process.exit(1);
}
