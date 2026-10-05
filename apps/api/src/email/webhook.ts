import { createHmac, timingSafeEqual } from "node:crypto";
import type { RequestHandler } from "express";
import type { PrismaClient } from "../generated/prisma/client";

const outcomes: Record<string, number> = {
  sent: 1,
  delivery_delayed: 2,
  delivered: 3,
  failed: 4,
  bounced: 5,
  suppressed: 6,
  complained: 7,
};
export function verifyWebhook(
  body: string,
  id: string,
  timestamp: string,
  signature: string,
  secret: string,
): boolean {
  if (!/^\d+$/.test(timestamp) || Math.abs(Date.now() / 1000 - Number(timestamp)) > 300)
    return false;
  const expected = createHmac("sha256", Buffer.from(secret.replace(/^whsec_/, ""), "base64"))
    .update(`${id}.${timestamp}.${body}`)
    .digest();
  return signature.split(" ").some((part) => {
    const [version, encoded] = part.split(",");
    if (version !== "v1" || !encoded) return false;
    const actual = Buffer.from(encoded, "base64");
    return actual.length === expected.length && timingSafeEqual(actual, expected);
  });
}
export function resendWebhook(prisma: PrismaClient, secret?: string): RequestHandler {
  return async (req, res) => {
    if (!secret) {
      res.sendStatus(503);
      return;
    }
    const id = req.header("svix-id") ?? "";
    const timestamp = req.header("svix-timestamp") ?? "";
    const signature = req.header("svix-signature") ?? "";
    if (
      !Buffer.isBuffer(req.body) ||
      id.length > 200 ||
      !id ||
      !verifyWebhook(req.body.toString(), id, timestamp, signature, secret)
    ) {
      res.sendStatus(401);
      return;
    }
    try {
      const event = JSON.parse(req.body.toString());
      const outcome = typeof event.type === "string" ? event.type.replace(/^email\./, "") : "";
      if (!outcomes[outcome]) {
        res.sendStatus(204);
        return;
      }
      if (
        typeof event.data?.email_id !== "string" ||
        !event.data.email_id ||
        event.data.email_id.length > 200
      ) {
        res.sendStatus(400);
        return;
      }
      const reference = event.data.tags?.delivery_id;
      if (
        reference !== undefined &&
        (typeof reference !== "string" ||
          !/^[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/.test(reference))
      ) {
        res.sendStatus(400);
        return;
      }
      const handled = await prisma.$transaction(async (tx) => {
        await tx.$executeRaw`SELECT pg_advisory_xact_lock(74201932)`;
        if (await tx.emailWebhook.findUnique({ where: { id } })) return true;
        const message = await tx.emailOutbox.findUnique({
          where: reference ? { id: reference } : { providerId: event.data.email_id },
        });
        // Signed provider tags survive both a lost send receipt and credential
        // expiry. Never use recipient addresses from the webhook for correlation.
        if (!message || message.attempts === 0) return false;
        const recorded = await tx.emailOutbox.updateMany({
          where: {
            id: message.id,
            OR: [{ providerId: null }, { providerId: event.data.email_id }],
          },
          data: {
            providerId: event.data.email_id,
            ...((outcomes[message.outcome ?? ""] ?? 0) < outcomes[outcome] ? { outcome } : {}),
          },
        });
        if (recorded.count !== 1) return false;
        // Provider acceptance is established: fence out an in-flight worker and
        // stop retries, while retaining already-expired/cancelled terminal states.
        await tx.emailOutbox.updateMany({
          where: { id: message.id, state: "pending" },
          data: { state: "sent", payload: null, leaseToken: null, leaseUntil: null },
        });
        await tx.emailWebhook.create({ data: { id } });
        if (["bounced", "complained", "suppressed"].includes(outcome)) {
          await tx.emailSuppression.upsert({
            where: { recipientKey: message.recipientKey },
            create: { recipientKey: message.recipientKey, reason: outcome },
            update: { reason: outcome },
          });
          await tx.emailOutbox.updateMany({
            where: { recipientKey: message.recipientKey, state: "pending", leaseUntil: null },
            data: { state: "suppressed", payload: null },
          });
        }
        return true;
      });
      res.sendStatus(handled ? 204 : 503);
    } catch {
      res.sendStatus(503);
    }
  };
}
