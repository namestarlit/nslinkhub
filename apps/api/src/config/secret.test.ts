import { afterEach, describe, expect, it } from "bun:test";
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { readSecret } from "./secret";

const NAME = "TEST_SECRET_FOR_READSECRET";

afterEach(() => {
  delete process.env[NAME];
  delete process.env[`${NAME}_FILE`];
});

describe("readSecret", () => {
  it("returns undefined when neither the env var nor the _FILE is set", () => {
    expect(readSecret(NAME)).toBeUndefined();
  });

  it("reads the plain env var, trimmed; empty counts as unset", () => {
    process.env[NAME] = "  plain-value \n";
    expect(readSecret(NAME)).toBe("plain-value");
    process.env[NAME] = "   ";
    expect(readSecret(NAME)).toBeUndefined();
  });

  it("prefers the _FILE content over the env var, trimmed", () => {
    const dir = mkdtempSync(join(tmpdir(), "secret-"));
    const file = join(dir, "secret");
    writeFileSync(file, "file-value\n");
    process.env[NAME] = "plain-value";
    process.env[`${NAME}_FILE`] = file;
    expect(readSecret(NAME)).toBe("file-value");
  });

  it("fails loudly when the _FILE path is set but unreadable", () => {
    process.env[`${NAME}_FILE`] = "/no/such/secret/file";
    expect(() => readSecret(NAME)).toThrow();
  });
});
