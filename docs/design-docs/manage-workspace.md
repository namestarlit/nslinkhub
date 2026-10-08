# Manage

Status: designed, not built. Decision:
[ADR-0014](../engineering-decisions/0014-one-management-workspace.md) (owner workspace; separate service console).

**Manage** (`/manage`) is the hub owner's workspace for everything in their
hub. A hub has one owner (ADR-0001); people collaborating on a collection
(contributors, viewers) work from that collection, not from Manage. Running the
service is separate: the platform console planned at `/platform` (implemented at `/ops`)
for admins and operators ([service-operations.md](service-operations.md)).

## Sections

| Section | What |
| --- | --- |
| Collections | Every collection in the hub as a table: visibility (private, link, published), comments on/off, last change; row actions to open, edit details, publish or delete |
| Comments | Comments across the hub's collections, newest first, filterable by collection and state; hide, show, mark answers |
| Access | Like Google Drive's "Manage access", across the hub: **Requests** first ("reader asked to view *Backend building blocks*" — Can view, Can contribute, Decline, Decline and block), then every collaborator by collection (viewer, contributor; change role, remove) and the link-shared collections. Each collection's **Manage access** opens this view filtered to it |
| People | **Subscribers** (remove, block) and **Blocked** (unblock) |
| Import & export | Import: bulk import drafts ([bulk-import.md](bulk-import.md)). Export: several collections at once (one document each, zipped), optionally including referenced collections |
| Activity | The hub's audit trail: who did what to which collection or item ([attribution-and-activity.md](attribution-and-activity.md)) |

Every section uses the pattern of the implemented operations tables: minimal tables,
one filter row, row actions, and "Confirm it's you" for sensitive actions.

## Blocking someone from a hub

The owner blocks someone where that person appears — a comment's menu
(**Block username**), a subscriber row, an access request (**Decline and block**),
a collaborator row — like Instagram or TikTok; Manage › People lists blocked
accounts to unblock. The block applies to the whole hub. Blocking keeps the
account from taking part: it cannot comment on, subscribe, collaborate on, or open
link-shared collections of that hub, and existing collaborations and subscriptions
end. Published collections stay readable to everyone, the blocked account
included — publishing is for the public, not only the people you like.
Blocking is private (the blocked person is not told) and reversible.

## Routes

`/manage`, then `/manage/{collections,comments,access,people,import-export,activity}`.
Hub endpoints live under the hub in the API; the platform console moves from
`/ops` to `/platform` (web) with its endpoints unchanged in behaviour.
