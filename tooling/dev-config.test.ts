import { expect, it } from "bun:test";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { resolveApiPort } from "./dev-config";

it("resolves API-local env files with Bun precedence and lets the shell win", async () => {
  const cwd = await mkdtemp(join(tmpdir(), "dev-port-"));
  const env = { ...process.env };
  delete env.PORT;
  try {
    expect(await resolveApiPort(cwd, env)).toBe(4000);
    await writeFile(join(cwd, ".env"), "PORT=4100\n");
    expect(await resolveApiPort(cwd, env)).toBe(4100);
    await writeFile(join(cwd, ".env.development"), "PORT=4200\n");
    expect(await resolveApiPort(cwd, env)).toBe(4200);
    await writeFile(join(cwd, ".env.local"), "PORT=4300\n");
    expect(await resolveApiPort(cwd, env)).toBe(4300);
    expect(await resolveApiPort(cwd, { ...env, PORT: "4400" })).toBe(4400);
    await expect(resolveApiPort(cwd, { ...env, PORT: "invalid" })).rejects.toThrow();
  } finally {
    await rm(cwd, { recursive: true, force: true });
  }
});
