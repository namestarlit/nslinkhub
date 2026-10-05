# Reconcile remaining adoption decisions before W3

## Purpose / Big Picture

Compare the current Pigfarm checkout with NSLinkHub and record a bounded,
repository-owned adoption sequence before web design begins. A contributor
must be able to distinguish implemented foundations, decisions to adopt,
implementation gates, and patterns that do not fit individual-hub tenancy.
This milestone changes documentation only; it does not start W3 or copy code.

## Progress

- [x] (2026-10-05) Read repository guidance, delivery status, existing handoff,
  verification rules, and both workspaces' script inventories.
- [x] (2026-10-05) Inspected focused designs and implementation evidence in both
  repositories, pinned Pigfarm at `f0bab0ab8a9d5ec4b09c8804ab95c7ee6a9a0e9c`.
- [x] (2026-10-05) Recorded the comparison and reconciled focused contracts,
  security, delivery sequence, debt tracker, changelog, and walkthrough.
- [x] (2026-10-05) Reviewed the documentation, checked local links/reference
  paths, and ran the full verification gate successfully with local service
  access. Prepared the completed documentation milestone for user review.

## Surprises & Discoveries

- Pigfarm has replaced its earlier Pino/OTel direction with LogTape and Sentry;
  NSLinkHub recorded the earlier direction at baseline. Pigfarm's active observability
  plan separates delivered application work from unfinished operator rollout.
- The onboarding freshness check compares committed trees only. Changes to
  linked documents require a guide sweep now and a guide-only pin update after
  the reviewed documentation milestone is committed.
- Pigfarm's accepted Zod ADR is not implemented in the inspected API manifest
  or source. Its verification CI exists, but application image/stack artifacts
  do not. The comparison labels these separately from delivered patterns.
- NSLinkHub's security document still described hub memberships and last-owner
  rules; corrected it to the implemented collection-policy model. Multipart
  imports already exist, so browser CSRF verification must cover current routes.
- The current Bun test filters also discover compiled `dist` test copies.
  Gate 1 now explicitly requires suite discovery that excludes those copies;
  this review changes no scripts or reported test counts.

## Decision Log

- Decision: Record local decisions from a pinned comparison; do not make the
  sibling repository an ongoing dependency or copy its product model.
  Rationale: NSLinkHub documents are authoritative and its individual-hub
  authorization model differs from Pigfarm organizations.
  Date/Author: 2026-10-05 / Codex
- Decision: Keep class-validator, existing envelopes, product auth choices,
  individual hubs, and synchronous exports. Adopt tested boundaries and failure
  cases selectively, with a small foundation gate before web implementation.
  Rationale: The reference product and execution model differ; copying its
  policies or unimplemented proposals would expand scope without evidence.
  Date/Author: 2026-10-05 / Codex
- Decision: Use LogTape and Sentry for the planned application telemetry, with
  shared Alloy for stdout and dependency monitoring.
  Rationale: A single application tracing owner fits the monolith and avoids
  the earlier unproven dual-destination tracing design. Compatibility and
  operational rollout remain explicit future acceptance gates.
  Date/Author: 2026-10-05 / Codex

## Outcomes & Retrospective

Completed the pinned comparison across 21 areas, with decisions and acceptance
gates for foundation work, W3, auth delivery, and public release. Updated the
authoritative observability, security, reliability, delivery, infrastructure,
and wire-contract guidance; refreshed the system sequence, debt tracker,
changelog, and walkthrough. Marked the disposable old handoff as superseded.
Runtime behavior and dependencies remain unchanged; Pigfarm was read-only.

The next implementation milestone is the foundation gate (isolated verification,
safe typed errors, and wire-contract checks); W3 design can follow review of
these decisions. No implementation adoption has been marked delivered.

User review, commit/push, and the post-commit guide pin update remain outside
this documentation task. The guide content was swept now; its existing
`14e12ae` pin is intentionally unchanged because there is no reviewed new commit
to pin yet. After committing the milestone, make the required guide-only pin
follow-up and run verification before pushing. A green pre-commit guide check
does not certify the uncommitted dependency edits.

## Context And Orientation

NSLinkHub at `25df1ab` has a working backend, shared wire types, three email
templates, readiness probes, and workflow checks. `apps/web` does not exist.
The read-only reference is `../../hashikome/pigfarm`, initially at `f0bab0a`.
`docs/SYSTEM_DESIGN.md`, `docs/design-docs/`, and the technical-debt tracker own
the durable decisions. The old `ref/w3-web-app-handoff.md` is disposable.

## Plan Of Work

Inspect auth, async email delivery, observability, configuration, frontend
boundaries, verification, and deployment evidence. Write a comparison record
with pinned source paths, local gaps, adoption decisions, triggers, and
acceptance evidence. Reconcile affected satellite documents and W3 sequencing,
update the debt tracker and changelog, and sweep the onboarding guide.

## Concrete Steps

From the repository root, inspect source and documentation with `rg` and
`git show`; inspect the sibling repository without changing it. After edits:

```bash
git diff --check
bun run infra:up
bun run verify
```

Expect the repository gate to pass. Record environmental failures separately
from failures caused by this documentation change; never reset user data to
obtain a green result.

## Validation And Acceptance

- Each comparison finding has concrete local and reference evidence.
- Every proposed adoption has an explicit delivery trigger and acceptance
  condition; reference-only or incomplete work is labeled accurately.
- W3 entry requirements and public-release requirements are distinct.
- Existing product, auth ownership, UUID, and client-boundary invariants hold.
- No implementation, dependency upgrade, commit, or push occurs in this pass.

## Idempotence And Recovery

Reads and documentation edits are repeatable. There are no migrations or
destructive operations. Review the diff before reverting any individual edit.
The comparison and verification are complete; this plan is archived under
`docs/exec-plans/completed/`. Future implementation uses separate ExecPlans and
the gates in the durable comparison, rather than reopening this research task.

## Artifacts And Notes

`docs/design-docs/adoption-decisions.md` contains the pinned source inventory,
comparison, decisions, and gate acceptance. Verification output is captured in
`/tmp/nslinkhub-adoption-verify-unrestricted.log`.

Validation on 2026-10-05:

- `git diff --check`: passed.
- Local Markdown links (34) and pinned reference paths (49): all exist.
- `bun run infra:up`: started the repository PostgreSQL and Redis services;
  no database reset or migration was needed.
- First sandboxed `bun run verify`: passed static/build stages but failed test
  HTTP binds (port 0 permission restriction). No code change was made for this.
- `bun run verify` with approved local service/socket access: exit 0. Boundary
  and guide checks, typechecks, format/lint, build, and all test stages passed:
  4 email tests, 18 tests in the source-filter stage, 56 in the test-filter stage
  (the latter counts include the compiled-test discovery noted above).

## Interfaces And Dependencies

Preserve `resolveSessionUser` / `AuthUser`, app-owned onboarding,
`CollectionPolicyService`, UUIDv7 identities, better-auth before body parsers,
`@nslinkhub/types`, Bun/Biome, and the deployment `_FILE` contract. The review
adds no runtime dependency on Pigfarm.
