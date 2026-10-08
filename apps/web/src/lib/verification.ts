// Every email-code situation is one flow with a purpose. The purpose decides
// the words on both screens and what happens once the code is accepted; the
// screens, cooldowns and code checks are shared.
export const verificationPurposes = [
  "sign-in", // clicked "Sign in"
  "first-link", // saving a first link while signed out
  "continue", // signing in to do something (comment, settings, a shared item…)
  "resume", // the session ended mid-action; the action continues afterwards
  "confirm", // signed in, but a sensitive action needs a fresh code
  "invitation", // accepting or resuming an operator/admin invitation
] as const;
export type VerificationPurpose = (typeof verificationPurposes)[number];

export interface VerificationCopy {
  title: string;
  /** Why we're asking, in one sentence. */
  reason: string;
  /** Shown under the send step; what happens after the code. */
  after: string;
  codeTitle: string;
  codeButton: string;
}

// What signing in will let someone do, from where they are going.
function destination(returnTo: string) {
  if (returnTo.includes("compose=comment")) return "join the discussion";
  if (returnTo.startsWith("/settings")) return "open your settings";
  if (returnTo.startsWith("/notifications")) return "see your notifications";
  if (returnTo.startsWith("/ops")) return "use service operations";
  if (/^\/(c\/|@)/.test(returnTo)) return "open this collection";
  return null;
}

export function verificationCopy(
  purpose: VerificationPurpose,
  context: { returnTo?: string; action?: string } = {},
): VerificationCopy {
  switch (purpose) {
    case "first-link":
      return {
        title: "Verify your email to save this link",
        reason: "Your first link goes into a private collection in your new hub.",
        after: "Enter the code we email you and your link is saved.",
        codeTitle: "Check your email",
        codeButton: "Verify and save",
      };
    case "resume":
      return {
        title: "Sign in to continue",
        reason: `Your session ended before we could ${context.action ?? "finish your action"}.`,
        after: "Sign in with a code and it continues where you left off.",
        codeTitle: "Check your email",
        codeButton: "Verify and continue",
      };
    case "confirm":
      return {
        title: "Confirm it's you",
        reason: `To ${context.action ?? "continue"}, we need a fresh email code.`,
        after: "Once the code is accepted, the action continues.",
        codeTitle: "Confirm it's you",
        codeButton: "Confirm and continue",
      };
    case "invitation":
      return {
        title: "Verify your email",
        reason: "Your invitation is ready to accept.",
        after: "Enter the code we email you to activate your role.",
        codeTitle: "Check your email",
        codeButton: "Verify and activate",
      };
    case "continue": {
      const goal = context.returnTo ? destination(context.returnTo) : null;
      if (goal)
        return {
          title: "Sign in",
          reason: `Sign in to ${goal}.`,
          after: "We'll email you an eight-digit code. No password needed.",
          codeTitle: "Check your email",
          codeButton: "Verify and continue",
        };
      return verificationCopy("sign-in");
    }
    default:
      return {
        title: "Sign in",
        reason: "Sign in or create your personal hub with your email.",
        after: "We'll email you an eight-digit code. No password needed.",
        codeTitle: "Check your email",
        codeButton: "Verify and continue",
      };
  }
}
