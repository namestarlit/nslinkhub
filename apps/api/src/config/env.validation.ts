// Startup configuration validation (plain function — no schema dependency).
// Every variable stays optional with in-code local defaults; validation only
// rejects values that are present but malformed, so a bad deployment fails
// fast instead of half-working.

function isPort(value: string): boolean {
  const n = Number(value);
  return Number.isInteger(n) && n >= 1 && n <= 65535;
}

export function validateEnv(
  config: Record<string, unknown>,
): Record<string, unknown> {
  const errors: string[] = [];

  for (const key of ['PORT', 'DB_PORT', 'REDIS_PORT']) {
    const value = config[key];
    if (typeof value === 'string' && value !== '' && !isPort(value)) {
      errors.push(`${key} must be a TCP port (1-65535), got "${value}"`);
    }
  }

  const dbUrl = config['DATABASE_URL'];
  if (
    typeof dbUrl === 'string' &&
    dbUrl !== '' &&
    !/^postgres(ql)?:\/\//.test(dbUrl)
  ) {
    errors.push('DATABASE_URL must be a postgresql:// URL');
  }

  const secret = config['BETTER_AUTH_SECRET'];
  if (typeof secret === 'string' && secret !== '' && secret.length < 16) {
    errors.push('BETTER_AUTH_SECRET must be at least 16 characters');
  }

  const baseUrl = config['BETTER_AUTH_URL'];
  if (
    typeof baseUrl === 'string' &&
    baseUrl !== '' &&
    !/^https?:\/\//.test(baseUrl)
  ) {
    errors.push('BETTER_AUTH_URL must be an http(s) URL');
  }

  if (errors.length > 0) {
    throw new Error(`Invalid configuration:\n- ${errors.join('\n- ')}`);
  }

  return config;
}
