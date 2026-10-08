# Final pre-deployment pass on internals

## Purpose / Big Picture

Before production exists, rebuild the parts the 2026-10-07 code review flagged as
patched at the wrong depth or doing redundant work. Nothing here changes what
users see or do: same pages, same copy, same flows, same timing as perceived by a
reader. What changes is how titles are stored and fetched, how many queries a
page costs, how the write lock is opted out of, how form actions are routed, and
where Save a link drafts live. (User, 2026-10-07: big changes are welcome now;
the only blocker is a change to behaviour, business workflow or UX.)

## Progress

- [x] M1 Link titles: own storage, durable lookup jobs, shared fetch cache —
  delivered by [deliver-link-metadata](../completed/deliver-link-metadata.md) with a simpler
  shape than sketched below: one shared `link_metadata` row per address is the
  storage, the outbox job and the cache (no Redis cache), and the wire field is
  renamed to `title`.
  (2026-10-08: delivered first, as the link-metadata foundation — title,
  description and site name, text only — ahead of bulk import; see
  `PRODUCT.md` §11.)
- [ ] M2 Fewer queries: batched reference access, batched comment replies,
  comment writes reuse loaded rows.
- [ ] M3 One write-lock opt-out per controller.
- [ ] M4 Forms route as an action table with one status-to-notice mapping.
- [ ] M5 Save a link drafts in Redis (cookie holds only the draft id).
- [ ] M6 Smaller consolidations (DNS once, canonical duplicate check, shared
  helpers, API-suggested collection name).
- [ ] M7 Focus rings return when focus moves without a pointer press.
- [ ] Docs, changelog, gates (`bun run verify`, `bun run test:browser`).

## Surprises & Discoveries

None yet.

## Decision Log

- Held back (they change what users see): shrinking the 100-reply preview; the
  `fresh-document` scroll-reset workaround (needs a real-browser check first).
- Pre-deployment: schema changes go into new reviewed migrations on top of the
  squashed `0_init`; the dev database is reset and reseeded (`bun run db:seed`)
  if a change is easier that way. No compatibility code.
- Settled 2026-10-08 (ADR-0013): roles stay `reader`/`editor`; the discussion
  badges the owner and editors alike as "Maintainer" (Curator is the
  professional account type; ADR-0016).

## Outcomes & Retrospective

(To fill at completion.)

## Context And Orientation

- Titles: `apps/api/src/modules/resources/{resources.service,page-metadata,
  link-preview.controller}.ts`; capture in `modules/collections/capture.service.ts`;
  the web list re-read in `apps/web/src/components/paginated-list.tsx`.
- Jobs: the email outbox (`apps/api/src/email/outbox.ts`) and its BullMQ worker
  are the pattern for durable background work.
- Queries: `resources.service.ts#resourceView`, `comments.service.ts`
  (`list`, `replyPage`, `single`), `hubs/collection-policy.service.ts`.
- Lock: `apps/api/src/common/authority.interceptor.ts`, `imports.controller.ts`,
  `exports.controller.ts`, `operations.service.ts`.
- Forms: `apps/web/src/app/forms/[action]/route.ts`, `lib/form-server.ts`.
- Drafts: `apps/web/src/lib/capture-{draft,server}.ts`.
- Focus: `apps/web/src/components/focus-mode.tsx`.

## Plan Of Work

**M1 — Link titles** (superseded; see Progress). Add `resources.page_title` (nullable) and
`resources.title_status` (`pending | found | none`, CHECK constraint) plus
`title_checked_at`; headings keep their text in `title_override`, links stop
writing it. The wire `titleOverride` becomes the displayed title computed by the
API (heading text, or page title), so clients don't change. Lookups are a
`link_title_lookups` outbox row written in the save transaction and processed by
the worker (bounded concurrency, SSRF-guarded fetch unchanged), with a retry
schedule (e.g. 1 h, 1 day) for failures; no version bump on fill. A short-lived
Redis cache keyed by canonical URL holds preview results (title or "none") so
the worker reuses what the preview just fetched. `getByCollection` no longer
schedules work; it returns `meta.titlesPending` when any listed link is pending,
and the web list re-reads once only then. Remove the per-process attempts map
and `authorityContext.exit` scheduling.

