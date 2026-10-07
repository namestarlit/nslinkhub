import { expect, it } from "bun:test";
import { createHmac } from "node:crypto";
import { verifiedWebReadSource } from "./web-read-source";

it("accepts only authenticated, bounded source proofs with an IP address", () => {
  const secret = "synthetic-source-secret";
  const now = Date.now();
  const sign = (source: string, issued = now) => {
    const payload = Buffer.from(JSON.stringify([1, source, issued])).toString("base64url");
    return `${payload}.${createHmac("sha256", secret).update(`web-read-source:${payload}`).digest("base64url")}`;
  };
  expect(verifiedWebReadSource(sign("192.0.2.1"), secret, now)).toBe("192.0.2.1");
  expect(verifiedWebReadSource(sign("2001:db8::1"), secret, now)).toBe("2001:db8::1");
  for (const proof of [
    sign("not-an-ip"),
    sign("192.0.2.1", now - 31000),
    sign("192.0.2.1", now + 6000),
    `${sign("192.0.2.1")}x`,
    `a.${"é".repeat(43)}`,
  ])
    expect(verifiedWebReadSource(proof, secret, now)).toBeUndefined();
  expect(verifiedWebReadSource(sign("192.0.2.1"), "wrong-key", now)).toBeUndefined();
  expect(verifiedWebReadSource(sign("192.0.2.1"), undefined, now)).toBeUndefined();
});

it("separates form attribution from read attribution", () => {
  const secret = "synthetic-form-source-secret",
    now = Date.now();
  const payload = Buffer.from(JSON.stringify([1, "192.0.2.8", now])).toString("base64url");
  const proof = `${payload}.${createHmac("sha256", secret).update(`web-form-source:${payload}`).digest("base64url")}`;
  expect(verifiedWebReadSource(proof, secret, now)).toBeUndefined();
  expect(verifiedWebReadSource(proof, secret, now, "form")).toBe("192.0.2.8");
  expect(verifiedWebReadSource(proof, secret, now + 31000, "form")).toBeUndefined();
});
