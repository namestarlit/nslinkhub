# Deliver explore-to-resource reading end to end

## Purpose / Big Picture

Readers can browse explore, open a durable collection URL, follow ordered
resources and sections, and understand empty/unavailable/failure states. By the
user’s explicit vertical-slice direction, this first MLP journey must be complete
before moving to hub/pretty-URL browsing, status, account forms or editing. Local PostgreSQL/Redis are containers; applications
run on the host. Release images remain deployment work.

## Progress

- [x] (2026-10-06) Resolved cancelled document navigation with an explicit
  reload action and fresh authorization. Ten production browser cases pass,
  including native navigation abort, keyboard recovery and access revoked while
  pending. Full gate passes 117 tests plus builds/typechecks. Recovery screen
  visually checked. Final review found no actionable regressions; the user
  approved committing the milestone.

- [x] (2026-10-06) Resolved isolation review with explicit env-file override
  masks in API/browser/dev verification children. Conflicting API-local env
  regressions pass through nested processes and real config resolvers. Full
  gate passes 117 tests plus builds/typechecks; nine browser cases and dev-loop
  smoke pass.

- [x] (2026-10-06) Resolved review findings: trusted per-client SSR budgets,
  section metadata, and API-local development port precedence. Full gate passes
  115 tests plus builds/typechecks; nine production browser cases and the
  repeatable `bun run test:dev` smoke pass.

- [x] (2026-10-06) Reviewed the committed experience/interface/token contracts
  and Impeccable product register. Landed the reviewed workflow separation
  (`81a92e0`, guide follow-up `7a2e61a`).
- [x] (2026-10-06) Added Next.js, runtime configuration, typed HTTP boundaries and dev loop.
- [x] (2026-10-06) Implemented explore pagination and the collection/section reader with full states.
- [x] (2026-10-06) Eight production browser cases pass: real API/database,
  no-JavaScript collection/resource continuation, invalid-cursor recovery,
  access/cache/origin boundaries, responsive keyboard journeys, computed color
  contrast and production bundle canaries.
- [x] (2026-10-06) Updated docs/changelog; the initial full gate passed 112 tests,
  builds and typechecks before review corrections.

## Surprises & Discoveries

- Headless Chromium key dispatch does not invoke the browser-chrome Stop
  command. The cancellation regression sends Escape and `Page.stopLoading`,
  verifies the request actually aborted, then exercises the visible keyboard
  reload action. It covers both still-authorized and newly revoked content.

- Bun's HTTP test client ignores `localAddress`. The two-source production
  regression therefore uses a Node socket fixture to connect from distinct
  loopback addresses; applications and test runners remain on Bun. It proves
  one exhausted source cannot throttle the second and spoofed headers cannot
  change an untrusted socket's source.

- The local dev smoke passed API/worker/Next startup, same-origin rewriting and
  bounded process-group shutdown using an isolated database and capture email.
  Next 16.3 auto-generated app-level agent files; disabled `agentRules` after
  reading its installed config contract so repository-owned instructions remain
  stable. Version-matched framework docs remain available under Next's package.

- Initial streamed Suspense output left server data hidden without JavaScript.
  Blocking initial document rendering restored the required URL pagination
  fallback; enhanced navigation still displays loading feedback. Browser test
  evidence covers both script-enabled and no-script contexts.
- Shared wire modules use NodeNext `.js` specifiers. The web uses Pigfarm's
  Webpack build pattern plus TS extension aliases, rather than changing the
  shared/backend module convention or bundling backend code.
- The test ingress must request identity encoding when relaying fetch responses;
  retaining compressed headers after decompression broke browser navigation.

- The skill's repository-relative setup script is absent; ran the installed
  `/home/ns/.codex/skills/impeccable/scripts/context.mjs` instead. The committed
  token document already defines brand colors, so no new palette is generated.