**M2 — Queries.** Add `CollectionPolicyService.resolveMany(collections, viewer)`
(one active-viewer check, one owner lookup, one share lookup) and use it for
`collection_link` items in resource lists and exports. Comments: load accepted
answers for the page's questions in one query and the first reply page for all
questions in one windowed query (`ROW_NUMBER() OVER (PARTITION BY parent_id)`),
same reply count (100) and ordering. Mutations build their response from the
rows and access already loaded; `create` reuses the hold check it already did.

**M3 — Write lock.** Replace the method list exceptions, the two metadata keys,
the `ParsedUploadAuthorityInterceptor` subclass and the
`/operations|/invitations` path regex with one `@Authority(mode)` decorator
(`lock` default, `read-only`, `after-parse`, `owns-transaction`) set on the
controllers that need it; one shared `recheckSession(actor)` used by the
interceptor and `OperationsService`.

**M4 — Forms.** `route.ts` becomes a `Record<action, handler>`; each handler is
a small function (capture, comments, profile, theme, sign-in flow, invitations,
operations). One `noticeFor(result, overrides)` maps API results to notice codes
consistently; one `withQuery(path, params)` helper replaces the repeated
`?`/`&` building.

**M5 — Drafts.** Store the draft JSON in Redis under its id (30-minute TTL, at
most three per visitor as today); the cookie keeps only the id. Remove
`fitDraft`, `sealDraft` size limits and the "too-many-links" fallback for
oversized drafts (the 2-link cap stays as validation).

**M6 — Smaller consolidations.** `fetchPageTitle` reports a missing host
(ENOTFOUND/ENODATA) so the preview needs no second DNS lookup; the form compares
rows by the canonical URL the preview returns; shared helpers for invitation
state (`notifications.controller` + `administration.service`), time-id comment
cursors (`cursor.util.ts`) and the referenced-collection visibility rule
(resources + exports); the API returns the suggested new-collection name (same
text the form shows today).

**M7 — Focus rings.** Keep the keyboard-only look. In `FocusMode`, leave pointer
mode on any `focusin` that wasn't preceded by a pointer press in the same task,
so focus moved by assistive technology or script shows its ring.

## Concrete Steps

Per milestone: implement, `bun run check`, typecheck both apps, focused unit/e2e
tests, then the full gates in the isolated checkout. Migrations with
`bunx prisma migrate dev --create-only` + review; reset and reseed dev.

## Validation And Acceptance

- Saving a link shows its title as today; the page is fetched once for preview +
  save; a site that is down gets a title on a later retry without anyone opening
  the collection; opening a collection performs no writes.
- A resource page with 20 references runs a constant number of access queries;
  a comment page runs a constant number of reply queries.
- Only `@Authority(...)` decides lock behaviour; a new POST without it is locked.
- Every form action maps the same API status to the same notice.
- Two 2048-character links with 30 long tags survive a sign-in round trip intact.
- After a click, rings stay hidden; focus moved by script or a screen reader
  shows its ring; Tab still restores rings.
- All existing browser and e2e journeys pass unchanged in what they assert about
  the UI.

## Idempotence And Recovery

Each milestone is independently shippable and reversible before deployment. The
dev database can be reset (`docs/runbooks/local-development.md`) and reseeded.

## Artifacts And Notes

Source review: four parallel review agents (reuse, simplification, efficiency,
altitude), 2026-10-07; the items they raised are summarized in
`docs/exec-plans/tech-debt-tracker.md` and resolved here.

## Interfaces And Dependencies

- Wire: `Resource.titleOverride` keeps its meaning (displayed title); resource
  lists gain `meta.titlesPending`. `LinkPreview` unchanged.
- New: `@Authority(mode)` decorator, `CollectionPolicyService.resolveMany`,
  `link_title_lookups` table, Redis keys `link-title:<sha256>` and
  `capture-draft:<id>`.
- Redis and the worker are already part of the local and production topology.
