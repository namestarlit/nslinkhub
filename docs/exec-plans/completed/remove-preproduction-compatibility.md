# Remove dead code and pre-production compatibility

## Purpose / Big Picture

The implementation exposes the current product without obsolete invitation
entry points, upgrade repairs or unused helpers. No deployed consumer needs
compatibility. Existing sign-in, emailed invitations, reading and editing keep
their complete journeys; upcoming people/hub and role/route work stays separate.

## Progress

- [x] (2026-10-08) Audited compatibility markers, route callers, exported symbols,
  styles, dependencies and TypeScript unused diagnostics.
- [x] (2026-10-08) Remove ID-only invitation status surfaces and bootstrap upgrade repair;
  retain notification messages and token-bound consent/verification.
- [x] (2026-10-08) Remove unused helpers, obsolete metadata wrappers and auth spike; simplify
  collection version checks and readiness casing without aliases.
- [x] (2026-10-08) Remove unused dependencies and enforce unused locals/parameters through
  shared TypeScript configuration.
- [x] (2026-10-08) Update focused docs/changelog, run source and browser gates, review diff.

## Surprises & Discoveries

- Bootstrap re-mails tokenless ID-only invitations despite no deployed data.
- The obsolete recipient invitation controller is the only consumer of the
  operations service's ordinary-account authority branch.
- Collection PATCH requires body `version` but also parses a second optional
  If-Match version, with no callers or documented need.
- Title-only metadata wrappers have only test callers; production uses metadata.
- `@nestjs/bullmq` and `@nestjs/mapped-types` have no imports. The worker uses
  BullMQ directly. Prisma runtime, React DOM and reflect-metadata are required
  framework dependencies and must remain.
- `/hub` is a live signed-in shortcut used by sign-in and recovery, not a dead
  alias. Safe unknown-error handling and no-JavaScript fallbacks are live
  reliability/accessibility behavior, not compatibility shims.
- Browser's `ready()` helper assumes a visible page heading. The removed route
  assertion must check its HTTP 404 directly, keeping the notification/sign-out
  journey on its live page. The first browser run passed 42/43; this assertion
  was corrected and the complete browser gate rerun.

## Decision Log

- Decision: Remove obsolete surfaces outright, with no redirects or aliases.
  Rationale: User direction and ADR-0006; there is no production deployment.
  Date/Author: 2026-10-08 / Codex.
- Decision: Normalize readiness's `redis_queue` wire field to `redisQueue`.
  Rationale: Remove the explicit compatibility exception to camelCase payloads;
  update all repository consumers together. Date/Author: 2026-10-08 / Codex.
- Decision: Retain schema/migrations and active API contracts for unbuilt web
  surfaces. Rationale: Existing API functionality and SQL history are not dead
  merely because the next web slice is pending. Date/Author: 2026-10-08 / Codex.

## Outcomes & Retrospective

Complete. Obsolete invitation entry points, upgrade repair, helpers, styles and
dependencies are removed; collection writes and readiness have one contract.
All 205 main-gate tests and 43 production browser journeys pass. Live invitation,
notification and sign-in workflows retain their security and no-JavaScript
coverage. Shared compiler checks prevent unused locals/parameters from returning.
No migrations or development-data reset were needed. Future person/hub identity,
role names and management routes remain their own product slice. The complete
diff, including prior documentation cleanup, was approved for commit on 2026-10-08.

## Context And Orientation

`apps/api/src/operations/invitations.ts` owns bootstrap and email links;
`modules/operations/administration.*` includes the obsolete recipient status
API. The live invitation journey is `/invitations/accept` → review → emailed
code, backed by `/api/v1/auth/invitations/*`. Notification messages are separate.
`page-metadata.ts` owns SSRF-safe metadata fetches. Shared contracts and config
live in `packages/types` and `packages/config`. ADR-0006 permits direct changes.

## Plan Of Work

Delete the obsolete invitation surface and its dependent service branches;
verify bootstrap restart does not send mail. Remove proven unused helpers and
exercise production metadata functions directly in tests. Keep one body-version
contract for collection writes and camelCase readiness. Remove unused Nest
adapters, update Bun's lockfile, and add compiler checks. Reconcile current
docs without rewriting historical plans, then verify the complete milestone.

## Concrete Steps

Use `rg` and TypeScript unused diagnostics to confirm callers. Use Bun for
dependency changes and checks. Run `bun run check`, `bun run verify` and
`bun run test:browser`, sequentially in an isolated checkout so the development
server's build output remains untouched. Finish with `git diff --check`.

## Validation And Acceptance

- Startup prepares one invitation and never performs an old-data upgrade.
- Notification and emailed consent/OTP journeys still work with and without JS;
  obsolete invitation-ID routes are absent and ordinary accounts gain no
  service-operator authority.
- Collection body versions still reject stale writes; readiness emits only
  camelCase keys, including safe error details.
- SSRF, timeout, redirect and metadata extraction tests exercise the live API.
- Source and production browser gates pass; no development DB reset or live mail.

## Idempotence And Recovery

Changes are reviewable in Git. No schema reset, migration or deployment is
required. Tests use disposable databases/capture email. Preserve the prior
documentation diff. Pin the onboarding guide only after the reviewed milestone
commit exists, following its normal commit workflow.

## Artifacts And Notes

Temporary audit scripts and verification logs live under `/tmp`; durable
findings and final test results belong here and in `CHANGELOG.md`.

- `bun run verify`: exit 0; 205 tests passed, no failures; API/web builds,
  typechecks, boundary checks, documentation links, formatting and lint passed.
  Checkout: `/tmp/nslinkhub-docs-verify-oJR5L3`; log:
  `/tmp/nslinkhub-cleanup-verify.log`.
- Lockfile review: removed the two direct Nest adapters and the unused
  BullMQ adapter's shared package; no version upgrades. `@nestjs/mapped-types`
  remains a required transitive dependency of Swagger.
- Latest documentation-only corrections also passed `bun run check:docs`,
  `bun run check:guide-pin` and `git diff --check` in the working checkout.
- `bun run test:browser`: exit 0; 43 passed, no failures; production asset
  canaries passed. Log: `/tmp/nslinkhub-cleanup-browser-rerun.log`. The removed
  invitation route returns 404 with JavaScript enabled and disabled, while
  notifications and sign-out continue on the live page.

## Interfaces And Dependencies

Removed routes: web `/invitations/:id`, API `GET /api/v1/invitations` and
`GET /api/v1/invitations/:id`. Live token workflows and admin invitation
management remain. Collection PATCH uses body `version`; readiness dependency
key is `redisQueue`. No new dependency or database object.
