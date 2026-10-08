# Deliver the link-metadata foundation

This ExecPlan is a living document. Maintain it according to `PLANS.md`.
Keep `Progress`, `Surprises & Discoveries`, `Decision Log`, and
`Outcomes & Retrospective` current as work proceeds.

## Purpose / Big Picture

Every saved link gets its page's title, description and site name, looked up
durably in the background and stored once per address, shared by every
collection that holds it. Today titles are fetched in-process after a save,
written into the item itself with a version bump (spurious 409s for API
clients), forgotten on restart, and fetched twice (preview, then save).
Afterwards: saving writes a pending lookup in the same transaction; the worker
resolves it within seconds and retries failures with backoff; reads join the
stored metadata; previews reuse it. This is the foundation for bulk import
(PRODUCT.md §6.2) and preview cards (§6.4), and the first step of the
internals pass (`final-pass-internals.md` M1).

Observe it: save a link with the worker running; within a few seconds the
collection shows the page title, and `link_metadata` holds one ready row with
title, description and site name. Stop the worker, save another link, restart
it: the title still arrives.

## Progress

- [x] (2026-10-08) Plan written.
- [x] (2026-10-08) M1 Schema: `link_metadata` table (one row per canonical address), reviewed
  migration moving existing link titles into it.
- [x] (2026-10-08) M2 Extraction: title, description and site name from HTML meta tags and
  oEmbed, same SSRF guards.
- [x] (2026-10-08) M3 Requests: saving, capture and import write pending rows in their
  transaction; reads enqueue missing or stale rows; no in-process fetching.
- [x] (2026-10-08) M4 Worker: relay and lease-claimed lookups with backoff in the existing
  worker process.
- [x] (2026-10-08) M5 Reads and contract: resources expose `title`, `description`,
  `siteName` (renamed from `titleOverride`); the link preview reuses the cache;
  web and exports read the new fields.
- [x] (2026-10-08) M6 Tests, docs, gates.

## Surprises & Discoveries

- Observation: imports had no address-length cap, unlike Save a link (2,048).
  With the shared metadata index an over-long imported address would fail in
  the database; imports now report `url_too_long` per row. The import test that
  used an over-long *title* as its database-invalid row now uses an over-long
  address (a validation error), since source titles are ignored.
  Evidence: `test/imports.e2e.spec.ts`.
- Observation: references used to fall back to a stored copy of their title;
  they now always show the readable target's title, so stale copies from the
  removed nesting feature can never surface. Evidence:
  `test/collection-structure.e2e.spec.ts`.
- Observation: the internals plan's M1 sketch (columns on items, a separate
  lookup table, a Redis preview cache) was replaced by one shared table that is
  storage, job and cache at once.

- Observation (security review): the first migration draft copied existing
  link titles into the shared table and the seed stored curated fallback
  titles there. Old titles could have been typed by a person or taken from an
  import file, and the shared row is shown to everyone who saves that address.
  Fixed: the migration registers addresses only (pending), the seed stores only
  what it read from the page, and only page text ever enters `link_metadata`.
  The dev database was corrected in place (checksum updated, rows re-fetched).

## Decision Log

- Decision: one row per canonical address, shared across collections and
  people, not per item. Rationale: the page is the same for everyone; it is the
  shared fetch cache and avoids duplicate lookups. Date/Author: 2026-10-08 / Claude
- Decision: the pending row is the durable job (outbox), written in the save's
  transaction, relayed to BullMQ by the worker, claimed with a lease — the
  email outbox's proven shape. Rationale: no lookup is lost on restart, nothing
  runs under the write lock, and Redis loss only delays. Date/Author: 2026-10-08 / Claude
- Decision: only text read from the page enters `link_metadata`; nothing a
  person typed or an import file carried. Rationale: the row is shared by every
  saver of that address. Date/Author: 2026-10-08 / Claude (security review)
- Decision: text only — title (≤255), description (≤500), site name (≤120); no
  images or icons. Rationale: PRODUCT.md §6.4 privacy rule. Date/Author: 2026-10-08 / Paul
- Decision: link items no longer store a title; the wire field `titleOverride`
  becomes `title` (heading text, a link's resolved title, or null). Rationale:
  an item's title is no longer an override, and pre-deployment renames are
  outright (ADR-0006). Date/Author: 2026-10-08 / Claude
- Decision: retries at 1 minute, 10 minutes, 1 hour and 6 hours, then failed;
  a failed address is tried again when it is saved again or when a collection
  holding it is read more than a day after the failure; ready metadata is
  refreshed when read after 30 days. Rationale: a site that was down must not
  leave a link untitled forever. Date/Author: 2026-10-08 / Claude
- Decision: the web re-reads untitled links at 2.5 s and 6 s after load.
  Rationale: the real relay → queue → lookup path measured 1.2 s, but a slow site
  takes up to its 3 s deadline. Date/Author: 2026-10-08 / Claude

## Outcomes & Retrospective

Delivered and reviewed (2026-10-08). `bun run verify` green and browser
suite 42/42. Live check against MDN, YouTube (oEmbed) and GitHub: all three
ready with title and site name, descriptions where the page provides one.
Existing seeded titles moved into `link_metadata` by the migration. The real
worker path (relay, BullMQ job, lease, fetch) was run against the dev database
and Redis: a pending row became ready in 1.2 s. Unreferenced-row cleanup is
recorded in the tech-debt tracker.

## Context And Orientation

`apps/api/src/modules/resources/page-title.ts` holds the SSRF-guarded fetcher
and title extraction. `resources.service.ts` fills titles in-process
(`fillTitleLater`) and writes them into `resources.title_override`.
`link-preview.controller.ts` fetches synchronously for Save a link. The worker
(`apps/api/src/email/worker.ts`, `delivery.ts`) relays the email outbox to
BullMQ every second and claims rows with a lease. Web display reads
`resource.titleOverride ?? url` in `components/primitives.tsx` and
`paginated-list.tsx`.

## Plan Of Work

As in Progress. The worker gains a second queue (`link-metadata`) beside
`email`, sharing its Redis connection settings and process lifecycle.

## Concrete Steps

In `apps/api`: `bunx prisma migrate dev --create-only --name link_metadata`,
review the SQL (trigger, CHECK on state, data move), apply; then from the root
`bun run verify` and `bun run test:browser`.

## Validation And Acceptance

- Unit: extraction of title/description/site name; oEmbed mapping; the
  processor marks ready, retries with backoff, gives up after the last retry,
  and never claims a leased row.
- E2E: saving, capture and import create pending rows in the same transaction;
  reads return stored metadata; a link with no metadata reads `title: null`;
  item versions never change because of a lookup; headings keep their text.
- Browser: collections show stored titles; Save a link's preview still shows
  the title.

## Idempotence And Recovery

Pending rows are inserted with ON CONFLICT DO NOTHING; a crashed lookup's lease
expires and the relay re-queues it; a repeated job finds no claimable row.

## Artifacts And Notes

None yet.

## Interfaces And Dependencies

`@nslinkhub/types` `Resource` gains `title`, `description`, `siteName` and
loses `titleOverride`; heading creation takes `title`. The worker depends on
Redis as before; the API never calls Redis for this.
