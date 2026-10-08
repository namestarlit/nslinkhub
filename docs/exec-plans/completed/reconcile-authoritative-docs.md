# Reconcile authoritative documentation

## Purpose / Big Picture

Contributors can distinguish implemented behavior from accepted product direction
without reconstructing session history. Current designs and runbooks describe
their subject directly; completed plans and ADR context retain relevant history.

## Progress

- [x] (2026-10-08) Read the latest handoff, repository authorities, current
  designs and active plans; identified contradictory status and stale guidance.
- [x] (2026-10-08) Reconciled designs, navigation, policies, runbooks and
  onboarding against code and accepted decisions; preserved the existing
  foundation-document move and repaired its relative links.
- [x] (2026-10-08) Reviewed the diff and historical language, updated the
  changelog, passed `bun run verify` in an isolated copy, and passed final
  documentation/guide-pin and whitespace checks in the working repository.

## Surprises & Discoveries

- Attribution was marked built while describing management-only audit rows.
- The service-operations banner contradicted the amended Manage decision.
- The onboarding guide and PRODUCT transfer section taught the rejected
  hub-membership model; both now follow the accepted individual model.
- The full gate passed using copied dependencies in an isolated `/tmp` checkout.
  An initial hardlink copy could not cross filesystems; ordinary copying
  resolved the verification setup without changing application code.
- The working tree already moves foundation adoption notes into completed
  plans and updates the release runbook. Those changes belong to this cleanup.

## Decision Log

- Decision: Preserve ADR rationale and completed execution evidence; consolidate
  living docs around implemented contracts and explicitly labelled planned work.
  Rationale: Historical evidence explains decisions but must not masquerade as
  current instructions. Date/Author: 2026-10-08 / Codex.
- Decision: Reconcile existing amendments without introducing product decisions.
  Rationale: This task authorizes documentation cleanup, not implementation of
  people/hubs, role renames, routes or billing. Date/Author: 2026-10-08 / Codex.

## Outcomes & Retrospective

Living docs distinguish implemented contracts from accepted direction. The web
experience is organized by journeys, SSO reflects individual-account scope,
monetization states the accepted boundary and open choices, and runbooks describe
working procedures. Onboarding no longer teaches rejected memberships or nesting.
Root product/architecture guidance and existing ADR amendments are consistent.
Completed records retain rationale and evidence, with a clear historical banner
on the moved foundation comparison. No runtime files changed.

The cleanup is ready for review, uncommitted. The existing guide pin passes for
committed history; follow the guide-only pin update after the reviewed milestone
commit exists. No new product decision, deployment or data migration occurred.

## Context And Orientation

`PRODUCT.md` owns direction and delivery status; `ARCHITECTURE.md` describes
the implementation. `docs/design-docs/` mixes implemented contracts and planned
features. ADR-0018 defines optional hubs and separate person usernames; the code
still creates hubs at signup, uses reader/editor grants and serves `/ops`.
`docs/exec-plans/completed/` and `CHANGELOG.md` retain milestone history.

## Plan Of Work

Audit current docs against product decisions, shared contracts and relevant
code. Remove obsolete milestone instructions, consolidate repetitive prose,
and state implemented/planned boundaries. Fix navigation after the existing
foundation-note move. Refresh active plans and onboarding without changing
runtime code or settled scope.

## Concrete Steps

From the repository root, inspect documentation and contracts using `rg`;
edit Markdown; run `bun run check:docs`, `bun run verify`, and
`git diff --check`. Use an isolated checkout for builds if an active development
server shares this checkout's output.

## Validation And Acceptance

- Current docs no longer teach rejected memberships, shipped title overrides,
  merged owner/operator consoles, or completed work as pending.
- Planned usernames, optional hubs, subscriptions, role/route changes and
  import drafts are not presented as implemented.
- Local links and anchors resolve; verification results are recorded honestly.
- No runtime behavior, secrets, development data or historical evidence changes.

## Idempotence And Recovery

Edits are Markdown-only and reviewable with `git diff`. Preserve unrelated work;
no reset, migration, deployment or data deletion is required. The guide pin
must follow the repository's reviewed-commit workflow when this milestone is
committed; do not invent a commit hash or weaken the check.

## Artifacts And Notes

Latest disposable context: `ref/next-session-collaborators-and-routes.md`.
Durable decisions are already in PRODUCT and ADRs, independent of that handoff.

Verification on 2026-10-08:

- `bun run verify`: exit 0 in `/tmp/nslinkhub-docs-verify-oJR5L3`; client and
  telemetry boundaries, documentation links and guide pin, shared typechecks,
  Biome, tooling/email tests, API generation/build/typecheck/unit/e2e, web
  boundary/tests/production build/typecheck all passed.
- Final `bun run check:docs`, `bun run check:guide-pin`, `git diff --check`:
  passed in the working repository after documentation review.
- Runtime tests used disposable databases and capture email. No browser rerun
  was needed for Markdown-only changes; no browser acceptance is newly claimed.
- Full transient log: `/tmp/nslinkhub-docs-verify.log`. The result above is the
  durable evidence and does not depend on retaining that file.

## Interfaces And Dependencies

No code or dependency changes. Relevant evidence is in `packages/types/src/`,
`apps/api/src/modules/`, `apps/web/src/`, and repository verification scripts.
