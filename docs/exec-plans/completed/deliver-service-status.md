# Deliver public service status and recovery

## Purpose / Big Picture

Complete the remaining public reading journey at `/status`: readers can inspect
aggregate readiness, deliberately recheck it and return to browsing. Show ready,
limited, unavailable and unconfirmed states using the existing API authority.
Keep dependency details and remote errors out of the page and browser payload.

## Progress

- [x] (2026-10-06) Read the API, interface contracts and existing browser fixtures.
- [x] (2026-10-06) Implemented uncached status reading, plain-language states,
  native recheck forms, throttling feedback and public navigation.
- [x] (2026-10-06) Passed all 19 production browser cases, including three new
  status cases. Inspected desktop/phone screenshots; keyboard, 320–1280 px,
  enlarged text, reduced motion and no-JavaScript recovery passed.
- [x] (2026-10-06) Reconciled docs/changelog and passed the final full gate:
  118 tests plus API/web builds/typechecks. All 19 production browser cases pass.
- [x] (2026-10-06) Review found no actionable regressions; the user authorized
  committing the milestone. Closed this plan for the milestone commit; the
  required guide-only pin update follows that commit. Remote publication remains
  subject to the explicit authorization recorded in the handoff.

## Surprises & Discoveries

- Unavailable readiness is HTTP 503 with `dependencies_unavailable`, not a success
  `Readiness` body. The HTTP adapter already retains the safe error code while
  dropping dependency details. Generic 503 does not prove a dependency outage.
- Existing page navigation copy says "collection content"; status needs neutral
  loading copy. Existing document freshness and cancellation recovery remain.

- The first full gate failed in unchanged auth-delivery coverage when its helper
  found no pending captured email for a legacy-handover test. A fresh isolated
  run passed, but the final rerun exposed another handover failure. Deterministic
  rendering proved the test helper's first-eight-digits regex captured a numeric
  UUID segment from the target address instead of the proof. The helper now
  captures the standalone code line; the handover test uses a fixed numeric
  address prefix to reproduce the old failure reliably. Production auth is
  unchanged. Initial evidence: `/tmp/w3-status-verify-auth-failure.log`.

- Initial browser acceptance caught two fixture/rendering issues: spying on the
  Prisma instance did not fail its real readiness probe, and a nested `noscript`
  fallback was not visible without JavaScript. The fixture now overrides only
  probe methods with test-only providers; throttled retry renders normal HTML
  fallback that hydration hides. Rechecks still use native document GETs.

## Decision Log

- Decision: Reuse server-only reads and render just the aggregate status; use a
  native GET form for rechecks, enhanced with pending feedback and Retry-After.
  Rationale: Full SSR works without JavaScript; no polling, shared caching,
  dependency display or new backend endpoint is needed.
  Date/Author: 2026-10-06 / Codex
- Decision: Fail individual readiness probes only inside backend-owned browser
  fixtures; do not stop shared development containers to simulate outages.
  Rationale: Exercise real HealthService/controller/error responses safely in the
  isolated test app while keeping unrelated database operations available.
  Date/Author: 2026-10-06 / Codex

## Outcomes & Retrospective

The complete `/status` journey is implemented and verified. Readers can reach
it from public navigation, distinguish aggregate readiness from unconfirmed
checks, recheck deliberately and return to browsing. The page renders without
JavaScript, respects throttling with an explicit fallback, keeps private API
details out of rendering and recovers cancelled rechecks through a fresh load.
Desktop/phone screenshots were inspected; narrow widths, enlarged text, reduced
motion, keyboard, no-JavaScript and history behavior passed browser acceptance.

Final evidence: `bun run verify` passed 118 tests plus builds/typechecks;
`bun run test:browser` passed all 19 cases (three new status cases and the 16
existing reading cases). No dev-entry change required `test:dev`. An existing
intermittent auth-test capture bug encountered during verification was reproduced
with synthetic rendering and fixed only in the test helper/fixture; production
authentication and readiness contracts are unchanged.

Review found no actionable regressions and the user authorized committing this
milestone. The reviewer passed static checks but could not complete its runtime
run because local socket binding was blocked; the successful full verification
and browser runs above remain the runtime evidence. Sign-in/account work,
deployment and remote publication remain separate. Do not infer hosted CI or
live-provider acceptance from these local gates.

## Context And Orientation

`apps/api/src/modules/health/health.controller.ts` returns ready/degraded under
`data` and unavailable as an error. `packages/types/src/status.ts` owns wire
contracts. `apps/web/src/lib/server-api.ts` owns bounded no-store server reads;
`http.ts` discards untrusted remote messages. The Next layout owns public
navigation and FreshDocument handles history/background/cancelled navigation.
Design authority: `docs/design-docs/web-product-experience.md`,
`web-interface-system.md` and `web-design-tokens.md` in that same directory.

## Plan Of Work

Add a static `/status` route ahead of the guarded dynamic handle route. Render
only known aggregate states; distinguish confirmed dependency failure from
unknown/invalid/unreachable status. Add deliberate recheck and explore actions,
including a no-JavaScript path. Add service status to the compact top bar and
make global loading/main labels appropriate for both reading and status.
Extend the real API/browser fixtures for readiness failures and injected HTTP
failures, then update the local documentation and changelog after acceptance.

## Concrete Steps

From repository root run `bun run check`, `bun run verify`, then
`bun run test:browser` sequentially. Use local PostgreSQL/Redis infrastructure
and existing isolated fixture runners. Web builds share `.next`, so do not run
them concurrently. No dev-entry changes are planned; `test:dev` is unnecessary
unless that scope changes.

## Validation And Acceptance

- `/status` and the navigation link work with/without JavaScript, on reload,
  keyboard, 320/390/768/1280 px widths, enlarged text and reduced motion.
- Real ready/degraded and dependency-unavailable responses yield the specified
  copy. Degraded readiness still permits browsing. Generic failure, malformed
  payload and bounded timeout show unconfirmed status, never false readiness.
- Retry/recheck works, honors Retry-After, gives pending feedback and makes one
  fresh request per action. No automatic polling. History restoration rechecks.
- Dependency names/details and remote error text never enter status content.
  Navigation/rechecks never propagate share tokens to the status API. HTTP-only client and source attribution persist.
- Both full source and production browser gates pass, including prior journeys.

## Idempotence And Recovery

No migrations, developer data resets, deployments or real email. Browser
fixtures own disposable databases/queues and restore all readiness fault seams.
Keep verification environment masks intact. Retrying gates creates fresh fixtures.

## Artifacts And Notes

Current evidence: `/tmp/w3-status-verify.log` (118 passing tests),
`/tmp/w3-status-browser.log` (19 passing cases), `/tmp/w3-status-desktop.png`
and `/tmp/w3-status-phone.png` (inspected). The summary above remains durable if
these disposable files disappear. This completed plan accompanies the reviewed
service-status milestone commit. The preceding public-hub milestone is
`5d38bfc`, guide follow-up `ad0f603`. The walkthrough is swept and repinned to
the service-status commit in the required guide-only follow-up.

## Interfaces And Dependencies

Existing Next/React/Bun/Biome, `Readiness`/`SystemStatus` wire types, safe HTTP
error code `dependencies_unavailable`, no-store eight-second server deadlines.
Web code never imports API internals. All backend failure seams live in
`apps/api/test/browser/reading.browser.ts`.
