import { emailOTP } from "better-auth/plugins";
import { emailKey, enqueueEmail } from "../email/outbox";
import type { Prisma, PrismaClient } from "../generated/prisma/client";
import { createAuth } from "./create-auth";
import { bindHandoverProofs, handoverIdentifiers } from "./handover-proofs";

const basePath = "/api/v1/auth";
const codePaths = new Set([
  "/code/send",
  "/code/verify",
  "/email-change/start",
  "/email-change/confirm-current",
  "/email-change/confirm-new",
]);
const nativePaths = new Set([
  "/sign-out",
  "/revoke-session",
  "/revoke-sessions",
  "/revoke-other-sessions",
  "/update-user",
]);
const failure = (status: number, code = "invalid_request") =>
  Response.json(
    {
      error: {
        code,
        message:
          status === 503 ? "Service temporarily unavailable" : "Unable to complete this request",
      },
    },
    { status, headers: { "Cache-Control": "no-store" } },
  );
function email(value: unknown): string | undefined {
  return typeof value === "string" &&
    value.length <= 254 &&
    /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)
    ? value.toLowerCase()
    : undefined;
}
async function budget(tx: Prisma.TransactionClient, key: string, limit: number) {
  const rows = await tx.$queryRaw<Array<{ count: number }>>`
    INSERT INTO request_budgets (key,count,expires_at) VALUES (${key},1,clock_timestamp()+interval '10 minutes')
    ON CONFLICT (key) DO UPDATE SET
      count=CASE WHEN request_budgets.expires_at <= clock_timestamp() THEN 1 ELSE request_budgets.count+1 END,
      expires_at=CASE WHEN request_budgets.expires_at <= clock_timestamp() THEN clock_timestamp()+interval '10 minutes' ELSE request_budgets.expires_at END
    WHERE request_budgets.expires_at <= clock_timestamp() OR request_budgets.count < ${limit} RETURNING count`;
  return rows.length > 0;
}

