# Attribution and activity

Status: built (API and web: contributors line, History page; item "added by" is
in the API, shown with preview cards). Decision:
[ADR-0015](../engineering-decisions/0015-attribution-from-activity-records.md).
Today `audit_records` holds management actions only (publish, share, link,
transfer, renames); this extends it to content so it can drive attribution.

## Activity entries

One append-only entry per change: hub, actor, action, target (collection,
item, comment or account), time — ids only, written in the change's
transaction. Actions cover:

- collections: created, details changed, published/unpublished, link sharing
  changes, transferred, deleted;
- items: link, reference or section added; removed; tags changed; note edited;
  reordered;
- people: share granted/revoked, account blocked/unblocked;
- discussion: comment hidden/shown, answer marked;
- hub: name or handle changed; import committed.

## What readers see

Modelled on GitHub's commits and contributors, labelled **contributors** here:

- **Collection metadata:** the **creator** (who created it, kept through
  transfers, distinct from the owner) and its **contributors** ("Paul John and 2
  contributors"), derived from the entries of people who changed its content.
- **Item details:** "Added by @handle · Oct 7".
- **History** (owner and editors): the collection's entries, newest first —
  "@handle added a link · 2 hours ago".

People appear by their @handle; a name shows only on the person's own hub page
(if they choose). Readers see attribution only for collections they can read.

## What owners see

The hub's audit in **Manage › Activity**: every entry for the hub, filterable by
collection, person and action ([manage-workspace.md](manage-workspace.md)).

## Data

Items gain `addedByUserId` set from the entry that created them (a direct column
for cheap reads; the entry stays the record). Contributors are a grouped query
over a collection's content entries.

## As built

- Entries are `audit_records` rows with an optional `resource_id` (no foreign
  key); actions are listed in `@nslinkhub/types` `auditActions`, and the
  content actions (`contentActions`) define contributors.
- `GET /api/v1/collections/:id` returns `contributors` (up to five, most recent
  first, and a total) and `capabilities.canEdit`; items return `addedBy`.
- `GET /api/v1/collections/:id/activity` (cursor-paginated) is the history:
  not found for those who can't read the collection, forbidden for readers.
  Entries carry the actor, the target person and the item as it is now. Editors
  see content and moderation entries only; sharing, link and transfer entries
  name who has access, which only the owner may see.
- The collection header shows the owner on one line, then "Contributor · just
  now" beneath (or "3 contributors" when others have shaped it too, counting the
  owner) and a History page at `/c/<id>/history`.
- Existing collections got a backfilled creation entry; who added older items
  is unknown and stays empty.
