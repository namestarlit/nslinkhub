# Deliver public hub browsing through collection reading

## Purpose / Big Picture

The next W3 vertical slice lets a reader open `/@handle`, browse that hub's
published collections, open `/@handle/<slug>`, and continue through the existing
section/resource reader. Copying a link still produces the immutable `/c/<id>`
permalink. Complete and review this journey before starting another surface.
Implementation, acceptance and review are complete. The user authorized committing
the milestone; remote publication remains a separate pending action.

## Progress

- [x] (2026-10-06) Confirmed existing API/wire contracts and recorded the next
  slice after reviewed reading milestone `d556236` and guide pin `9277461`.
- [x] (2026-10-06) Implemented public hub and pretty collection entry points,
  shared reader, public hub attribution and progressive HubPage pagination.
- [x] (2026-10-06) Proved privacy, rename durability, access changes and
  keyboard/mobile/no-JavaScript behavior against the real API and isolated DB.
- [x] (2026-10-06) Passed `bun run verify` (118 tests plus builds/typechecks)
  and `bun run test:browser` (16 production cases); inspected hub desktop/phone
  screenshots. Reconciled docs/changelog and prepared the complete review diff.
- [x] (2026-10-06) Review found no actionable bugs; user authorized committing
  the milestone. Closed this plan and reconciled status references. The required
  guide-only pin update follows the milestone commit. Remote publication remains
  pending explicit push authorization.

## Surprises & Discoveries

- `GET /api/v1/hubs/by-handle/:handle` returns `data: HubPage` containing
  `hub` and `collections`, with pagination in envelope `meta`. Existing
  `PaginatedList` assumes an array in `data`; adapt that boundary deliberately.
- `GET /api/v1/hubs/:hubId` is public-only even for an owner. The separate
  `/:hubId/collections` list can expose the owner's private collections to
  that owner; it is not the public hub page's data source.
- The API already resolves handles and hub+slug. No persistence access,
  schema migration or new identity model is required by this journey.

- Browser continuation previously reset all collection lists to explore. It now
  resets the current route and deduplicates both existing and same-page rows.

- Production browser testing found that Next 16.3 supplies the literal `@`
  prefix as `%40` in dynamic params. Decode route segments exactly once before
  URL-shape validation; separators, double encoding and unrelated routes remain
  rejected. The first browser run caught this before acceptance; a source
  regression now covers the encoded parameter contract.

## Decision Log

- Decision: Public hub → pretty collection URL → resource is the next complete
  slice, following the existing W3 reading contract. Keep status, account,
  editing, sharing management and deployment outside this milestone.
  Rationale: Complete the remaining public reading entry points using the
  verified HTTP-only foundation, rather than opening several partial journeys.
  Date/Author: 2026-10-06 / Codex, next-session planning requested by user
- Decision: Keep backend authorization and published-list filtering decisive;
  pretty routes only resolve API-owned identities. Do not create rename aliases
  or redirects for obsolete handles/slugs in this slice.
  Rationale: The system design allows pretty URLs to break; durable references
  use immutable IDs and already survive renames.
  Date/Author: 2026-10-06 / Codex

- Decision: Use guarded `[handle]` routes, accepting only literal `@` prefixes;
  unrelated paths return the standard not-found page. Resolve hub context once
  for pretty URLs; ID readers fetch optional public hub context independently.
  Rationale: Preserve future static routes and keep context lookup failure from
  hiding an otherwise authorized ID read. Tokens never enter hub discovery.
  Date/Author: 2026-10-06 / Codex

## Outcomes & Retrospective

Public hubs and pretty collection URLs now complete the planned public reading
journey. Both entry points reuse the collection reader; hub rows open pretty
URLs, section links and copied references use immutable IDs. Public-only lists,
empty/hidden states, optional hub-context failure, scoped share tokens, cursor
recovery, session expiry and rename durability have real browser proof.

`bun run verify` passed 118 tests plus builds/typechecks. `bun run test:browser`
passed all 16 cases against disposable fixtures. Screenshots at 1280 and 390 px
were inspected; browser assertions cover 320/390/768/1280 px, enlarged text and
reduced motion. Existing navigation-cancellation, source-attribution, secret
bundle and isolation regressions remain green. No dev-entry changes required
`test:dev`; no Docker image, deployment or live-provider acceptance is claimed.

The first browser run exposed encoded Next route params; the added decoding
regression and subsequent successful full gates close that issue. Review found
no actionable bugs and passed static checks/web typechecking. Its separate
runtime attempt could not bind a local HTTP server in the sandbox; that limit
does not replace the successful full verification and production browser runs
recorded above. The user authorized committing this reviewed milestone.
Status/account/mutation journeys and remote publication remain separate work.

## Context And Orientation

Read `AGENTS.md`, `docs/SYSTEM_DESIGN.md`, `docs/design-docs/adoption-decisions.md`
and the three `web-*` design documents. Use Impeccable under those contracts
when implementing the UI. Pigfarm reference adoption is already mapped in
`web-interface-system.md`; consult its pinned sources for a concrete gap,
not as a replacement product specification.

