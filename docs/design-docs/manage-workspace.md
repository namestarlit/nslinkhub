# Manage

Status: designed, not built. Decision:
[ADR-0014](../engineering-decisions/0014-one-management-workspace.md). Today's
service-operations console (`/ops`) becomes the service scope of this workspace.

**Manage** is the one place to manage what you are responsible for. It opens
from the account menu at `/manage`; its sections follow the viewer's roles
([roles and labels](tenancy-and-access.md#roles-and-labels)).

## Sections by role

| Section | Who | What |
| --- | --- | --- |
| Collections | Hub owner | Every collection in the hub as a table: visibility (private, link, published), comments on/off, last change; row actions to open, edit details, publish or delete |
| Comments | Hub owner | Comments across the hub's collections, newest first, filterable by collection and state; hide, show, mark answers |
| Access | Hub owner | Like Google Drive's "Manage access", across the hub: **Requests** first ("@reader asked to view *Backend building blocks*" — Can view, Can edit, Decline, Decline and block), then every direct share by collection (change role, remove) and the link-shared collections. Each collection's **Manage access** (from Collections or the collection page) opens this view filtered to it |
| People | Hub owner | **Followers** (remove, block) and **Blocked** (unblock) — the one place to review and undo blocks |
| Import & export | Hub owner | Import: bulk import drafts ([bulk-import.md](bulk-import.md)). Export: download several collections at once (one document each, zipped), optionally including referenced collections |
| Activity | Hub owner | The hub's audit trail: who did what to which collection or item ([attribution-and-activity.md](attribution-and-activity.md)) |
| Accounts | Operator, admin | Find accounts by email or handle; suspend, reactivate, sign out everywhere ([service-operations.md](service-operations.md)) |
| Public collections | Operator, admin | Find a public collection by link; hold or release; moderate comments on public collections |
| Team | Admin | Invite, resend and revoke operators |
| Service audit | Operator, admin | Operator actions, filterable |

A person with several roles sees the sections of each, grouped as **Your hub**
and **Service**. Every section uses the same pattern as today's operations
tables: minimal tables, one filter row, row actions, a required reason for
service actions, and "Confirm it's you" for sensitive ones.

## Blocking someone from a hub

An owner blocks someone where that person appears — a comment's menu
(**Block @handle**), a follower row, an access request (**Decline and block**),
a share row — like Instagram or TikTok; Manage › People lists blocked accounts
to unblock. The block applies to the whole hub. Blocking keeps the account from
taking part: it cannot comment on, follow, be shared into, or open
link-shared collections of that hub, and existing shares and follows end.
Published collections stay readable to everyone, the blocked account
included — publishing is for the public, not only the people you like.
Blocking is private (the blocked person is not told) and reversible.

## Routes

`/manage` (the first section the viewer has), `/manage/collections`,
`/manage/comments`, `/manage/access`, `/manage/people`, `/manage/import-export`, `/manage/activity`,
`/manage/accounts`, `/manage/public`, `/manage/team`, `/manage/audit`. The
`/ops` routes are removed (pre-deployment, no redirects). The API keeps
separate namespaces per scope: hub-owner endpoints under the hub, service
endpoints under `/api/v1/operations`.