- API readers support session cookies and share tokens; signed-in token reads
  may record access. A web proxy also exposes existing writes, so cookie-origin
  enforcement must be proven even though this milestone has no editing forms.

## Decision Log

- Decision: Keep a "Reload this page" action in document loading feedback.
  Native cancellation does not reliably produce a cross-browser application
  event, so recovery is explicit and always reachable. Reload the current URL
  instead of revealing the hidden DOM: authorization may have changed while
  navigation was pending. Browser coverage delays a real destination, presses
  Escape and checks keyboard reload with and without revocation.
  Date/Author: 2026-10-06 / Codex, cancelled-navigation review correction

- Decision: Share explicit verification environment masks across the API,
  browser and dev-loop runners. Empty inherited overrides survive Bun/dotenv
  loading; deleting a variable allows API-local files to restore it. Keep a
  valid synthetic release SHA because that config field rejects empty strings.
  Prove the behavior in disposable conflicting env-file fixtures through Node
  and Bun child chains and real Prisma/worker/web configuration resolvers.
  Date/Author: 2026-10-06 / Codex, isolation review correction

- Decision: Resolve review P1 with a web HTTP entry point that derives client
  source from the actual socket and explicitly trusted proxy hops. Overwrite
  incoming source proofs, sign short-lived attribution with independent
  `WEB_SOURCE_SECRET`, and verify only at the API read-budget boundary. Keep
  authentication and backend authorization unchanged. Plain `next start`
  cannot establish that socket boundary and is no longer a supported entry.
  Rationale: SSR must preserve per-source limits without accepting arbitrary
  forwarding headers or giving anonymous visitors a shared server-IP bucket.
  Date/Author: 2026-10-06 / Codex, review correction

- Decision: Ask Bun for the effective API port in the API working directory
  before listener checks, then pin it into child environments and the internal
  API origin. Preserve Bun's env-file and inherited-variable precedence. Render
  stored section resource overrides/tags while keeping the authorized child
  title as fallback.
  Date/Author: 2026-10-06 / Codex, review corrections P2

- Decision: Adopt inspected Pigfarm scaffold patterns: runtime-specific config
  exports, server-only read modules, bounded no-store requests, centralized
  browser adapter, source/config boundaries and one host dev orchestrator.
  Evidence: `packages/config/src/web{,-browser}.ts`, `apps/web/src/lib/api-client.ts`,
  `apps/web/src/lib/workspace-capabilities.ts`, `tooling/dev.ts`, and
  `docs/designs/{frontend-foundation,web-rendering-and-caching}.md` in reference
  commit `f0bab0a`. Preserve NSLinkHub's same-origin API, eight/ten-second
  deadlines and initially uncached pages. Do not copy CORS/public API env,
  organization UI, locale routing or cacheComponents without a local need.
  Date/Author: 2026-10-06 / User direction, mapped by Codex

- Decision: User explicitly requires one end-to-end vertical MLP slice at a time.
  First: explore → collection → section/external resource. Hub/pretty-URL and
  status entry points follow separately; do not advertise them before they work.
  Rationale: Scaffold only the foundation this journey needs and finish its
  real API, error, security and browser acceptance before another journey.
  Date/Author: 2026-10-06 / Codex
- Decision: Use normal document navigation and explicitly uncached reads.
  Hide old content on background/history transitions and reload before restoring
  it. Avoid router prefetch/cache and persistent browser credential/data storage.
  Rationale: Revocation and cross-user isolation take priority over speculative
  navigation optimization. Preserve progressive pagination without JavaScript.
  Date/Author: 2026-10-06 / Codex

## Outcomes & Retrospective

The explore-to-resource journey and review corrections for source budgets,
section metadata, development ports, verification isolation and cancelled
navigation are implemented.
The final full gate passes 117 tests, builds and typechecks; ten production
browser cases and the isolated development-loop smoke also pass. Documentation is reconciled and the milestone
has passed review and is approved for commit. Hub/pretty-URL browsing, status, accounts and editing remain
separate journeys. No image or deployment acceptance is claimed.

