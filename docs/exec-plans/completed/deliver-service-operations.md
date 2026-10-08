# Deliver the complete service-operator journey

## Purpose / Big Picture

Deliver email-code sign-in and a usable service-operations surface: an explicitly
granted operator finds accounts, suspends/reactivates accounts, revokes sessions,
holds/releases published collections and reviews an audit trail. Operators never
gain private-content access. The authoritative contract is
`docs/design-docs/service-operations.md`; the user approved proceeding on
2026-10-06. This milestone includes its backend, migrations, UI, tests and runbook.

## Progress

- [x] (2026-10-06) Read the approved operations contract and existing auth,
  collection/resource/export paths. Applied Impeccable under current web tokens.
- [x] (2026-10-06) Added/reviewed the additive migration, wire contracts and
  shared serialized authority boundary.
- [x] (2026-10-06) Implemented operations, interactive grant/recovery command,
  independent operator audit and bounded 365-day cleanup.
- [x] (2026-10-06) Added account/hold checks to auth, content policy,
  discovery/shared/saved lists, reference/resources, exports and redistribution.
- [x] (2026-10-06) Built native sign-in/code/session forms, operator accounts,
  moderation and audit pages under the existing interface tokens.
- [x] (2026-10-06) Twelve real HTTP operator cases passed, including proof
  revocation, handover, competing actions, audited rollback and grant recovery.
- [x] (2026-10-06) Focused production browser journeys pass with and without
  JavaScript, including sign-in, account actions, moderation, audit and recovery.
- [x] (2026-10-06) Full verification passed 132 tests plus builds, types and
  static gates; production browser acceptance passed all 22 cases.
- [x] (2026-10-06) Dev-loop acceptance passed with disposable DB/queues and
  the existing Compose project; owned API/worker/web processes shut down cleanly.
- [x] (2026-10-06) Reconciled documentation, changelog and handoff; implementation
  is ready for milestone review.
- [x] (2026-10-06) At the user's request, applied the pending release-foundations,
  auth-delivery and service-operations migrations to local `nslinkhub` on
  `127.0.0.1:5436`. Migration status is current and schema diff reports no difference.
- [x] (2026-10-06) Granted the user-designated account through the interactive
  audited CLI after ordinary email-code verification. Verified the grant/audit;
  the user confirmed `/ops` and operator navigation in their browser. Real
  email, user IDs, codes and session secrets are excluded from these notes.
- [x] (2026-10-06) Compared Pigfarm and reproduced successful but silent web
  startup. Added workspace script delegation and explicit readiness/failure
  output. Dev-loop acceptance and full verification (132 tests) passed; the
  restarted local web returned 200 and printed its ready URL. Corrected only
  the ignored local sender display name; templates were already branded.
- [x] (2026-10-06) Email-selector follow-up passed 134 tests, then the user
  superseded direct operator commands with admin-only invitations and recipient
  acceptance. Continue in `deliver-admin-operator-invitations.md`; do not
  commit or present the old command as the final authority model.
- [x] (2026-10-06) Admin/invitation follow-up implemented and locally migrated.
  Full gate passed 141 tests, browser passed 23 and the filter-based dev loop
  passed. Startup sent the authorized admin invitation; acceptance remains the
  recipient's action. Direct grant commands are removed.
- [x] (2026-10-08) User review, then milestone commit and guide-only repinning follow-up. Done: reviewed and committed.

## Surprises & Discoveries

- The working tree contains the approved scope documentation and an unrelated
  Next-generated dev-type path change. Preserve that generated file. A live dev
  server may use this checkout: builds/runtime checks will use an isolated copy.
- Raw better-auth routes run outside Nest guards; suspension must cover both.
- Existing content mutations mix standalone queries and nested transactions;
  authorization must be rechecked under the same serialization lock as operator
  changes, rather than relying on an earlier guard or collection read.

- Chromium sends `Origin: null` on native POST from `no-referrer` documents.
  Keep strict Origin validation; use `strict-origin` document referrers instead
  (origin only, never token-bearing paths). External resource links retain
  `no-referrer`. The complete native browser flow now passes.
- The old private-save test expected 400 before authorization. It now proves
  hidden/missing 404 equivalence, while an owner retains the actionable 400
  response for trying to save their unpublished collection.

- All 22 browser cases initially passed but fixture teardown timed out. The
  native-form source-budget test left pooled API HTTP connections open. Closing
  the fixture-owned listener connections before Nest shutdown fixes the focused
  case; it changes no production shutdown behavior.

## Decision Log

- Decision: Reuse the existing PostgreSQL advisory lock (74201931) as the first
  lock for authenticated product mutations, auth mutations and operator/grant
  changes; then acquire existing row locks. Use a request transaction context
  for product services so nested transactions join the same unit of work.
  Rationale: At the current scale one serialized write boundary provides a
  concrete ordering for suspension, grant revocation, transfer and resource-reference
  races without fragile checks distributed across each controller.
  Date/Author: 2026-10-06 / Codex.
- Decision: Server-render forms and submit through same-origin web route handlers,
  forwarding only session cookies and bounded JSON to the API. No-JavaScript
  sign-in/actions remain usable; redirects use validated local paths.
  Rationale: Reuse the HTTP-only web boundary with native form recovery.
  Date/Author: 2026-10-06 / Codex.

- Decision: Use a separate HMAC domain for native form source attribution.
  Rationale: Server-submitted auth/actions must retain per-visitor budgets;
  existing read proofs must not gain write authority. The edge overwrites both
  headers and the API still validates sessions, grants and Origin independently.
  Date/Author: 2026-10-06 / Codex.

## Outcomes & Retrospective

