# Finish foundation contracts before W3

## Purpose / Big Picture

Complete remaining adoption gate #1 after the locally verified #4 milestone.
The first web client needs stable, safe error codes and mechanically checked
wire shapes. Contributors need local documentation links and disposable-test
cleanup checked by the normal verification gate. This milestone does not
start the web or change better-auth's credential ownership.

## Progress

- [x] (2026-10-05) Read current error/filter/DTO, response mapper, shared type
  and verification boundaries; checkpointed the reviewed #4 milestone.
- [x] (2026-10-05) Added the shared discriminated catalog and trusted
  exceptions; arbitrary framework bodies/values are discarded and DTO issues
  are bounded to known fields/rules.
- [x] (2026-10-05) Mappers compile against shared types and explicitly emit
  ISO strings; five HTTP contract/privacy journeys pass.
- [x] (2026-10-05) Link/anchor checks and tooling regression pass; four
  concurrent database fixtures prove success/failure/SIGTERM cleanup and
  preservation of another active run and a pre-existing owned sentinel.
- [x] (2026-10-05) Full verification passed: 77 tests (1 tooling, 4 email,
  20 API unit, 52 e2e), plus concurrent database lifecycle checks. Compiled
  image build/rehearsal passed; docs/changelog updated and review prepared.
- [x] (2026-10-05) Patched the review finding in database-preservation checks;
  four overlapping isolation-check processes all passed, then the full
  verification gate passed again (77 tests). No `test_*` databases remained.

## Surprises & Discoveries

- Existing readiness wire keys include `redis_queue`. Preserve that contract
  rather than silently renaming it under the general camelCase convention.
- Prisma mappers return Dates today; JSON serializes them correctly, but that
  hides drift from the shared ISO-string types. Serialize explicitly at mappers.
- Validation whitelist errors can contain attacker-controlled property names.
  Field identifiers must come from DTO metadata, not arbitrary input keys.

- The first hosted #4 run passed verification/build but failed its migration
  rehearsal: a container UID could not traverse the runner-owned 0700 secrets
  directory. Mounting individual synthetic files fixed it without weakening
  host-directory permissions; a UID-65534 regression probe now exercises this.
  The isolated fix was committed/pushed as `cb00a75`; hosted run 37335644020
  passed. #1 remains a separate local diff for milestone review.
- Cleanup could race database creation or a terminating suite. The shared
  lifecycle now settles setup and stops the child before deciding ownership
  and dropping its own database. SIGKILL/host-loss cleanup remains impossible.
- The shared catalog adds a runtime import from packages/types. Built and
  rehearsed the compiled image to prove Bun resolves those source-package
  exports correctly, beyond passing source-mode HTTP tests.
- Milestone review reproduced a false failure in one of four overlapping
  isolation checks: the cluster-wide snapshot included another run's temporary
  database, which that run legitimately removed. Preservation now checks a
  controlled sentinel created before the four fixtures. The sentinel uses the
  same owned-database lifecycle and is cleaned up on success or failure.

## Decision Log

- Decision: Keep class-validator/Nest DTOs and the envelope; introduce a shared
  local error catalog and explicit application exceptions. Unknown framework
  exceptions receive safe status-based defaults, never forwarded bodies.
  Rationale: Existing application messages and `details` are unrestricted.
  Date/Author: 2026-10-05 / Codex
- Decision: Preserve raw better-auth response semantics for its own handler.
  Rationale: That is a separate auth protocol; the web adapter will normalize
  it in gate #2/#3. Product exception mapping must not consume raw auth bodies.
  Date/Author: 2026-10-05 / Codex

## Outcomes & Retrospective

Gate #1 is complete locally and ready for review. Safe error codes/details,
explicit wire serialization, actual HTTP contract coverage, documentation links
and database lifecycle proof are implemented. Validation details deliberately
changed from `messages` to `issues`; W3 must consume the new typed contract.

