# Deliver local release foundations before W3

## Purpose / Big Picture

Implement the public-release foundations first, following the user's
2026-10-05 order: #4, then #1–3 from the adoption comparison. Operators need
sanitized, correlated API telemetry, durable sensitive-action audit, abuse
protection, deployable images/topologies, and an executable verification and
recovery procedure. This is preparation, not authorization to publish or alter
a production system.

## Progress

- [x] (2026-10-05) Inspected existing runtime, reference telemetry, deployment
  direction, and audit mutation paths; requested non-secret live infrastructure
  references while proceeding with local work.
- [x] (2026-10-05) Implemented API LogTape/Sentry privacy/context boundary;
  real local SDK capture, collector failure and bounded shutdown passed.
- [x] (2026-10-05) Implemented transactional collection audit and shared
  PostgreSQL endpoint budgets; rollback, isolation and replica tests passed.
- [x] (2026-10-05) Built the API image from a context excluding generated
  clients; prepared CI/release workflows and both validated Swarm files.
  Added migration ordering and recovery runbook.
- [x] (2026-10-05) Local image boot, migration, restore, outage and shutdown
  rehearsal passed. Recorded outstanding live operator prerequisites.
- [x] (2026-10-05) Full `bun run verify` passed (67 tests: 4 email,
  16 API unit, 47 e2e); final image rehearsal passed including unreadable
  telemetry-secret startup privacy. Updated docs/changelog and prepared review.

## Surprises & Discoveries

- The API compiles to `dist/src/main.js`; the existing production script names
  `dist/main.js`. The production path must be tested, not inferred from dev.
- The backend currently has no worker or web app. Their images, browser spans,
  email delivery metrics, and sender rollout belong to later milestones.
- Reference redaction uses text patterns; NSLinkHub will allowlist outgoing
  telemetry and omit arbitrary framework/error messages to protect resource
  URLs, handles, titles, and share tokens beyond common PII patterns.

- A real SDK envelope exposed inherited `user.email` in metrics even though
  error/log hooks were safe. A separate metric allowlist now strips inherited
  SDK attributes; actual envelopes, not just serializers, are regression-tested.
- Bun may retry an aborted GET after a socket reset. Completion tests count
  incoming attempts by their unique IDs rather than assuming one client fetch
  always means one server request.
- Fresh TypeScript 6 installations exposed implicit ambient-type assumptions
  and deprecated alias configuration. Explicit email `types`, relative API
  aliases and `.js` shared type specifiers keep the frozen install compiling.
- Existing e2e touched the development DB. Pulled disposable test DBs and CI
  forward from #1 so shared request budgets never poison development traffic.
  Redis still only receives readiness pings; queue isolation arrives with jobs.
- Existing profile routes directly mutate credentials and delete accounts.
  Recorded their auth-ownership/session/retention corrections as pre-release
  gate 3 work; this local release foundation is not public-readiness approval.
- Review found that link enable could reuse a stale preflight token after
  rotation. Read the token state under the transaction lock; a regression test
  supplies a stale preflight snapshot and verifies the rotated hash survives.
- The local Docker daemon is not in Swarm mode. Did not initialize it. Both
  stack files pass `docker stack config`; standalone private-container tests
  prove image behavior, while Swarm scheduling/rolling-update proof stays open.

## Decision Log

- Decision: Reorder delivery to #4 then #1–3; pull forward only prerequisites
  needed to verify release foundations safely.
  Rationale: Explicit user direction overrides the earlier gate numbering.
  Date/Author: 2026-10-05 / user, recorded by Codex
- Decision: No live deploy or remote telemetry send without a concrete reviewed
  target. Local capture validates the SDK boundary while operator proof stays
  explicit; no secrets belong in this plan or chat.
  Rationale: User explicitly replied: "Prepare and verify locally first; live
  infrastructure comes later." Local completion does not close the full
  public-release gate.
  Date/Author: 2026-10-05 / Codex

## Outcomes & Retrospective