export interface DeliveryAuthOptions {
  prisma: PrismaClient;
  secret: string;
  suppressionSecret: string;
  baseURL: string;
  supportUrl: string;
  // Fault injection stays at the persistence boundary; never emits real mail.
  persistEmail?: typeof enqueueEmail;
  beforeCommit?: () => Promise<void>;
}
export function createDeliveryAuth(options: DeliveryAuthOptions) {
  const { prisma, secret, baseURL, supportUrl } = options;
  const ordinary = createAuth({ prisma, secret, baseURL });
  return {
    ...ordinary,
    handler: async (request: Request): Promise<Response> => {
      const url = new URL(request.url);
      const path = url.pathname.slice(basePath.length);
      // Explicit HTTP allowlist: native OTP/verification/reset routes cannot bypass
      // purpose binding or durable delivery. No GET endpoint consumes a challenge.
      if (request.method === "GET")
        return path === "/get-session" ? ordinary.handler(request) : failure(404);
      let body: Record<string, unknown>;
      try {
        // Bound streaming input before JSON parsing (Content-Length is untrusted).
        const reader = request.body?.getReader();
        const chunks: Uint8Array[] = [];
        let size = 0;
        if (reader)
          for (;;) {
            const { value, done } = await reader.read();
            if (done) break;
            size += value.length;
            if (size > 16_384) {
              await reader.cancel();
              return failure(413);
            }
            chunks.push(value);
          }
        body = JSON.parse(Buffer.concat(chunks).toString() || "{}");
        if (!body || typeof body !== "object" || Array.isArray(body)) return failure(400);
      } catch {
        return failure(400);
      }
      if (request.method !== "POST" || (!codePaths.has(path) && !nativePaths.has(path)))
        return failure(404);
      const origin = request.headers.get("origin");
      if (
        (origin && origin !== new URL(baseURL).origin) ||
        (!origin && request.headers.has("cookie")) ||
        request.headers.get("sec-fetch-site") === "cross-site"
      )
        return failure(403);
      try {
        return await prisma.$transaction(
          async (tx) => {
            // All auth mutations, including code session creation, share this
            // DB lock. Cross-process ordering is deliberate at this product's scale.
            await tx.$executeRaw`SELECT pg_advisory_xact_lock(74201931)`;
            let deliveryFailed = false;
            let deliveryCount = 0;
            let target: string | undefined;
            let proofIdentifiers: ReturnType<typeof handoverIdentifiers> | undefined;
            const localAuth = createAuth({
              prisma: tx,
              secret,
              baseURL,
              plugins: [
                emailOTP({
                  otpLength: 8,
                  expiresIn: 300,
                  allowedAttempts: 3,
                  resendStrategy: "rotate",
                  storeOTP: { hash: async (otp) => emailKey(secret, "otp", otp) },
                  changeEmail: { enabled: true, verifyCurrentEmail: true },
                  sendVerificationOTP: async ({ email: to, otp, type }) => {
                    try {
                      if (type !== "sign-in" && (!target || !proofIdentifiers))
                        throw new Error("Missing workflow");
                      const identifier =
                        type === "sign-in"
                          ? `sign-in-otp-${to}`
                          : type === "change-email"
                            ? proofIdentifiers?.next
                            : proofIdentifiers?.current;
                      if (!identifier) throw new Error("Missing proof namespace");
                      await (options.persistEmail ?? enqueueEmail)(tx, {
                        secret,
                        suppressionSecret: options.suppressionSecret,
                        supportUrl,
                        to,
                        code: otp,
                        kind:
                          type === "sign-in"
                            ? "sign-in"
                            : type === "change-email"
                              ? "new-email"
                              : "current-email",
                        identifier,
                        newEmail: target,
                      });
                      deliveryCount++;
                    } catch {
                      deliveryFailed = true;
                      throw new Error("Delivery intent unavailable");
                    }
                  },
                }),
              ],
            });
            let nativePath = path;
            let nativeBody = body;
            let currentEmail: string | undefined;
            let userId: string | undefined;
            let expectedDelivery = false;
            const issuing = path === "/code/send" || path === "/email-change/start";
            if (codePaths.has(path)) {
              const allowed =
                path === "/code/send"
                  ? ["email"]
                  : path === "/code/verify"
                    ? ["email", "code", "name"]
                    : path === "/email-change/start"
                      ? ["newEmail"]
                      : ["code"];
              if (Object.keys(body).some((k) => !allowed.includes(k))) return failure(400);
              if (!issuing && (typeof body.code !== "string" || !/^\d{8}$/.test(body.code)))
                return failure(400);
              if (
                body.name !== undefined &&
                (typeof body.name !== "string" ||
                  body.name.trim().length === 0 ||
                  body.name.length > 255)
              )
                return failure(400);
              let budgetIdentity: string;
              if (path.startsWith("/code/")) {
                const address = email(body.email);
                if (!address) return failure(400);
                budgetIdentity = address;
                nativePath = issuing ? "/email-otp/send-verification-otp" : "/sign-in/email-otp";
                nativeBody = issuing
                  ? { email: address, type: "sign-in" }
                  : {
                      email: address,
                      otp: body.code,
                      ...(typeof body.name === "string" ? { name: body.name.trim() } : {}),
                    };
                expectedDelivery = issuing;
              } else {
                const session = await localAuth.api.getSession({ headers: request.headers });
                if (!session) return failure(401);
                userId = session.user.id;
                currentEmail = session.user.email.toLowerCase();
                budgetIdentity = userId;
                // Both proofs must be completed from the initiating, still-valid session.
                if (path === "/email-change/start") {
                  target = email(body.newEmail);
                  if (!target || target === currentEmail) return failure(400);
                  if (!(await budget(tx, emailKey(secret, "issue", budgetIdentity), 5)))
                    return failure(429, "too_many_requests");
                  const previous = await tx.emailChangeIntent.findUnique({ where: { userId } });
                  if (previous) {
                    const identifiers = Object.values(handoverIdentifiers(secret, previous));
                    const context = await localAuth.$context;
                    for (const identifier of identifiers)
                      await context.internalAdapter.deleteVerificationByIdentifier(identifier);
                    await tx.emailOutbox.updateMany({
                      where: {
                        challengeKey: {
                          in: identifiers.map((id) => emailKey(secret, "challenge", id)),
                        },
                        state: "pending",
                      },
                      data: { state: "cancelled", payload: null },
                    });
                  }
                  await tx.emailChangeIntent.upsert({
                    where: { userId },
                    create: {
                      userId,
                      sessionId: session.session.id,
                      currentEmail,
                      newEmail: target,
                      phase: "current",
                      expiresAt: new Date(Date.now() + 600_000),
                    },
                    update: {
                      sessionId: session.session.id,
                      currentEmail,
                      newEmail: target,
                      phase: "current",
                      expiresAt: new Date(Date.now() + 600_000),
                    },
                  });
                  nativePath = "/email-otp/send-verification-otp";
                  nativeBody = { email: currentEmail, type: "email-verification" };
                  expectedDelivery = true;
                } else {
                  const intent = await tx.emailChangeIntent.findUnique({ where: { userId } });
                  if (
                    !intent ||
                    intent.sessionId !== session.session.id ||
                    intent.currentEmail !== currentEmail ||
                    intent.expiresAt <= new Date() ||
                    intent.phase !== (path.endsWith("confirm-current") ? "current" : "new")
                  )
                    return failure(400);
                  target = intent.newEmail;
                  nativePath = path.endsWith("confirm-current")
                    ? "/email-otp/request-email-change"
                    : "/email-otp/change-email";
                  nativeBody = { newEmail: target, otp: body.code };
                  // Native occupied-address response deliberately has no callback.
                  expectedDelivery =
                    path.endsWith("confirm-current") &&
                    !(await tx.user.findUnique({ where: { email: target } }));
                }
                proofIdentifiers = bindHandoverProofs(await localAuth.$context, secret, {
                  userId,
                  sessionId: session.session.id,
                  currentEmail,
                  newEmail: target,
                });
              }
              if (
                path !== "/email-change/start" &&
                !(await budget(
                  tx,
                  emailKey(secret, issuing ? "issue" : "verify", budgetIdentity),
                  issuing ? 5 : 15,
                ))
              )
                return failure(429, "too_many_requests");
            }
            const headers = new Headers(request.headers);
            headers.set("content-type", "application/json");
            headers.delete("content-length");
            const response = await localAuth.handler(
              new Request(new URL(basePath + nativePath, baseURL), {
                method: "POST",
                headers,
                body: JSON.stringify(nativeBody),
              }),
            );
            if (
              deliveryFailed ||
              (response.ok && expectedDelivery && deliveryCount !== 1) ||
              response.status >= 500
            )
              throw new Error("Auth transaction failed");
            if (codePaths.has(path)) {
              if (response.ok && path.endsWith("confirm-current"))
                await tx.emailChangeIntent.update({ where: { userId }, data: { phase: "new" } });
              if (response.ok && path.endsWith("confirm-new")) {
                const context = await localAuth.$context;
                await context.internalAdapter.deleteSessions(
                  (await tx.session.findMany({ where: { userId }, select: { token: true } })).map(
                    (session) => session.token,
                  ),
                );
                // Old-address challenges must not recreate access during handover.
                await context.internalAdapter.deleteVerificationByIdentifier(
                  `sign-in-otp-${currentEmail}`,
                );
                await context.internalAdapter.deleteVerificationByIdentifier(
                  `email-verification-otp-${currentEmail}`,
                );
                await tx.emailChangeIntent.delete({ where: { userId } });
                response.headers.delete("set-cookie");
                response.headers.delete("set-auth-token");
              }
              await tx.authAudit.create({
                data: {
                  userId,
                  action: path.slice(1).replaceAll("/", "."),
                  outcome: response.ok ? "success" : "rejected",
                },
              });
            }
            await options.beforeCommit?.();
            if (!response.ok && codePaths.has(path)) return failure(response.status);
            response.headers.set("Cache-Control", "no-store");
            return response;
          },
          { maxWait: 5000, timeout: 15000 },
        );
      } catch {
        return failure(503, "service_unavailable");
      }
    },
  };
}
