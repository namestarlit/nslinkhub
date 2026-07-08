import {
  assertValidBaseInput,
  type CodeEmailBaseInput,
  type RenderedEmail,
  renderCodeEmail,
} from "./code-email";

// Sign-in code: sent when someone continues with email on the sign-in screen.
// Template inputs follow the transactional-email doc: minimum variable set,
// no recipient address, opaque expiring URLs only. The subject never carries
// the code.
export interface LoginCodeEmailInput extends CodeEmailBaseInput {}

export async function renderLoginCode(input: LoginCodeEmailInput): Promise<RenderedEmail> {
  const errors = assertValidBaseInput(input);
  if (errors.length > 0) {
    throw new Error(`Invalid login-code email input: ${errors.join("; ")}`);
  }
  return renderCodeEmail("Your nslinkhub sign-in code", input, {
    preview: "Your nslinkhub sign-in code",
    lead: "Here's your verification code to sign in to nslinkhub:",
    actionLabel: "Sign in",
  });
}