Local implementation and verification are complete; ready for milestone review.
The previous comparison remains in the same uncommitted working tree. No live
service was changed, and no migration was applied to the development database.
The next milestone is remaining #1 (typed safe 4xx errors, wire contracts and
link checks), then #2 W3 design/shell and #3 auth delivery. Full gate 4 remains
open for those runtime slices and live operational proof.

## Context And Orientation

`apps/api/src/entrypoint.ts` initializes telemetry before dynamically importing
Nest; `app.setup.ts` mounts IDs, telemetry and shared budgets before raw
better-auth and body parsers. The exception filter sanitizes unexpected 5xx
payloads; safe typed 4xx mapping remains #1. `HealthService` exposes liveness
and dependency readiness. Collection audit uses the same Prisma transaction
as its mutation. `compose.yml` stays dev-only; Dockerfile, stack files and
release workflows now live in the repository.

## Plan Of Work

First deliver the telemetry boundary with configuration, privacy rules,
request isolation, final request events, sanitized failures, metrics, and
source/compiled startup checks. Then add transactional audit and rate limits
with focused tests. Package the actual backend in an immutable image, provide
swarm topology and explicit migration/recovery commands, and test locally.
Record any external proof that cannot run without platform access separately
from application implementation status. Do not begin W3 before the local #4 review and remaining #1 foundation work.

## Concrete Steps

Use Bun from the repository root for installation and verification. Use
`bunx prisma migrate dev --create-only` from `apps/api` for schema work, review
SQL additions, and never reset development data. Run `bun run infra:up`,
`bun run verify`, telemetry capture/privacy/concurrency checks, fresh disposable
database migration checks, and image/stack smoke tests as artifacts land.

## Validation And Acceptance

- Concurrent requests have isolated server-generated IDs and trace context.
- Exactly one completion event per request; templates rather than raw paths.
- Tokens, bodies, emails, authored content, raw domain IDs, and arbitrary error
  strings cannot escape through console, SDK errors, spans, or logs.
- Source and compiled startup initialize one SDK before application imports;
  shutdown flushes with a bound, and telemetry failure cannot fail requests.
- Audit commits with the mutation and cannot be read across hub boundaries.
- Rate limits work across replicas without trusting spoofed proxy headers.
- The built image runs with `_FILE` secrets, refuses invalid production config,
  and exposes existing health contracts. Migrations run before traffic.
- Restore/collector/Sentry live proof is reported honestly and never inferred
  from passing local mocks. Full repository verification is green.

## Idempotence And Recovery

Use disposable local resources for probes; never obliterate shared queues,
reset databases, initialize Swarm on an existing host, or deploy live as an
implicit test. Migrations must be additive and preserve SQL-only invariants.
Read-only inspection and deterministic checks can be repeated.

## Artifacts And Notes

Pinned runtime: Bun 1.3.14, LogTape/sink 2.3.0, Sentry Bun 10.69.0.
Migration: `20261005145037_release_foundations` generated create-only then
reviewed; adds tables/indexes/CHECKs, drops no SQL-only invariants. Applied only
to disposable verification databases. Both Swarm files passed `docker stack config` with synthetic inputs; workflow
YAML parsed successfully. No hosted workflow or Swarm rollout was executed.
Checked 41 active/root local Markdown links and `git diff --check`; both passed.
Local logs are disposable evidence:
`/tmp/nslinkhub-release-verify.log`, `/tmp/nslinkhub-image-build.log`,
`/tmp/nslinkhub-image-rehearsal.log`. Durable commands and live prerequisites
are in `docs/runbooks/release.md`. The onboarding guide was swept; its commit
pin must advance in a guide-only follow-up after a reviewed commit exists.

## Interfaces And Dependencies

Preserve `AuthUser`, app-owned onboarding, `CollectionPolicyService`, UUIDv7,
camelCase wire shapes, synchronous exports, same-origin routing, Bun/Biome,
and the immutable-image/_FILE deployment contracts. LogTape and Sentry are
API dependencies; no telemetry provider owns product audit storage.
