# Save several links at once, with titles and tags

## Purpose / Big Picture

Saving links should produce a readable collection immediately: every link has a
title, people can save several links in one go to one chosen collection, add
tags per link, and new collections get a name instead of yet another "My links".

Observed (2026-10-07): YouTube links saved as bare URLs. The background title
lookup worked, but YouTube's `<title>` sits ~700 KB into a 1.2 MB page, past the
256 KB cap. Save a link accepted one URL; every new collection was named
"My links", so the destination list filled with identical names; per-link tags
existed in the API but the form never offered them.

## Progress

- [x] (2026-10-07) Diagnosis and decisions (below).
- [x] (2026-10-07) YouTube titles via oEmbed; titles resolved when a collection
  is opened (verified on the dev stack); capture API takes 1–10 links with
  title/tags and a collection name; e2e green.
- [x] (2026-10-07) Web: multi-row Save a link form (URL + optional tags; the
  resolved title shown read-only), paste-to-split, name field for a new
  collection, destinations with relative update time.
- [x] (2026-10-07) Title is never an input anywhere; item edits are tags and
  position only. Tests, docs, changelog; verify and browser (42/42) green.

## Surprises & Discoveries

- The capture draft cookie is capped at ~2.7 KB. Drafts keep every URL and
  drop titles/tags first when they don't fit (titles are looked up again).

## Decision Log

- Collection names: named on create. Choosing "New private collection" shows a
  name field prefilled with a suggestion ("Saved links, Oct 7", suffixed when
  taken). Duplicates stay allowed (Drive model); the destination list adds the
  last update so duplicates are distinguishable. (User, 2026-10-07.)
- Titles appear before saving: pasting a URL shows its resolved title.
  Revised (user, 2026-10-07): the title is never an input — keep inputs to what
  people must type (URL, optional tags). Personal context becomes a separate
  note stored as metadata, in the richer-metadata slice, whose display follows
  the Google Docs link card (icon, title, domain, description).
- Items are read-only in what belongs to them (user, 2026-10-07): no title
  input on any add endpoint; edits change only tags and position (headings
  can't be renamed). A wrong link is removed and re-added. Next slice adds
  reference notes (editable) and an item details view (metadata + notes,
  remove action).
- Lookup is a read-only GET with its own small request budget ("lookup",
  30/min); it never runs under the write lock.
- Tag suggestions from page metadata are deferred (tech-debt tracker).
- Opening a collection resolves links still missing a title (≤5 per page read,
  each URL at most once an hour per process); the open list re-reads its
  first page once after 2.5 s to show titles that arrived. (User, 2026-10-07.)
- Next slice (not this one): richer link metadata so near-identical titles are
  distinguishable — author/channel (oEmbed `author_name`), description, site
  name, thumbnail. Author shown inline in row meta (works on touch/keyboard);
  description/thumbnail in a hover/focus preview. Needs a migration.
  (User request, 2026-10-07.)

## Outcomes & Retrospective

Delivered as decided, with two user-driven revisions: titles are resolved,
never typed (no title field on any add endpoint), and items are read-only in
what belongs to them. Follow-ups: richer link metadata + reference notes +
item details view; adding sections and inserting links into a section.

## Context And Orientation

`apps/api/src/modules/collections/capture.service.ts` (idempotent capture with
receipts), `apps/api/src/modules/resources/page-title.ts` (SSRF-guarded fetch),
`apps/web/src/components/capture-form.tsx`, `apps/web/src/lib/capture-*.ts`,
`apps/web/src/app/forms/[action]/route.ts` (capture-save).

## Plan Of Work

API first (contract in `packages/types/src/capture.ts`), then web, then tests.

## Concrete Steps

`bun run verify`; `bun run test:browser` in the isolated checkout.

## Validation And Acceptance

A pasted YouTube link shows its video title before saving and after. Three
links pasted at once save to the chosen collection in order with their tags.
"New private collection" asks for a name; a repeated default never repeats.

## Idempotence And Recovery

No migration. Capture replays with the same operation return the same result.

## Artifacts And Notes

None yet.

## Interfaces And Dependencies

`POST /api/v1/capture` body becomes `{ operationId, startedAt, destination,
links: [{ url, title?, tags? }], collectionTitle? }` → `{ collectionId,
resourceIds }` (pre-deployment: no compatibility alias). `GET
/api/v1/link-preview?url=` → `{ url, title }`.
