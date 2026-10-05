import { readSecret } from "../config/secret";

export function emailConfig(
  env: Record<string, string | undefined> = process.env,
  forWorker = false,
) {
  const provider = env.EMAIL_PROVIDER ?? "capture";
  if (!["capture", "resend"].includes(provider)) throw new Error("Invalid EMAIL_PROVIDER");
  const apiKey = readSecret("RESEND_API_KEY", env);
  const from = env.EMAIL_FROM_ADDRESS;
  const supportUrl = env.EMAIL_SUPPORT_URL ?? "https://example.com/support";
  const prefix = env.QUEUE_NAMESPACE ?? "local-email";
  if (!/^[a-zA-Z0-9_-]{1,64}$/.test(prefix)) throw new Error("Invalid QUEUE_NAMESPACE");
  if (!/^https:\/\//.test(supportUrl)) throw new Error("EMAIL_SUPPORT_URL requires HTTPS");
  if (forWorker && provider === "resend" && (!apiKey || !from))
    throw new Error("Resend requires key and sender");
  if (env.NODE_ENV === "production" && (!env.EMAIL_SUPPORT_URL || !env.QUEUE_NAMESPACE)) {
    throw new Error("Production email requires EMAIL_SUPPORT_URL and QUEUE_NAMESPACE");
  }
  const suppressionSecret = readSecret("EMAIL_SUPPRESSION_SECRET", env);
  if (
    (suppressionSecret !== undefined && suppressionSecret.length < 32) ||
    (env.NODE_ENV === "production" &&
      (!suppressionSecret || suppressionSecret === "dev-email-suppression-secret-only"))
  )
    throw new Error(
      "EMAIL_SUPPRESSION_SECRET requires a dedicated secret of at least 32 characters",
    );
  return {
    suppressionSecret: suppressionSecret ?? "dev-email-suppression-secret-only",
    provider,
    apiKey,
    from,
    supportUrl,
    prefix,
    webhookSecret: readSecret("RESEND_WEBHOOK_SECRET", env),
    secret: readSecret("BETTER_AUTH_SECRET", env) ?? "dev-better-auth-secret",
    redisUrl: readSecret("REDIS_URL", env) ?? "redis://127.0.0.1:6383",
  };
}