## Context And Orientation

`apps/api` owns authorization and data. `packages/types` owns wire types.
`packages/config` now also supplies separate browser/server web settings.
`apps/web` is a separate HTTP-only application, including Server Components.
The three `docs/design-docs/web-*` files are authoritative visual/interaction
contracts. `docs/design-docs/adoption-decisions.md` owns acceptance gates.

## Plan Of Work

Add the web package, server/browser config exports and mechanical import checks.
Use a trusted server origin with bounded no-store reads, narrow cookie forwarding
and redirect refusal. The browser reads only same-origin `/api/v1`. Implement
semantic shell, list pagination and authorized contextual collection reads.
Run development apps together with bounded shutdown. Add isolated browser
fixtures using the real API and PostgreSQL; assert failures and revocations as
well as successful reading. Keep secrets out of client bundles and metadata.

## Concrete Steps

From the root: `bun install`, `bun run infra:up`, `bun run dev` for local work.
Run `bun run verify` and `bun run test:browser` for acceptance. Application
builds compile Next.js; no Docker image build belongs to this milestone.

## Validation And Acceptance

- Explore/permalink/sections work; continuation retains focus/results
  and has a no-JavaScript fallback. Invalid/hidden/missing collections match.
- Unpublish, link rotation, expiry and user changes cannot restore stale private
  content through navigation/history. Share tokens never escape related reads.
- Server timeouts include response bodies; upstream redirects are refused;
  unknown errors do not render remote messages; retry budgets are respected.
- Production client bundle contains no synthetic secret/server-origin canaries.
- Real browser checks cover 320/390/768/1280 widths, keyboard, long text, 200%
  zoom, reduced motion, empty/loading/error states and clipboard fallback.
- Cookie-authenticated unsafe requests reject absent/null/untrusted origins,
  including multipart/bodyless calls and bearer-plus-cookie requests.
- Full repository gate stays green with real-service tests; release gate remains manual.

## Idempotence And Recovery

Tests create and drop only random owned databases and queue namespaces; they
force capture email and disable external telemetry. No dev data reset or live
email. Browser fixtures and child processes are cleaned up on success/failure
and termination. New package files and app code are reversible; no schema change.

## Artifacts And Notes

- `/tmp/w3-cancel-browser.log`: ten passing browser cases, including actual
  client-source budget isolation, spoof resistance, saved section metadata,
  cookie issuance and revoked/expired access, with isolated real API/data.
  Cancelled navigation recovers through fresh authorization, including revocation.
- `/tmp/w3-cancel-verify.log`: final full gate, 117 tests passed after all
  review corrections, including conflicting API-local env files; application
  builds/typechecks passed.
- `/tmp/w3-isolation-dev.log`: capture-only dev-loop startup, proxy and shutdown
  passed on isolated data and temporary ports using `bun run test:dev`.
- `/tmp/w3-reader-desktop.png` and `/tmp/w3-reader-phone.png`: synthetic
  long-title reading stress fixtures, visually inspected. No image build ran.
- `/tmp/w3-navigation-recovery.png`: visually checked recovery surface after
  navigation cancellation; old reader content remains hidden.

Framework references: [Next.js installation](https://nextjs.org/docs/app/getting-started/installation),
[uncached fetch](https://nextjs.org/docs/app/api-reference/functions/fetch),
[logging](https://nextjs.org/docs/app/api-reference/config/next-config-js/logging),
[Tailwind setup](https://tailwindcss.com/docs/installation/framework-guides/nextjs).
Dependency versions are checked against the registry and pinned in `bun.lock`.

## Interfaces And Dependencies

Next.js App Router, React, Tailwind, Bun/Biome, existing wire/error contracts,
server-only markers and Playwright for browser acceptance. No API internals or
Prisma enter the web app. Auth remains library-owned behind the API boundary.
