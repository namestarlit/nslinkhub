# Attribution and activity

Status: API and web contributors/History are implemented. Item `addedBy` is
available in the API; its details presentation awaits preview cards. Manage's
hub-wide activity view, notes and blocking are planned. Decision:
[ADR-0015](../engineering-decisions/0015-attribution-from-activity-records.md).

## Activity entries

`audit_records` is the append-only source for attribution and hub audit. Each
entry records the hub, actor, action, target IDs and database time in the same
transaction as the change. It contains no names, emails, tokens or authored text.

Implemented actions cover collection creation/details/publication/deletion,
link-sharing and direct shares, transfers, item additions/updates/removal/reorder/
import, discussion moderation and answer selection, hub name/handle changes,
and audit reads. `auditActions` in `packages/types/src/audit.ts` defines the
contract; its `contentActions` subset defines who counts as a contributor.
Notes, blocking and reviewed-import commits add events when those workflows ship.

## Attribution and history

- Collections return their immutable creator and contributors: up to five
  people, most recent first, plus the total. Attribution grants no access.
- Resources return `addedBy`; `addedByUserId` is a read-efficient projection
  of the creating action. Unknown authorship stays null rather than fabricated.
- The collection header keeps owner, contributor count and relative update time
  on one line, with creator credit when ownership has changed. The exact
  timestamp is available on hover.
- `/c/<id>/history` is available to owners and editors. Its API,
  `GET /api/v1/collections/:id/activity`, is cursor-paginated, returns 404 for
  unreadable collections and 403 for readers. Editors see content and moderation
  only; the owner can also see sharing, link and transfer events.
- History returns the item's current readable representation or null after
  removal; it is not a snapshot of deleted text. Optional `resource_id` has no
  cascading foreign key, so deleting an item cannot erase its history.

The implemented `PersonRef` uses `{ hubId, handle }`; people appear as linked
`@handle` values, without names or email. The accepted
[people-and-hubs design](people-and-hubs.md) changes person attribution to
usernames and person profiles; that contract is not implemented yet.

## Hub audit

`GET /api/v1/me/audit` resolves the signed-in owner's hub and records its own
reads. Transfers leave historical entries in their original hub and write a
receiving event to the destination. Hub audit has no automatic expiry; deletion
and retention requirements are tracked in [SECURITY.md](../SECURITY.md).

The planned [Manage › Activity](manage-workspace.md) surface presents this
same history across the hub, filterable by collection, person and action.
