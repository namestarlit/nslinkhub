# Deliver activity and attribution

This ExecPlan is a living document. Maintain it according to `PLANS.md`.
Keep `Progress`, `Surprises & Discoveries`, `Decision Log`, and
`Outcomes & Retrospective` current as work proceeds.

## Purpose / Big Picture

Every change to a collection's content is recorded as "who did what to which
item", and attribution is derived from those records, GitHub-style
(ADR-0015, `docs/design-docs/attribution-and-activity.md`). Afterwards a
collection shows its **contributors** ("Paul John and 2 contributors") next to
its owner and creator; every item knows who added it; contributors can open the
collection's **History**; and the hub's audit trail includes content changes,
ready for Manage › Activity (next slice).

Observe it: an owner shares a collection with an editor; the editor adds a
link and a section; the collection page lists both people as contributors, the
History page reads "@editor added a link … · just now", and the item's API
view carries `addedBy`.

## Progress

- [x] (2026-10-08) Plan written.
- [x] (2026-10-08) M1 Schema: audit entries gain an item id and the content actions (CHECK
  list, history index); items gain `added_by_user_id`.
- [x] (2026-10-08) M2 Recording: collection created and details changed; links, references
  and sections added; items removed, edited, reordered; imports; comments
  hidden, shown, answers marked — each in the change's transaction.
- [x] (2026-10-08) M3 Reads: collections expose contributors; items expose `addedBy`;
  `GET /collections/:id/activity` for contributors; the hub audit includes the
  item id.
- [x] (2026-10-08) M4 Web: contributors in the collection header; a History page for
  contributors.
- [x] (2026-10-08) M5 Tests, docs, gates.

## Surprises & Discoveries

- Observation: the contributors line first compared against the separately
  loaded hub, so a failed hub lookup showed the owner as a "contributor"; it
  now compares against the collection's own hub id.
  Evidence: browser test "fails safely for invalid routes and hub lookup failures".
- Observation: publishing an already-published collection used to write a
  duplicate `collection.published`; entries are now written only for real
  changes (including a no-op details save, which writes nothing).
- Observation (review): History first showed editors the sharing, link and
  transfer entries — who has access, which listing shares keeps owner-only.
  Editors now see content and moderation entries only; an e2e assertion checks
  an editor's history never names a reader.
- Observation (review): when the owner acted last, the header read "Hana Owner
  · Hana Owner and 1 contributor". It now reads "Hana Owner and 1 contributor",
  counting everyone besides the owner, as in "Paul John and 2 contributors".
- Observation (user review): the header became two lines — the owner, then
  "Contributor · just now" or "N contributors · just now". The phone Share panel
  overflowed the screen (anchored to the Share button); it now anchors to the
  button group, and the bar's back link stays on one line. A narrow-screen rule
  meant to drop the "·" separators never did (a more specific rule won); fixed.
- Observation: existing collections had no creation entries; the migration
  backfills them from `creator_user_id` and `created_at`. Item adders before
  this slice are unknown and stay null.
- Observation: editors still don't see Add a link or Edit in the web (those
  are owner-only today); they do see History. Item management for editors
  arrives with "Organizing and sharing in the web".

## Decision Log

- Decision: extend `audit_records` rather than add a second table.
  Rationale: one source of truth for the hub audit and attribution (ADR-0015);
  entries already carry hub, actor, collection and target person. Date/Author: 2026-10-08 / Claude
- Decision: entries keep ids only; the item id has no foreign key, so history
  survives an item's removal. Names come from the person's hub at read time,
  honouring "show my name on my hub". Date/Author: 2026-10-08 / Claude
- Decision: contributors are the distinct people with content entries on the
  collection (creation, details, items), most recent first; the API returns
  up to five and a total. Date/Author: 2026-10-08 / Claude
- Decision: `addedBy` is stored on the item (`added_by_user_id`, set null if
  the account is deleted) for cheap reads; the entry stays the record.
  Items saved before this slice have no adder. Date/Author: 2026-10-08 / Claude
- Decision: History is visible to the collection's contributors (owner and
  editors), like GitHub's insights for collaborators; readers see only the
  contributors line. Date/Author: 2026-10-08 / Claude

## Outcomes & Retrospective

Delivered and reviewed (2026-10-08). `bun run verify` green; browser
suite 43/43 including the new History scenario; header (desktop, phone) and
History (light, dark) screenshots reviewed. Imports no longer parse a
title at all.

## Context And Orientation

`apps/api/src/common/audit.ts` (`recordAudit`, called inside the mutation's
transaction); `packages/types/src/audit.ts` (`auditActions`); collection
mutations in `collections/collections.service.ts` (`mutateOwned`,
`createInHub`); items in `resources/resources.service.ts` and
`collections/capture.service.ts`; imports in `imports/imports.service.ts`;
comments in `comments/comments.service.ts`. The web header is
`apps/web/src/components/primitives.tsx` (`CollectionMeta`).

## Plan Of Work

As in Progress. Person references reuse the existing `PersonRef` shape (hub
id, handle, name only when shown on the hub; suspended accounts omitted).

## Concrete Steps

In `apps/api`: `bunx prisma migrate dev --create-only --name activity_attribution`,
review (CHECK list, index, FK), apply; then `bun run verify` and
`bun run test:browser` from the root.

## Validation And Acceptance

- E2E: each content change writes one entry with the right actor, collection
  and item; a rolled-back change writes none; contributors list the owner and an
  editor after both change content; `addedBy` names the editor for their link;
  History is 404 for readers and strangers and lists entries newest first with
  cursor paging; removed items keep their history.
- Browser: the header shows contributors; History lists the editor's change.

## Idempotence And Recovery

Entries are append-only and written in the same transaction as their change;
nothing to replay.

## Artifacts And Notes

None yet.

## Interfaces And Dependencies

`@nslinkhub/types`: `auditActions` gains the content actions; `AuditEntry`
gains `resourceId`; `Collection` gains `contributors`; `Resource` gains
`addedBy`; new `ActivityEntry`.
