import { expect, it } from "bun:test";
import { openSignInFlow, resendTiming, sealSignInFlow } from "../src/lib/sign-in-flow";

it("keeps a throttled resend flow valid without moving issuance into the future", () => {
  const now = 1800000000000,
    secret = "test-flow-secret";
  const previous = { email: "reader@example.com", returnTo: "/hub", issued: now - 45000 };
  const timing = resendTiming(previous, { ok: false, status: 429, retryAfter: 60 }, 30, now);
  expect(timing).toEqual({ issued: previous.issued, retryAt: now + 60000 });
  const sealed = sealSignInFlow({ ...previous, ...timing }, secret);
  expect(openSignInFlow(sealed, secret, now)).toEqual({ ...previous, ...timing });
  expect(openSignInFlow(sealed, secret, previous.issued + 600001)).toBeNull();
  expect(resendTiming(previous, { ok: true }, 30, now)).toEqual({
    issued: now,
    retryAt: now + 30000,
  });
});

it("bounds cooldowns, preserves failures and rejects future or tampered flow issuance", () => {
  const now = 1800000000000,
    secret = "test-flow-secret";
  const flow = { email: "reader@example.com", returnTo: "/hub", issued: now, retryAt: now + 60000 };
  expect(resendTiming(flow, { ok: false, status: 503 }, 30, now)).toEqual({
    issued: now,
    retryAt: now + 60000,
  });
  expect(resendTiming(null, { ok: false, status: 429, retryAfter: 9999 }, 30, now)).toEqual({
    issued: now,
    retryAt: now + 600000,
  });
  expect(
    openSignInFlow(sealSignInFlow({ ...flow, issued: now + 1 }, secret), secret, now),
  ).toBeNull();
  expect(openSignInFlow(sealSignInFlow(flow, secret), "wrong-key", now)).toBeNull();
});
