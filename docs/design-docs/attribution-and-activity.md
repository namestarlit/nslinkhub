# Attribution and activity

Status: designed, not built. Decision:
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

Modelled on GitHub's commits and contributors:

- **Collection metadata:** the **creator** (who created it, kept through
  transfers, distinct from the owner) and **contributors** ("Paul John and 2
  contributors"), derived from the entries of people who changed its content.
- **Item details:** "Added by @handle · Oct 7".
- **History** (owner and editors): the collection's entries, newest first —
  "@handle added a link · 2 hours ago".

Names follow each person's "show my name on my hub" setting; otherwise the
handle shows. Readers see attribution only for collections they can read.

## What owners see

The hub's audit in **Manage › Activity**: every entry for the hub, filterable by
collection, person and action ([manage-workspace.md](manage-workspace.md)).

## Data

Items gain `addedByUserId` set from the entry that created them (a direct column
for cheap reads; the entry stays the record). Contributors are a grouped query
over a collection's content entries.