#4 and its portability fix are committed/pushed, with hosted verification
passing at `cb00a75`. The #1 diff is not committed pending this milestone's
review. No production deployment or development-data migration was performed.
Gate #2 starts with the three W3 design documents, then the web foundation;
gate #3 owns auth delivery and the already recorded credential/deletion fixes.
Queue namespaces remain mandatory when jobs exist; the current runner only
pings Redis. Expand contract checks as new routes ship.

## Context And Orientation

`packages/types` owns client wire contracts. `app.setup.ts` mounts better-auth
before parsers and Nest validation/filter handling. `AllExceptionsFilter`
now uses trusted application codes and safe framework fallbacks for all
product errors, with a bounded validation exception factory.
Collection/profile/resource mappers and health services supply W3 reads.
`tooling/verify-api-tests.ts` already creates a per-run PostgreSQL database;
no queue work exists, so Redis is ping-only. Hosted CI now runs required
service tests. The onboarding guide pin tracks committed dependencies.

## Plan Of Work

Define stable error codes/details in shared types and a backend-only trusted
exception constructor. Map framework failures by status and build bounded
validation issues from declared DTO fields/rules. Migrate actionable domain
conflicts and validation decisions to explicit codes. Connect key mappers to
shared types, serialize timestamps, and check actual JSON, nullability and
hidden-resource errors over the production HTTP stack. Add local link checking
and test-runner lifecycle proof, then reconcile documentation and acceptance.

## Concrete Steps

Use Bun/Biome, `bun run verify` with local PostgreSQL/Redis, and focused tests
while developing. Test arbitrary error payloads, malformed JSON/UUID/cursors,
unknown fields, nested validation and hidden versus nonexistent collections.
Check profile, explore, hub/handle/permalink, resources, shares, shared/saved
lists, readiness, and audit payloads. Never reset development data.

## Validation And Acceptance

Safe errors expose only catalog text, request IDs and declared detail shapes;
validation reveals bounded field/rule identifiers rather than submitted values.
Conflicts needed by W3 are actionable by code. Actual HTTP data matches shared
types with ISO timestamps/nullability; SQL-only fields never escape mappers.
Local Markdown links resolve. Disposable runner success/failure/interruption
cleanup affects only its own database; concurrent runs use distinct databases.
No queue namespace is needed until jobs exist; that remains an explicit gate.
Full verification must pass before this milestone is presented for review.

## Idempotence And Recovery

No schema migration or live deployment is needed. Re-run verification safely;
temporary test databases belong to the runner. Preserve previous reviewed
commits and the guide's pin discipline; do not fake a future commit pin.

## Artifacts And Notes

Relevant baseline: release foundations `369be40`, guide pin `4a22199`.
Evidence: `/tmp/nslinkhub-contracts-verify.log` (exit 0, 77 passing tests),
`/tmp/nslinkhub-contracts-image.log` (build exit 0), and
`/tmp/nslinkhub-contracts-image-rehearsal.log` (exit 0). No owned fixture
containers or `test_*` databases remained after verification. `git diff --check`
and current Markdown links/anchors passed. These /tmp logs are disposable;
commands and contracts are recorded in the verification/release runbooks.

Review-fix evidence: four `bun tooling/verify-test-isolation.ts` processes
started 50 ms apart all exited 0. `bun run verify` exited 0; disposable output
is in `/tmp/nslinkhub-isolation-fix-verify.log`. The change only affects test
tooling and documentation, so the compiled-image rehearsal was not repeated.

Hosted #4 proof: https://github.com/namestarlit/nslinkhub/actions/runs/37335644020
(success, `cb00a75`). It does not claim the uncommitted #1 diff ran remotely.
The walkthrough was swept; retain its existing pin until the reviewed #1
commit exists, then make the required guide-only pin follow-up.

## Interfaces And Dependencies

Keep `AuthUser`, hidden-resource 404 policy, stable URL shapes, same-origin
design, Bun/Biome, raw-handler ordering and the `_FILE` contract. No Zod or
generated-client migration. Domain codes must not depend on mutable names or
database error messages.
