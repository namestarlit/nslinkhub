import { describe, expect, it } from "bun:test";
import type { CodeEmailBaseInput } from "./code-email.js";
import { renderEmailChangeConfirmation } from "./email-change-confirm.js";
import { renderLoginCode } from "./login-code.js";
import { renderNewEmailVerification } from "./verify-new-email.js";

const valid: CodeEmailBaseInput = {
  locale: "en",
  code: "729337",
  supportUrl: "https://example.com/support",
  expiresInMinutes: 10,
};

describe("code emails", () => {
  it("every template renders both formats with the code and warning without authentication links", async () => {
    const emails = [
      await renderLoginCode(valid),
      await renderEmailChangeConfirmation({ ...valid, newEmail: "new@example.com" }),
      await renderNewEmailVerification(valid),
    ];
    for (const email of emails) {
      for (const body of [email.html, email.text]) {
        expect(body).toContain("729337");
        expect(body).not.toContain("token=");
        expect(body).not.toContain("use this link");
        expect(body).toContain(valid.supportUrl);
        expect(body).toContain("Do not share this code");
      }
      // Subjects never carry the code.
      expect(email.subject).not.toContain(valid.code);
      expect(email.subject.toLowerCase()).toContain("nslinkhub");
    }
  });

  it("the change confirmation names the target address; ignoring changes nothing", async () => {
    const email = await renderEmailChangeConfirmation({ ...valid, newEmail: "new@example.com" });
    expect(email.text).toContain("new@example.com");
    expect(email.text).toContain("nothing changes without this confirmation");
    await expect(
      renderEmailChangeConfirmation({ ...valid, newEmail: "not-an-email" }),
    ).rejects.toThrow(/newEmail/);
  });

  it("handles the singular expiry unit", async () => {
    const email = await renderLoginCode({ ...valid, expiresInMinutes: 1 });
    expect(email.text).toContain("next 1 minute.");
    expect(email.text).not.toContain("1 minutes");
  });

  it("rejects non-https URLs, malformed codes, and out-of-bounds expiry", async () => {
    await expect(renderLoginCode({ ...valid, supportUrl: "http://example.com/x" })).rejects.toThrow(
      /supportUrl/,
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
