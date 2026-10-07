import { afterAll, describe, expect, it } from "bun:test";
import { createHmac, randomUUID } from "node:crypto";
import { connect, createServer, type Socket } from "node:net";
import { resolve } from "node:path";
import { PrismaPg } from "@prisma/adapter-pg";
import express from "express";
import Redis from "ioredis";
import request from "supertest";
import { EmailDelivery, startEmailQueue } from "../src/email/delivery";
import { deliveryKey, enqueueEmail } from "../src/email/outbox";
import { CaptureProvider, DeliveryError, ResendProvider } from "../src/email/provider";
import { resendWebhook } from "../src/email/webhook";
import { PrismaClient } from "../src/generated/prisma/client";

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }),
});
const secret = "test-delivery-encryption-secret-32-characters";
const suppressionSecret = "test-suppression-secret-independent-of-auth";
const capture = new CaptureProvider();
const delivery = new EmailDelivery(prisma, capture, secret);
async function message(to = `worker-${randomUUID()}@example.com`, authSecret = secret) {
  return prisma.$transaction((tx) =>
    enqueueEmail(tx, {
      secret: authSecret,
      suppressionSecret,
      supportUrl: "https://fixture-links.dev/support",
      to,
      code: "12345678",
      kind: "sign-in",
      identifier: randomUUID(),
    }),
  );
}
const signingKey = "synthetic-webhook-key";
function signedHook(data: Record<string, unknown>, type = "bounced", id = randomUUID()) {
  const app = express();
  const signing = `whsec_${Buffer.from(signingKey).toString("base64")}`;
  app.post("/hook", express.raw({ type: "application/json" }), resendWebhook(prisma, signing));
  const timestamp = String(Math.floor(Date.now() / 1000));
  const body = JSON.stringify({ type: `email.${type}`, data });
  const signature = createHmac("sha256", Buffer.from(signingKey))
    .update(`${id}.${timestamp}.${body}`)
    .digest("base64");
  return request(app)
    .post("/hook")
    .set("content-type", "application/json")
    .set("svix-id", id)
    .set("svix-timestamp", timestamp)
    .set("svix-signature", `v1,${signature}`)
    .send(body);
}
afterAll(async () => {
  capture.clear();
  await prisma.$disconnect();
});
describe("durable email delivery", () => {
  it("claims duplicates once, strips credentials, and never queues them in Redis", async () => {
    const row = await message();
    await Promise.all([delivery.deliver(row.id), delivery.deliver(row.id)]);
    expect(capture.messages.has(deliveryKey(row.id))).toBe(true);
    const stored = await prisma.emailOutbox.findUniqueOrThrow({ where: { id: row.id } });
    expect(stored.state).toBe("sent");
    expect(stored.payload).toBeNull();
    expect(stored.attempts).toBe(1);
    const prefix = `test-email-${randomUUID()}`;
    const runtime = startEmailQueue(
      delivery,
      process.env.REDIS_URL ?? "redis://127.0.0.1:6383",
      prefix,
    );
    try {
      await runtime.worker.pause();
      const queued = await message();
      await runtime.tick();
      await runtime.queue.add(
        "email-v1",
        { id: queued.id },
        { jobId: queued.id, removeOnComplete: true },
      );
      const job = await runtime.queue.getJob(queued.id);
      expect(job?.data).toEqual({ id: queued.id });
      const redis = new Redis(process.env.REDIS_URL ?? "redis://127.0.0.1:6383");
      try {
        const keys = await redis.keys(`${prefix}:*`);
        expect(keys.length).toBeGreaterThan(0);
        for (const key of keys) {
          const dump = await redis.dump(key);
          expect(dump ?? "").not.toContain("12345678");
          expect(dump ?? "").not.toContain("@example.com");
        }
      } finally {
        redis.disconnect();
      }
      await runtime.worker.resume();
      for (let i = 0; i < 100 && !capture.messages.has(deliveryKey(queued.id)); i++)
        await Bun.sleep(50);
      expect(capture.messages.has(deliveryKey(queued.id))).toBe(true);
      await runtime.worker.pause();
      await runtime.queue.obliterate({ force: true });
    } finally {
      await runtime.close();
    }
  }, 15_000);
  it("retries provider failure with one key, recovers stale claims and expires abandoned mail", async () => {
    const row = await message();
    let attempts = 0;
    const keys: string[] = [];
    const flaky = new EmailDelivery(
      prisma,
      {
        send: async (key, payload) => {
          keys.push(key);
          if (++attempts === 1) throw new DeliveryError(false);
          return capture.send(key, payload);
        },
      },
      secret,
    );
    await flaky.deliver(row.id);
    expect(
      (await prisma.emailOutbox.findUniqueOrThrow({ where: { id: row.id } })).payload,
    ).not.toBeNull();
    await prisma.emailOutbox.update({ where: { id: row.id }, data: { availableAt: new Date(0) } });
    await flaky.deliver(row.id);
    expect(keys).toEqual([deliveryKey(row.id), deliveryKey(row.id)]);
    const stale = await message();
    await prisma.emailOutbox.update({
      where: { id: stale.id },
      data: { leaseToken: randomUUID(), leaseUntil: new Date(0) },
    });
    await delivery.deliver(stale.id);
    expect(capture.messages.has(deliveryKey(stale.id))).toBe(true);
    const expired = await message();
    await prisma.emailOutbox.update({
      where: { id: expired.id },
      data: { expiresAt: new Date(0) },
    });
    await delivery.maintain();
    expect(
      (await prisma.emailOutbox.findUniqueOrThrow({ where: { id: expired.id } })).payload,
    ).toBeNull();
    expect(capture.messages.has(deliveryKey(expired.id))).toBe(false);
  });
  it("recovers after an actual worker process dies with a claim", async () => {
    const row = await message();
    const child = Bun.spawn(["bun", resolve(__dirname, "fixtures/delivery-process.ts")], {
      stdin: "pipe",
      stdout: "pipe",
      stderr: "pipe",
    });
    try {
      child.stdin.write(JSON.stringify({ id: row.id, secret }));
      child.stdin.end();
      const reader = child.stdout.getReader();
      const ready = await reader.read();
      expect(new TextDecoder().decode(ready.value)).toContain("claimed");
      reader.releaseLock();
      child.kill("SIGKILL");
      await child.exited;
      expect(
        (await prisma.emailOutbox.findUniqueOrThrow({ where: { id: row.id } })).leaseToken,
      ).not.toBeNull();
      await prisma.emailOutbox.update({ where: { id: row.id }, data: { leaseUntil: new Date(0) } });
      await delivery.deliver(row.id);
      expect(capture.messages.has(deliveryKey(row.id))).toBe(true);
    } finally {
      child.kill();
      await child.exited;
    }
  }, 15000);
  it("recovers durable mail after Redis disconnect and rejects poison jobs", async () => {
    const upstream = new URL(process.env.REDIS_URL ?? "redis://127.0.0.1:6383");
    const sockets = new Set<Socket>();
    let offline = true;
    const server = createServer((socket) => {
      if (offline) {
        socket.on("data", () => socket.end());
        return;
      }
      const remote = connect(Number(upstream.port), upstream.hostname);
      sockets.add(socket);
      sockets.add(remote);
      socket.on("error", () => {});
      remote.on("error", () => socket.destroy());
      socket.pipe(remote).pipe(socket);
      socket.on("close", () => {
        remote.destroy();
        sockets.delete(socket);
        sockets.delete(remote);
      });
    });
    await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
    const addr = server.address();
    if (!addr || typeof addr === "string") throw new Error("Missing test port");
    const prefix = `test-email-${randomUUID()}`;
    const runtime = startEmailQueue(delivery, `redis://127.0.0.1:${addr.port}`, prefix);
    try {
      const row = await message();
      await runtime.tick();
      expect((await prisma.emailOutbox.findUniqueOrThrow({ where: { id: row.id } })).state).toBe(
        "pending",
      );
      offline = false;
      for (let i = 0; i < 160 && !capture.messages.has(deliveryKey(row.id)); i++)
        await Bun.sleep(50);
      expect(capture.messages.has(deliveryKey(row.id))).toBe(true);
      const poison = await runtime.queue.add(
        "email-v1",
        { unexpected: "synthetic" },
        { removeOnFail: false },
      );
      for (let i = 0; i < 100 && (await poison.getState()) !== "failed"; i++) await Bun.sleep(20);
      expect(await poison.getState()).toBe("failed");
      await runtime.worker.pause();
      await runtime.queue.obliterate({ force: true });
    } finally {
      await runtime.close();
      for (const socket of sockets) socket.destroy();
      await new Promise<void>((resolve) => server.close(() => resolve()));
    }
  }, 20000);
  it("erases terminal failures and exhausted retries", async () => {
    for (const terminal of [true, false]) {
      const row = await message();
      if (!terminal)
        await prisma.emailOutbox.update({ where: { id: row.id }, data: { attempts: 4 } });
      await new EmailDelivery(
        prisma,
        {
          send: async () => {
            throw new DeliveryError(terminal);
          },
        },
        secret,
      ).deliver(row.id);
      const stored = await prisma.emailOutbox.findUniqueOrThrow({ where: { id: row.id } });
      expect(stored.state).toBe("failed");
      expect(stored.payload).toBeNull();
    }
  });
  it("reuses identical payload/key after provider success but bookkeeping failure", async () => {
    const row = await message();
    let failed = false;
    const proxy = new Proxy(prisma, {
      get(target, key) {
        if (key === "emailOutbox")
          return new Proxy(target.emailOutbox, {
            get(model, method) {
              if (method === "updateMany")
                return async (args: Parameters<typeof model.updateMany>[0]) => {
                  if (args?.data?.state === "sent" && !failed) {
                    failed = true;
                    throw new Error("synthetic commit loss");
                  }
                  return model.updateMany(args);
                };
              return Reflect.get(model, method);
            },
          });
        return Reflect.get(target, key);
      },
    });
    const flaky = new EmailDelivery(proxy, capture, secret);
    await expect(flaky.deliver(row.id)).rejects.toThrow("synthetic commit loss");
    const before = capture.messages.get(deliveryKey(row.id));
    expect(before).toBeDefined();
    await prisma.emailOutbox.update({ where: { id: row.id }, data: { leaseUntil: new Date(0) } });
    await delivery.deliver(row.id);
    expect(capture.messages.get(deliveryKey(row.id))).toBe(before);
    expect((await prisma.emailOutbox.findUniqueOrThrow({ where: { id: row.id } })).state).toBe(
      "sent",
    );
  });
  it("verifies raw signatures, handles duplicates/out-of-order status and suppresses bounced recipients", async () => {
    const row = await message();
    await delivery.deliver(row.id);
    const providerId = (await prisma.emailOutbox.findUniqueOrThrow({ where: { id: row.id } }))
      .providerId;
    const signing = `whsec_${Buffer.from("synthetic-webhook-key").toString("base64")}`;
    const app = express();
    app.post("/hook", express.raw({ type: "application/json" }), resendWebhook(prisma, signing));
    async function hook(
      type: string,
      id = randomUUID(),
      timestamp = String(Math.floor(Date.now() / 1000)),
      valid = true,
    ) {
      const body = JSON.stringify({ type: `email.${type}`, data: { email_id: providerId } });
      const signature = createHmac("sha256", Buffer.from("synthetic-webhook-key"))
        .update(`${id}.${timestamp}.${body}`)
        .digest("base64");
      return request(app)
        .post("/hook")
        .set("content-type", "application/json")
        .set("svix-id", id)
        .set("svix-timestamp", timestamp)
        .set("svix-signature", valid ? `v1,${signature}` : "v1,bad")
        .send(body);
    }
    expect(
      (await hook("delivered", randomUUID(), String(Math.floor(Date.now() / 1000)), false)).status,
    ).toBe(401);
    expect((await hook("delivered", randomUUID(), "1")).status).toBe(401);
    const id = randomUUID();
    expect((await hook("bounced", id)).status).toBe(204);
    expect((await hook("bounced", id)).status).toBe(204);
    expect((await hook("sent")).status).toBe(204);
    expect((await prisma.emailOutbox.findUniqueOrThrow({ where: { id: row.id } })).outcome).toBe(
      "bounced",
    );
    expect(await prisma.emailWebhook.count({ where: { id } })).toBe(1);
    expect(await prisma.emailSuppression.count({ where: { recipientKey: row.recipientKey } })).toBe(
      1,
    );
  });
  it("preserves recipient suppression when the auth secret rotates", async () => {
    const address = `rotation-${randomUUID()}@example.com`;
    const first = await message(address);
    await delivery.deliver(first.id);
    expect((await signedHook({ email_id: `capture-${deliveryKey(first.id)}` })).status).toBe(204);
    const before = await message(address);
    const after = await message(
      address.toUpperCase(),
      "rotated-auth-encryption-secret-32-characters",
    );
    expect(before.state).toBe("suppressed");
    expect(after.state).toBe("suppressed");
    expect(after.recipientKey).toBe(first.recipientKey);
    expect(after.payload).toBeNull();
    await delivery.deliver(after.id);
    expect(capture.messages.has(deliveryKey(after.id))).toBe(false);
  });
  it("reconciles lost provider receipts after code expiry without retaining or resending codes", async () => {
    for (const outcome of ["bounced", "complained"]) {
      const address = `expired-${randomUUID()}@example.com`;
      const row = await message(address);
      const proxy = new Proxy(prisma, {
        get(target, key) {
          if (key === "emailOutbox")
            return new Proxy(target.emailOutbox, {
              get(model, method) {
                if (method === "updateMany")
                  return async (args: Parameters<typeof model.updateMany>[0]) => {
                    if (args?.data?.state === "sent") throw new Error("synthetic receipt loss");
                    return model.updateMany(args);
                  };
                return Reflect.get(model, method);
              },
            });
          return Reflect.get(target, key);
        },
      });
      let sends = 0;
      const providerId = `accepted-${row.id}`;
      const worker = new EmailDelivery(
        proxy,
        {
          send: async (_key, _payload, reference) => {
            sends++;
            expect(reference).toBe(row.id);
            return providerId;
          },
        },
        secret,
      );
      await expect(worker.deliver(row.id)).rejects.toThrow("synthetic receipt loss");
      await prisma.emailOutbox.update({
        where: { id: row.id },
        data: { expiresAt: new Date(0), leaseUntil: new Date(0) },
      });
      await worker.maintain();
      const expired = await prisma.emailOutbox.findUniqueOrThrow({ where: { id: row.id } });
      expect(expired.state).toBe("expired");
      expect(expired.payload).toBeNull();
      expect(expired.providerId).toBeNull();
      const eventId = randomUUID();
      const data = { email_id: providerId, tags: { delivery_id: row.id } };
      expect((await signedHook(data, outcome, eventId)).status).toBe(204);
      expect((await signedHook(data, outcome, eventId)).status).toBe(204);
      expect((await signedHook(data, "sent")).status).toBe(204);
      const reconciled = await prisma.emailOutbox.findUniqueOrThrow({ where: { id: row.id } });
      expect(reconciled.providerId).toBe(providerId);
      expect(reconciled.outcome).toBe(outcome);
      expect(reconciled.state).toBe("expired");
      expect(reconciled.payload).toBeNull();
      expect(await prisma.emailWebhook.count({ where: { id: eventId } })).toBe(1);
      expect((await message(address, "rotated-auth-encryption-secret-32-characters")).state).toBe(
        "suppressed",
      );
      await worker.deliver(row.id);
      expect(sends).toBe(1);
    }
  });
  it("reconciles early signed receipts and rejects conflicting or malformed references", async () => {
    const row = await message();
    const other = await message();
    await delivery.deliver(other.id);
    const providerId = `early-${row.id}`;
    const data = { email_id: providerId, tags: { delivery_id: row.id } };
    expect((await signedHook(data)).status).toBe(503); // never attempted
    let sends = 0;
    const worker = new EmailDelivery(
      prisma,
      {
        send: async () => {
          sends++;
          expect((await signedHook(data, "delivered")).status).toBe(204);
          return providerId;
        },
      },
      secret,
    );
    await worker.deliver(row.id);
    await worker.deliver(row.id);
    expect(sends).toBe(1);
    const stored = await prisma.emailOutbox.findUniqueOrThrow({ where: { id: row.id } });
    expect(stored.state).toBe("sent");
    expect(stored.providerId).toBe(providerId);
    expect(stored.outcome).toBe("delivered");
    expect(stored.payload).toBeNull();
    expect(stored.leaseToken).toBeNull();
    expect((await signedHook({ ...data, email_id: "conflicting-id" })).status).toBe(503);
    expect((await signedHook({ ...data, tags: { delivery_id: other.id } })).status).toBe(503);
    expect((await signedHook({ ...data, tags: { delivery_id: "malformed" } })).status).toBe(400);
    expect((await signedHook({ email_id: "unknown-id" })).status).toBe(503);
    expect(await prisma.emailSuppression.count({ where: { recipientKey: row.recipientKey } })).toBe(
      0,
    );
  });
  it("Resend adapter sends only approved data with stable idempotency and safe errors", async () => {
    let seen: RequestInit | undefined;
    const transport = (async (_url: unknown, init: RequestInit) => {
      seen = init;
      return Response.json({ id: "synthetic-provider-id" });
    }) as typeof fetch;
    const provider = new ResendProvider("synthetic-key", "sender@example.com", transport);
    expect(
      await provider.send(
        "opaque-key",
        {
          to: "receiver@example.com",
          subject: "Code",
          html: "<p>12345678</p>",
          text: "12345678",
        },
        "opaque-delivery-reference",
      ),
    ).toBe("synthetic-provider-id");
    expect((seen?.headers as Record<string, string>)["Idempotency-Key"]).toBe("opaque-key");
    expect(JSON.parse(String(seen?.body)).tags).toEqual([
      { name: "delivery_id", value: "opaque-delivery-reference" },
    ]);
    expect(Object.keys(JSON.parse(String(seen?.body))).sort()).toEqual([
      "from",
      "html",
      "subject",
      "tags",
      "text",
      "to",
    ]);
  });
});