The complete local operator journey is implemented and ready for review.
Verification passed 132 tests plus API/web builds, typechecks and static gates;
production browser acceptance passed all 22 cases, including native forms with
and without JavaScript. The dev-loop gate passed API/worker/web startup, API
rewrite and bounded shutdown. Desktop audit screenshots were inspected;
overflow checks cover 320, 390, 768 and 1280px.

Evidence: `/tmp/operations-verify-final.log`,
`/tmp/operations-browser-final.log`, `/tmp/operations-dev-final.log`, and
`/tmp/w3-operations-audit-true.png`. Runtime verification used
`/tmp/nslinkhub-ops-acceptance-ndl4vyjg`; the dev-loop command needed
`COMPOSE_PROJECT_NAME=nslinkhub` to reuse existing local infrastructure. An
initial temporary-project name collision created only an empty network/volume;
those owned resources were removed. Final docs/guide/diff checks passed in the
real checkout. After verification, the user authorized local migrations: all
three pending additive migrations applied successfully to `nslinkhub` on
`127.0.0.1:5436`. `bunx prisma migrate status` reports up to date and
`bunx prisma migrate diff --from-config-datasource --to-schema prisma/schema.prisma`
reports no difference. The user then authorized first-operator setup: their
verified account received an audited CLI grant, and their browser confirmed
`/ops` access. No commit or push was performed.

Public release still requires the existing live sender/provider, topology,
telemetry and deployment acceptance. Personal collection management remains the
next W3 product journey. Close/move this plan after milestone review.

## Context And Orientation

Backend: `apps/api/prisma/schema.prisma`, `src/auth/delivery-auth.ts`,
`src/common/guards/auth.guard.ts`, `src/database/prisma.service.ts`, and domain
services in `src/modules/{hubs,collections,resources,exports}`. All paths are
under `apps/api` unless prefixed otherwise. Existing auth serialization is in
`delivery-auth.ts`. Existing audit is hub scoped; operator audit is separate.
Web: `apps/web/src/app`, `src/lib/server-api.ts` and current CSS tokens.
Wire contracts: `packages/types/src`. Acceptance fixtures live in
`apps/api/test` and `apps/api/test/browser/reading.browser.ts`.

## Plan Of Work

Add account state/version, operator grant, collection hold and operator audit
models through an additive migration, reviewing generated SQL for preserved
custom objects. Add shared contracts and a dedicated operations module. Build
the common transaction context and revalidate request principals under the
authority lock. Ensure new sessions have a non-refreshable verification time;
raw auth reads/writes reject suspended identities and handover revokes grants.

Apply restrictions before ordinary collection grants and before paginating
public lists; neutralize held reference targets and exported references. Protect all
redistribution paths, while allowing active owners to correct
content and remove sharing. Implement audited operations with recent cookie
authentication, versions, idempotency and restricted reason codes. Add an
bounded audit cleanup. The deployment grant command was superseded before
review by accepted admin/operator invitations in the linked follow-up plan.

Use existing tokens to build native sign-in/code forms, signed-in navigation,
operator account lists/details, collection enforcement and audit. Include safe
returns, pending/error/conflict/reauthentication states and no automatic replay.
Prove the complete flow with isolated fixtures and actual production browser
requests, then document the operator lifecycle and reconcile status documents.

## Concrete Steps

Use Bun throughout. Generate migrations with `bunx prisma migrate dev
--create-only` from `apps/api` against a disposable database, review the SQL,
then regenerate types. Run focused API tests with the existing isolated runner.
Run `bun run verify` and `bun run test:browser` sequentially in an isolated copy
if the dev server remains active. Run `bun run test:dev` only if dev entrypoints
change. Preserve capture email, test-owned databases/queues and environment masks.

## Validation And Acceptance

- Explicit grants only; ordinary/bearer/suspended/revoked users cannot use ops.
- Suspension and handover revoke sessions/proofs/grants; recent verification
  is required for mutations; reactivation never restores a revoked credential.
- Cookie Origin checks, fresh authority checks, operator peer protection and invitation races, same-ID
  retries, conflicting retries, stale versions and audit rollback are tested.
- Restriction composition covers public/shared/saved lists, stable/pretty links,
  reference/resource/export reads, owner corrections and redistribution races.
- No private content, secrets or searched email is copied into operator audit.
- Native forms, code resend/errors, sign-out/history, responsive keyboard use
  and recovery work through the real web origin; existing journeys still pass.
- Grant/revoke/recovery and 365-day audit cleanup are documented and tested.

## Idempotence And Recovery

Migrations are additive and reviewed; never reset developer data. Test fixtures
own their databases and queues; acceptance never grants or suspends real users.
The subsequent real first-operator grant was explicitly requested by the user.
Operator actions require explicit versions/operation IDs; retries cannot silently
reapply a different action. The deployment command confirms the immutable target
and explicitly handles last-grant revocation. Preserve all existing user edits.

Follow-up launcher evidence: `/tmp/operations-dev-setup.log`,
`/tmp/operations-setup-verify.log`, and `/tmp/nslinkhub-local-dev-setup.log`.
Root `bun run dev` is running locally at `http://localhost:3000` after the
requested setup; a second runner will correctly refuse the occupied ports.

## Artifacts And Notes

Baseline: status milestone `202f30c`, guide follow-up `625c0a9`. Scope definition
passed 118 tests before implementation. Implementation evidence will be recorded
here; scope-only verification does not prove the new features. No remote push
is authorized. Repin the onboarding guide only after a reviewed milestone commit.

## Interfaces And Dependencies

Keep better-auth behind app-owned integration, `AuthUser` as the principal,
Prisma backend-only, and all web access over HTTP. Preserve UUIDv7 identities,
collection policy, no-store reads, Origin checks, safe typed errors and source
budgets. No new IAM provider, role hierarchy, account deletion or MFA is added.
