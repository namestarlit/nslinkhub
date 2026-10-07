# Unify email verification and resume interrupted actions

This ExecPlan is a living document, maintained according to `PLANS.md`. It is
complete and awaiting review.

## Purpose / Big Picture

Every situation that sends an email code (sign in, saving a first link, signing
in to do something, a session that ended mid-action, confirming a sensitive
operator action, accepting an invitation) used its own screen and wording, and
an action interrupted by an expired session was lost. After this change one
verification flow serves them all, worded for its purpose, and an interrupted
action continues by itself after the code — only for the person it belongs to.
Observe it by letting a session expire, posting a comment, signing back in:
the toast says "Comment posted" and the comment is there.

## Progress

- [x] (2026-10-07) Purposes and copy in `apps/web/src/lib/verification.ts`;
  shared screens `VerifyStart`/`VerifyCode` in `components/verification.tsx`.
- [x] (2026-10-07) Sign-in, confirm and code pages rebuilt on the shared screens;
  the "reauth" notice removed; codes pasted with spaces or dashes accepted.
- [x] (2026-10-07) Pending actions generalized (method, success notice, anchor)
  and used on 401 for comments, profile, operations, team actions and
  collection edits; replayed once after the code.
- [x] (2026-10-07) Copy spacing: short paragraphs, the address in bold, no extra
  panel; first send no toast, resend says "We sent a new code."
- [x] (2026-10-07) Toasts restyled to the page's surface, border and radius.
- [x] (2026-10-08) Waiting actions bound to their owner via a keyed fingerprint
  of the last signed-in email (`last_account` cookie); cleared on sign-out.
- [x] (2026-10-08) Docs: SECURITY, SYSTEM_DESIGN, interface system, service
  operations, ADR-0010, CHANGELOG.

## Surprises & Discoveries

- Observation: an expired session no longer identifies its user, so a waiting
  action could have replayed for a different person signing in on the same
  browser.
  Evidence: automated security review; fixed by the owner fingerprint and
  covered by the "stranger" browser scenario.
- Observation: after a reply posts, the "Add a comment" disclosure may be
  closed. Evidence: browser test; the test opens it when needed.

## Decision Log

- Decision: one flow with a purpose instead of per-feature screens.
  Rationale: consistent UX and one place for verification security.
  Date/Author: 2026-10-07 / Paul, Claude
- Decision: no Cancel on the code screen; "Didn't receive the code?" instead.
  Rationale: choosing Send code was the decision. Date/Author: 2026-10-07 / Paul
- Decision: the address is bold text, not a panel. Rationale: the reason line
  matters as much; a panel competed with the actions. Date/Author: 2026-10-07 / Paul
- Decision: replay only for the account that started the action; with no known
  owner, nothing is kept. Rationale: actions belong to someone.
  Date/Author: 2026-10-08 / Paul

## Outcomes & Retrospective

Delivered as planned. `bun run verify` green; browser suite 42/42, including the
confirm flow (Cancel sends nothing, spaced code accepted, action completes), the
discussion resume scenario and the stranger scenario (no comment created).

## Context And Orientation

Native forms post to `apps/web/src/app/forms/[action]/route.ts`. Encrypted
cookies (AES-GCM keyed from the web source secret) hold the sign-in flow and the
pending action (`lib/pending-action.ts`). The API answers `recent_auth_required`
for stale operator verification and 401 for an ended session.

## Plan Of Work

As in Progress; implemented in the web only. No API or schema change.

## Concrete Steps

`bun run verify`, then `bun run test:browser` (needs `bun run infra:up`).

## Validation And Acceptance

Browser scenarios in `apps/api/test/browser/reading.browser.ts`: first-link
("Verify and save"), invitations ("Verify and activate"), stale operator action
confirm flow, discussion "Sign in to join the discussion.", resume after session
end, stranger sign-in does not replay.

## Idempotence And Recovery

Replays run once: the cookie is cleared on use, expires after 15 minutes and
operator actions keep their operation id.

## Artifacts And Notes

None retained.

## Interfaces And Dependencies

`VerificationPurpose`, `verificationCopy`, `VerifyStart`, `VerifyCode`,
`PendingAction`, `keepPendingAction`, `accountFingerprint`, `lastAccountCookie`.
