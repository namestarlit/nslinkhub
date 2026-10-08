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
| People | Hub owner | Who has access (direct shares per collection, link openers), followers, and blocked accounts; revoke a share, block or unblock |
| Import | Hub owner | Bulk import drafts ([bulk-import.md](bulk-import.md)) |
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

An owner can block an account from their hub. A blocked account cannot comment
on, follow, be shared into, or open link-shared collections of that hub;
existing shares and follows end. Blocking is private (the blocked person is not
told) and reversible. Published collections stay public pages.

## Routes

`/manage` (the first section the viewer has), `/manage/collections`,
`/manage/comments`, `/manage/people`, `/manage/import`, `/manage/activity`,
`/manage/accounts`, `/manage/public`, `/manage/team`, `/manage/audit`. The
`/ops` routes are removed (pre-deployment, no redirects). The API keeps
separate namespaces per scope: hub-owner endpoints under the hub, service
endpoints under `/api/v1/operations`.

## Open questions

- Whether a blocked account signed in is also denied published collections of
  that hub, or only participation.
