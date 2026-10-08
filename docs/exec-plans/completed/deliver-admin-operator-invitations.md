# Bootstrap an admin and require accepted operator invitations

## Purpose / Big Picture

Replace direct deployment grants with the user's requested authority model:
bootstrap an initial verified service admin, let only admins invite/revoke
operators, and require each recipient to explicitly accept an emailed invitation.
Keep account/moderation tools and private-content boundaries. The user confirmed
the initial account in conversation; real identity values stay out of repository
docs. Personal collection management follows this complete milestone.

## Progress

- [x] (2026-10-06) User replaced the direct operator CLI direction with admin-owned
  invitations and explicitly confirmed their verified account as initial admin.
- [x] (2026-10-06) Inspected auth, audit, outbox, operations and native web forms.
- [x] (2026-10-06) Document updated authority, bootstrap, invitation and recovery contracts.
- [x] (2026-10-06) Add/review additive persistence and implement backend workflows.
- [x] (2026-10-06) Deliver admin and invitee pages plus branded invitation email.
- [x] (2026-10-06) Remove direct operator commands, retain only admin emergency recovery.
- [x] (2026-10-06) Passed full verification (141 tests), 23 production browser
  tests and dev-loop acceptance. Applied the additive local migration, configured
  the authorized initial-admin email in ignored environment, and restored dev.
  Startup invitation is pending; provider delivery is recorded as sent (one
  attempt), bootstrap audit exists, and no admin grant exists before acceptance.
- [x] (2026-10-06) Reconciled plans, runbook, changelog and handoff; ready for review.
- [x] (2026-10-08) Recipient completes their own invitation acceptance; user reviews milestone
  before commit/push. Personal collection management remains the next milestone. Done: reviewed and committed.

## Surprises & Discoveries

The prior operator milestone is implemented, locally migrated and uncommitted.
Its first real operator setup succeeded. The follow-up email-selector CLI passed
134 tests, but this new request supersedes that command before milestone review.
The active dev stack is owned by this session; schema changes need a controlled
restart. Preserve the unrelated Next dev type-path edit and existing data.

Bun `--filter` pipes package streams even when its parent has a terminal. The
recovery command therefore uses the controlling terminal for explicit
confirmation. A synthetic prompt/cancel smoke check verified this without
sending mail or mutating accounts.

## Decision Log

- Two separate product grants: admin and operator. Admins have existing ops
  capabilities plus invitation/access management; ordinary operators cannot
  administer another operator or admin account. Neither reads private content.
- Bootstrap uses an explicit deployment email to issue the initial admin invitation.
  Persist a singleton pending/claimed bootstrap record; startup grants no role.
  The recipient verifies their email, supplies a display name and explicitly
  accepts before the UUID grant is created and `/ops` opens. Restart neither
  resends mail repeatedly nor restores revoked authority. Trusted interactive
  zero-admin recovery issues a new invitation; it never directly grants a role.
- Invitations begin at the emailed token before login. Read-only preview never
  creates an account. Consent creates new recipients' named accounts/hubs and
  queues an invitation-bound OTP. Every recipient verifies, including matching
  signed-in accounts. Only verification grants the role and creates a session;
  active inviter authority, expiry and UUID/email binding are checked again.
- Invitations expire after seven days. Creation/resend queues mail atomically
  through the existing encrypted outbox. Cancellation/revocation/handover never
  re-enables stale invites; audit uses IDs, never email or mail contents.
- Prefer exact Bun workspace filters for root package commands, per user preference.
  Directory selection remains appropriate for Prisma and filesystem tools.

## Outcomes & Retrospective

The final email-entry flow creates no account until explicit consent, and no
role until a fresh invitation-bound OTP is verified. Existing signed-in accounts
also verify; names are requested only for new accounts. Email OTP remains the
sole verification method for invitations and sensitive actions. The Review
invitation email action is now a filled button, inspected at desktop and phone
widths. All changes remain uncommitted for milestone review.

The corrected implementation passed the full gate (144 tests), 23 production
browser tests and the development-loop test. The reviewed additive invitation
migration was applied locally and Prisma reports no schema difference. Local
startup refreshes the still-pending tokenless bootstrap email once. The recipient
completes their own acceptance and verification; tests use disposable databases
and captured synthetic mail. Personal collection management is next.

## Context And Orientation

Backend: `apps/api/src/modules/operations`, `src/auth/delivery-auth.ts`,
`src/auth/revoke-account.ts`, `src/email/outbox.ts`, Prisma schema/migrations.
Web: native forms under `apps/web/src/app/forms`, `/ops` pages and session nav.
Shared contracts: `packages/types/src/operations.ts`; mail: `packages/email`.
Existing plan: `docs/exec-plans/completed/deliver-service-operations.md`.

## Plan Of Work

Add admin/bootstrap/invitation models and audit invitation references without
rewriting applied migrations. Reuse the shared authority lock for decisions,
mail enqueue, grant changes and audit. Queue bootstrap mail at startup and complete bootstrap only after emailed-token consent and invitation-bound email verification. Protect admin/operator targets,
cancel pending workflows on account/authority changes and provide explicit
admin recovery without a routine operator CLI.

Build `/ops/operators` invitation/delivery/access management and email-entry
preview/consent/code verification for both roles; `/invitations` lists status. Use the existing native forms,
recent-authentication redirects, confirmation, versions and operation IDs.
Reuse Impeccable's existing product register/tokens. Add email template and
isolated tests, reconcile canonical docs, then apply/setup locally.

## Concrete Steps

