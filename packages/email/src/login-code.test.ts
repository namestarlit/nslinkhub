import { describe, expect, it } from "bun:test";
import { type LoginCodeEmailInput, renderLoginCode } from "./login-code";

const valid: LoginCodeEmailInput = {
  locale: "en",
  code: "729337",
  signInUrl: "https://example.com/auth/verify?token=opaque",
  supportUrl: "https://example.com/support",
  expiresInMinutes: 10,
};

describe("renderLoginCode", () => {
  it("renders both formats with the code, sign-in link, and support route", async () => {
    const email = await renderLoginCode(valid);
    for (const body of [email.html, email.text]) {
      expect(body).toContain("729337");
      expect(body).toContain(valid.signInUrl);
      expect(body).toContain(valid.supportUrl);
      expect(body).toContain("Do not share this code");
    }
    expect(email.html).toContain('lang="en"');
  });

  it("keeps the code out of the subject", async () => {
    const email = await renderLoginCode(valid);
    expect(email.subject).not.toContain(valid.code);
    expect(email.subject).toContain("nslinkhub");
  });

  it("handles the singular expiry unit", async () => {
    const email = await renderLoginCode({ ...valid, expiresInMinutes: 1 });
    expect(email.text).toContain("next 1 minute.");
    expect(email.text).not.toContain("1 minutes");
  });

  it("rejects non-https URLs, malformed codes, and out-of-bounds expiry", async () => {
    await expect(renderLoginCode({ ...valid, signInUrl: "http://example.com/x" })).rejects.toThrow(
      /signInUrl/,
    );
    await expect(renderLoginCode({ ...valid, code: "12ab56" })).rejects.toThrow(/code/);
    await expect(renderLoginCode({ ...valid, expiresInMinutes: 0 })).rejects.toThrow(
      /expiresInMinutes/,
    );
    await expect(renderLoginCode({ ...valid, expiresInMinutes: 61 })).rejects.toThrow(
      /expiresInMinutes/,
    );
  });
});