`apps/web/src/components/collection-reader.tsx` owns the shared reader used by
ID and pretty entry points. Its HTTP calls, authorized context, copy controls
and pagination are reusable. All web code,
including Server Components, accesses data only via API adapters. Shared
types come from `packages/types/src/hubs.ts` and `collections.ts`.
The existing backend routes live in
`apps/api/src/modules/collections/hubs.controller.ts`; their implementation
and published filtering live in `collections.service.ts` beside it.

## Plan Of Work

Add App Router entry points that match the literal `@` handle prefix without
claiming unrelated top-level routes. Resolve the handle with the public hub
endpoint, retain its immutable hub ID, and resolve pretty collection URLs with
`GET /api/v1/hubs/:hubId/collections/:slug`. Reuse a shared reader for pretty
and ID routes so authorization failures, resource order, section metadata,
token handling and copy behavior cannot drift. Keep the pretty address while
reading; copy controls and section links retain durable IDs.

Build the public hub heading from `handle` and optional `description`, with
only the published collections supplied by its public API. Adapt continuation
to the HubPage envelope and retain the existing keyboard, deduplication,
Retry-After and no-JavaScript behavior. Introduce links to these routes only
where real API data provides the destination; no extra profile/avatar fetches,
fabricated owners or account controls. Keep the existing signed source-budget,
cookie, no-store and navigation-recovery boundaries.

Extend backend-owned browser fixtures under `apps/api/test/browser/` with
multiple hubs, empty hubs, private collections, rename and failure scenarios.
Update current status documents only after acceptance passes.

## Concrete Steps

From the repository root:

1. Inspect `git status` and this plan; preserve the handoff's documentation
   changes if they are still uncommitted. Reconcile pending publication before
   claiming that local commits are on the remote.
2. Use `bun run dev` for local work (PostgreSQL/Redis containers, host apps).
   This starts the email worker; existing local Resend settings can send mail.
3. After implementation, run `bun run verify` and `bun run test:browser`
   sequentially. Both web builds and the dev server use `.next`; do not run
   them concurrently in one checkout. Run `bun run test:dev` only if the
   development entry point/orchestrator changes.
4. Present the complete milestone for review, then commit. Sweep the onboarding
   guide and repin it in a guide-only follow-up once the reviewed commit exists.

## Validation And Acceptance

- Direct `/@handle` and `/@handle/<slug>` navigation works, including reload,
  narrow screens, long text and keyboard-only use. Pretty and ID entry points
  display the same authorized collection/resource content.
- Hub pages remain public-only for anonymous, owner and other-user sessions;
  empty hubs never leak private titles, counts or profile fields.
- Multiple cursor pages work with and without JavaScript. Enhanced continuation
  preserves rows/focus, suppresses duplicates, announces results and recovers
  from invalid cursors, timeouts and 429s without silently losing context.
- Unknown/malformed handles and unknown/hidden collections have safe unavailable
  states. Failed context lookup never grants access or reveals private data.
- Rename a handle and slug through backend fixture APIs: the new pretty path
  works and the copied `/c/<id>` link still works. Old pretty paths may fail;
  do not promise redirects. Section URLs remain flat `/c/<id>` references.
- Unpublish, revoked access, session changes, history restoration and cancelled
  navigation preserve the current fresh-authorization/reload behavior.
- Share tokens go only to related authorized collection reads, never public hub
  discovery or external links. Ordinary copying never includes the token.
- Full repository and production browser gates pass, including existing source
  attribution, env-file isolation and cancelled-navigation regressions.

## Idempotence And Recovery

No developer data reset, migrations, deployment or live mail is required for
acceptance. Reuse disposable database/queue fixtures and
`tooling/verification-env.ts`; never delete its inherited masks or redirect
tests to the development database. Keep backend fixtures outside web code.
Revert only this slice's edits if needed; preserve prior reviewed behavior.

## Artifacts And Notes

Current acceptance: 118 source/unit/integration tests and 16 production browser
cases. Six additional browser cases cover hub privacy, the complete browse
journey, continuation failure recovery, renames, lookup failures and shared
pretty reading; existing cases now also exercise pretty navigation cancellation
and session expiry. The new source case covers percent-encoded route prefixes.
Disposable evidence: `/tmp/w3-hub-verify.log`, `/tmp/w3-hub-browser.log`,
`/tmp/w3-hub-desktop.png`, `/tmp/w3-hub-phone.png`. Evidence summaries above remain
authoritative after these files disappear. `ref/` records local review/push state.

## Interfaces And Dependencies

Existing Next.js/React/Bun scaffold; same-origin `/api/v1`; server-only trusted
API origin and signed source attribution; `HubPage`, `Collection`, `Resource`
and cursor/error envelopes from `@nslinkhub/types`. Clients never import Prisma,
Nest services, generated models or any other `apps/api` internals.
