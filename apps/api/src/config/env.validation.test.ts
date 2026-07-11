import { describe, expect, it } from "bun:test";
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { validateEnv } from "./env.validation";

function secretFile(content: string): string {
  const file = join(mkdtempSync(join(tmpdir(), "envval-")), "secret");
  writeFileSync(file, content);
  return file;
}

describe("validateEnv", () => {
  it("rejects malformed plain values and accepts valid ones", () => {
    expect(() => validateEnv({ DATABASE_URL: "mysql://nope" })).toThrow(/DATABASE_URL/);
    expect(() => validateEnv({ REDIS_URL: "http://nope" })).toThrow(/REDIS_URL/);
    expect(() =>
      validateEnv({
        DATABASE_URL: "postgresql://x/y",
        REDIS_URL: "redis://127.0.0.1:6383",
      }),
    ).not.toThrow();
  });

  // Zero-config is dev-only: production refuses to boot on missing secrets
  // or the public dev default.
  it("requires the secrets in production; dev stays zero-config", () => {
    expect(() => validateEnv({ NODE_ENV: "production" })).toThrow(/DATABASE_URL/);
    expect(() => validateEnv({ NODE_ENV: "production" })).toThrow(/BETTER_AUTH_SECRET/);
    expect(() =>
      validateEnv({
        NODE_ENV: "production",
        DATABASE_URL: "postgresql://x/y",
        BETTER_AUTH_SECRET: "dev-better-auth-secret",
      }),
    ).toThrow(/dev default/);
    expect(() =>
      validateEnv({
        NODE_ENV: "production",
        DATABASE_URL_FILE: secretFile("postgresql://x/y\n"),
        BETTER_AUTH_SECRET_FILE: secretFile("a-sufficiently-long-secret\n"),
      }),
    ).not.toThrow();
    // No NODE_ENV (dev/test): nothing is required.
    expect(() => validateEnv({})).not.toThrow();
  });

  // The production path: secrets arriving via _FILE get the same checks.
  it("validates secrets delivered through the _FILE contract", () => {
    expect(() => validateEnv({ BETTER_AUTH_SECRET_FILE: secretFile("short\n") })).toThrow(
      /BETTER_AUTH_SECRET/,
    );
    expect(() => validateEnv({ DATABASE_URL_FILE: secretFile("mysql://nope\n") })).toThrow(
      /DATABASE_URL/,
    );
    expect(() =>
      validateEnv({
        DATABASE_URL_FILE: secretFile("postgresql://x/y\n"),
        BETTER_AUTH_SECRET_FILE: secretFile("a-sufficiently-long-secret\n"),
      }),
    ).not.toThrow();
  });
});
