import { afterAll, beforeAll, describe, expect, it } from "bun:test";
import { createHmac, randomBytes } from "node:crypto";
import { resolve } from "node:path";
import { PrismaPg } from "@prisma/adapter-pg";
import { emailOTP, magicLink } from "better-auth/plugins";
import { createAuth } from "../src/auth/create-auth";
import { PrismaClient } from "../src/generated/prisma/client";

// Compatibility evidence only. Production does not register this plugin until
// the purpose-binding, link and delivery recovery gates have passed.
describe("pinned auth-delivery integration spike", () => {
  const secret = randomBytes(32).toString("hex");
  const captures = new Map<string, string>();
  let failCapture = false;
  const prisma = new PrismaClient({
    adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }),
  });
  const hash = async (otp: string) => createHmac("sha256", secret).update(otp).digest("hex");
  const makeAuth = () =>
    createAuth({
      prisma,
      secret,
      baseURL: "http://localhost:4000",
      plugins: [
        emailOTP({
          otpLength: 8,
          expiresIn: 300,
          allowedAttempts: 3,
          resendStrategy: "rotate",
          storeOTP: { hash },
          changeEmail: { enabled: true, verifyCurrentEmail: true },
          sendVerificationOTP: async ({ email, otp, type }) => {
            if (failCapture) throw new Error("Synthetic capture failure");
            captures.set(`${type}:${email}`, otp);
          },
        }),
        magicLink({
          storeToken: "hashed",
          sendMagicLink: async ({ email, url }) => {
            captures.set(`magic-link:${email}`, url);
          },
        }),
      ],
    });
  const auth = makeAuth();
  const secondAuth = makeAuth();
  const address = () => `spike-${crypto.randomUUID()}@example.com`;
  const post = (path: string, body: Record<string, unknown>, cookie?: string, instance = auth) =>
    instance.handler(
      new Request(`http://localhost:4000/api/v1/auth${path}`, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          origin: "http://localhost:4000",
          ...(cookie ? { cookie } : {}),
        },
        body: JSON.stringify(body),
      }),
    );
  async function issue(email: string, type = "sign-in") {
    expect((await post("/email-otp/send-verification-otp", { email, type })).status).toBe(200);
    const otp = captures.get(`${type}:${email}`);
    if (!otp) throw new Error("Expected local capture");
    return otp;
  }
  const complete = (email: string, otp: string, instance = auth) =>
    post("/sign-in/email-otp", { email, otp, name: "Spike reader" }, undefined, instance);
  async function account(email: string) {
    const response = await complete(email, await issue(email));
    expect(response.status).toBe(200);
    const body = await response.json();
    const cookies = response.headers.getSetCookie().map((value) => value.split(";")[0]);
    return { id: body.user.id as string, cookie: cookies.join("; ") };
  }
  beforeAll(async () => {
    const manifest = await Bun.file(
      resolve(__dirname, "../node_modules/better-auth/package.json"),
    ).json();
    expect(manifest.version).toBe("1.6.23");
  });
  afterAll(async () => {
    captures.clear();
    await prisma.$disconnect();
  });

  it("stores a keyed hash, onboards once, and rejects replay and GET consumption", async () => {
    const email = address();
    const otp = await issue(email);
    const records = await prisma.verification.findMany({
      where: { identifier: `sign-in-otp-${email}` },
    });
    expect(records).toHaveLength(1);
    expect(records[0].value).toBe(`${await hash(otp)}:0`);
    const prefetch = await auth.handler(
      new Request("http://localhost:4000/api/v1/auth/sign-in/email-otp"),
    );
    expect(prefetch.status).not.toBe(200);
    expect(await prisma.user.count({ where: { email } })).toBe(0);
    expect((await complete(email, otp)).status).toBe(200);
    expect((await complete(email, otp)).status).toBe(400);
    const user = await prisma.user.findUniqueOrThrow({ where: { email } });
    expect(await prisma.hub.count({ where: { ownerUserId: user.id } })).toBe(1);
    expect(await prisma.session.count({ where: { userId: user.id } })).toBe(1);
  });

  it("rotates on resend and consumes only the latest code", async () => {
    const email = address();
    const old = await issue(email);
    // Distinct creation timestamps let the actual schema's recency selection
    // choose the latest challenge without a synthetic unique-index change.
    await Bun.sleep(5);
    const fresh = await issue(email);
    expect(fresh).not.toBe(old);
    expect((await complete(email, old)).status).toBe(400);
    expect((await complete(email, fresh)).status).toBe(200);
    expect((await complete(email, old)).status).toBe(400);
    expect(await prisma.verification.count({ where: { identifier: `sign-in-otp-${email}` } })).toBe(
      0,
    );
  });

  it("allows one winner across two auth instances and rejects expired proof", async () => {
    const email = address();
    const otp = await issue(email);
    const results = await Promise.all([complete(email, otp), complete(email, otp, secondAuth)]);
    expect(results.map((r) => r.status).sort()).toEqual([200, 400]);
    const expiredEmail = address();
    const expired = await issue(expiredEmail);
    await prisma.verification.updateMany({
      where: { identifier: `sign-in-otp-${expiredEmail}` },
      data: { expiresAt: new Date(Date.now() - 1000) },
    });
    expect((await complete(expiredEmail, expired)).status).toBe(400);
    expect(await prisma.user.count({ where: { email: expiredEmail } })).toBe(0);
  });

  it("enforces the native wrong-code attempt budget", async () => {
    const email = address();
    const otp = await issue(email);
    for (let i = 0; i < 3; i++) expect((await complete(email, "not-a-code")).status).toBe(400);
    expect((await complete(email, otp)).status).toBe(403);
    expect(await prisma.user.count({ where: { email } })).toBe(0);
  });

  it("documents stock magic links consuming on GET and remaining independent of the OTP", async () => {
    const email = address();
    const otp = await issue(email);
    expect((await post("/sign-in/magic-link", { email, name: "Link reader" })).status).toBe(200);
    const url = captures.get(`magic-link:${email}`);
    if (!url) throw new Error("Expected local magic-link capture");
    expect(await prisma.user.count({ where: { email } })).toBe(0);
    // A mail scanner's GET is enough to consume the separate native link.
    const response = await auth.handler(new Request(url));
    expect(response.status).toBe(302);
    const user = await prisma.user.findUniqueOrThrow({ where: { email } });
    expect(await prisma.session.count({ where: { userId: user.id } })).toBe(1);
    // The code still works: these plugins do not share one challenge.
    expect((await complete(email, otp)).status).toBe(200);
    expect(await prisma.session.count({ where: { userId: user.id } })).toBe(2);
  });

  it("documents the native email-change gaps: generic current proof and surviving sessions", async () => {
    const email = address();
    const user = await account(email);
    const other = await complete(email, await issue(email));
    expect(other.status).toBe(200);
    expect(await prisma.session.count({ where: { userId: user.id } })).toBe(2);
    // Issuance does not accept/name a target address. It is ordinary email
    // verification, yet the native change flow accepts it for any new address.
    const currentProof = await issue(email, "email-verification");
    const newEmail = address();
    const requested = await post(
      "/email-otp/request-email-change",
      { newEmail, otp: currentProof },
      user.cookie,
    );
    expect(requested.status).toBe(200);
    expect((await prisma.user.findUniqueOrThrow({ where: { id: user.id } })).email).toBe(email);
    const newProof = captures.get(`change-email:${newEmail}`);
    expect(typeof newProof).toBe("string");
    expect(
      (await post("/email-otp/change-email", { newEmail, otp: newProof }, user.cookie)).status,
    ).toBe(200);
    expect((await prisma.user.findUniqueOrThrow({ where: { id: user.id } })).email).toBe(newEmail);
    // These assertions record incompatibility, not acceptance of this behavior.
    expect(await prisma.session.count({ where: { userId: user.id } })).toBe(2);
  });

  it("documents callback failure returning success without delivery and proves resend recovery", async () => {
    const email = address();
    failCapture = true;
    try {
      expect(
        (await post("/email-otp/send-verification-otp", { email, type: "sign-in" })).status,
      ).toBe(200);
    } finally {
      failCapture = false;
    }
    expect(captures.has(`sign-in:${email}`)).toBe(false);
    expect(await prisma.verification.count({ where: { identifier: `sign-in-otp-${email}` } })).toBe(
      1,
    );
    const recovered = await issue(email);
    expect((await complete(email, recovered)).status).toBe(200);
  });
});
