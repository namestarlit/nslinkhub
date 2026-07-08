import { readFileSync } from "node:fs";

// Deployment-secret contract (see docs/design-docs/infra-deployment.md):
// secrets reach services as `<NAME>_FILE` inputs (docker/swarm secrets, e.g.
// /run/secrets/x). If `<NAME>_FILE` is set it wins and the secret is the
// trimmed file content — a set-but-unreadable path fails loudly at startup.
// Otherwise the plain env var is used. Returns undefined when neither is set
// so callers keep their local-dev defaults (the repo's config philosophy:
// optional with in-code defaults, fail only on present-but-malformed values).
// `env` is overridable so startup validation can resolve the same contract
// against the config record it is validating.
export function readSecret(
  name: string,
  env: Record<string, string | undefined> = process.env,
): string | undefined {
  const path = env[`${name}_FILE`];
  if (path) {
    return readFileSync(path, "utf8").trim();
  }
  const value = env[name]?.trim();
  return value === "" ? undefined : value;
}