Use Bun and reviewed `prisma migrate dev --create-only` against a disposable DB.
Run `bun run verify`, `bun run test:browser`, and `bun run test:dev` sequentially
in the isolated acceptance checkout. No developer data resets or real test mail.
After success, `bunx prisma migrate deploy` on the authorized local database and
configure its ignored bootstrap email; restart the owned dev stack.

## Validation And Acceptance

Prove admin-only invitation/revocation, no implicit operator grant, multiple
operators, matching verified recipient, explicit accept/decline, expiry/resend/
cancel, wrong-account privacy, competing accept/revoke, inviter loss, handover,
suspension, audit/outbox rollback, idempotency and bootstrap/recovery behavior.
Production browsers must complete admin invitation to recipient acceptance with
and without JavaScript, including reauthentication and safe delivery states.
Existing reader/operator journeys remain green; role grants never bypass content.

## Idempotence And Recovery

Persist bootstrap completion so restart/email reuse cannot restore admin grants.
Pin existing invitation targets to user UUID and expected versions. Replaying
acceptance never recreates a revoked grant. Cleanup of expired/terminal invite
metadata after 30 days never removes an accepted operator grant. Use explicitly
scoped recovery for zero-admin lockout; no seeded password or sign-in bypass.

## Artifacts And Notes

Previous evidence: `/tmp/operator-email-verify.log` (134 tests).
Acceptance checkout: `/tmp/nslinkhub-ops-acceptance-ndl4vyjg`.
Keep real account emails/IDs, codes and sessions out of durable docs. No commit
or push is authorized before the milestone is reviewed.

## Interfaces And Dependencies

API owns all authority and transitions. better-auth owns authentication; UUID
identities and product grants remain independent of mutable addresses. Use
current mail worker/provider, scoped budgets, native POST and no-store policies.

Focused HTTP acceptance: nine invitation tests passed, including bootstrap
serialization, no implicit grants, admin/recipient boundaries, replay after
revocation, expiry/resend/cancel, delivery rollback and zero-admin recovery.

Production browser acceptance: 23 tests passed, including the full admin-to-
operator invitation journey with JavaScript enabled and disabled, reauthentication,
revocation, responsive widths and screenshot inspection. Additional handover
regression: ten operation tests passed, including removal of both roles and
cancellation of authored invitations. Final source gate passed 141 tests plus types/builds/static gates; the dev-loop
check passed API/worker/web scripts, readiness URL, sign-in, rewrite and shutdown.

Final evidence: `/tmp/admin-verify-final.log`, `/tmp/admin-browser.log`,
`/tmp/admin-dev.log`, `/tmp/admin-handover-http.log`. Invitation screenshots were
inspected and 320/768/1280 px layouts passed overflow checks. The interactive
`--filter` recovery prompt was exercised and cancelled without a mutation.
The pre-existing Next dev-type path edit is preserved and remains excluded from
the intended milestone commit. No real identity or credentials are stored here.

## Email-entry correction (2026-10-06)

The user clarified that acceptance begins from the emailed link, before ordinary
sign-in. Pigfarm ADR-0012 and its invitation acceptance/auth-plugin implementation
confirm the intended order. The previous sign-in-first journey is superseded.
Use a random emailed token (digest only in the database, fragment in the URL),
read-only preview, name required only for a new identity, explicit acceptance,
then a fresh invitation-bound email OTP for everyone. Consent creates a new
named account/hub if needed, records `verifying` and queues the code atomically.
It creates no role or session. Successful OTP verification creates the grant,
session and audit together. Matching signed-in sessions also verify a fresh code.
Wrong-account sessions must sign out first. Existing names are never overwritten.
Account invitation listings are status records, not alternate acceptance paths.
Resend rotates the token; idempotent acceptance cannot recreate revoked grants.
New accounts remain unverified until the invitation OTP verifies them. Raw
invitation tokens never reach logs, request URLs, audit, or analytics. Native
forms retain a manual email-link paste fallback when JavaScript is disabled.

- [x] Read Pigfarm ADR-0012, bootstrap, acceptance service and recipient UI.
- [x] Replace authenticated-ID acceptance with emailed-token preview/acceptance.
- [x] Implement existing/new/mismatched session journeys and OTP continuation.
- [x] Verify HTTP/browser/security paths, migrate locally and refresh the pending
  initial-admin email invitation if it has not already been accepted.

### Fresh proof and email button correction

The user clarified that everyone verifies email OTPs for invitations and
sensitive actions. TOTP is explicitly deferred. This supersedes the intermediate
Pigfarm-style matching-session shortcut and all earlier grant-on-consent wording.
Current operator mutations retain the five-minute email-verification requirement;
every invitation requires its own fresh, purpose-bound proof. Pending proof can
be resumed, rotated or cancelled; authority is rechecked at final verification.
The email's Review invitation action is a filled button using existing branding.

- [x] Require invitation-bound email OTP for every recipient; activate no role on consent.
- [x] Update email button, continuation UI and canonical requirements.
- [x] Complete HTTP (12 invitation tests), full verification (144 tests), production browser (23 tests) and dev-loop checks.
- [x] Apply the reviewed additive migration locally; schema parity confirmed.
- [x] Confirmed replacement bootstrap email delivered (one attempt), token present,
  invitation pending and no admin grant before recipient verification. API, web and
  mail worker are running locally.

Current evidence: `/tmp/invitation-proof-http.log`,
`/tmp/invitation-proof-verify.log`, `/tmp/invitation-proof-browser.log`,
`/tmp/invitation-proof-dev.log`. Inspected synthetic email previews:
`/tmp/nslinkhub-invitation-button.png` and its mobile variant, plus the
JavaScript-enabled/disabled invitation page screenshots. Earlier acceptance
counts above describe superseded intermediate flows, not this final contract.
