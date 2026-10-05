import { readSecret } from "./secret";

export interface TelemetryConfig {
  environment: "development" | "test" | "production";
  dsn?: string;
  release?: string;
  sampleRate: number;
}

export function telemetryConfig(
  env: Record<string, string | undefined> = process.env,
): TelemetryConfig {
  const environment = env.NODE_ENV ?? "development";
  if (!["development", "test", "production"].includes(environment)) {
    throw new Error("NODE_ENV must be development, test, or production");
  }
  const dsn = readSecret("SENTRY_DSN", env);
  if (dsn) {
    let valid = false;
    try {
      const url = new URL(dsn);
      valid =
        ["http:", "https:"].includes(url.protocol) &&
        Boolean(url.username) &&
        !url.password &&
        /^\/\d+$/.test(url.pathname) &&
        !url.search &&
        !url.hash;
    } catch {}
    if (!valid) throw new Error("SENTRY_DSN must be a valid HTTP(S) project DSN");
  }
  const sampleInput = env.SENTRY_TRACES_SAMPLE_RATE ?? "0.1";
  const sampleRate = Number(sampleInput);
  if (!sampleInput.trim() || !Number.isFinite(sampleRate) || sampleRate < 0 || sampleRate > 1) {
    throw new Error("SENTRY_TRACES_SAMPLE_RATE must be between 0 and 1");
  }
  const release = env.RELEASE_SHA;
  if (release !== undefined && !/^[a-f0-9]{40}$/.test(release)) {
    throw new Error("RELEASE_SHA must be a full lowercase git commit SHA");
  }
  return { environment: environment as TelemetryConfig["environment"], dsn, release, sampleRate };
}
