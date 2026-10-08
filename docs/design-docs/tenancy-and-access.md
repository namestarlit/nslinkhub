# Tenancy and access

Status: implemented. The Google-Drive individual model: one hub per user,
independent collections, per-collection access through one policy service.
Settled in [ADR-0001](../engineering-decisions/0001-drive-tenancy-model.md);
product behavior in [PRODUCT.md](../../PRODUCT.md).

## Access model

A single policy service (`CollectionPolicyService`) is the one source of truth.
For a collection it resolves the strongest independent grant:

1. **Owner** — owns the collection's hub: read, write content and manage.
2. **Direct share** — reader or editor on that collection.
3. **Active link** — its valid token or recorded link share while enabled.
4. **Published** — the collection itself is published: read.

Otherwise the collection is **not found** (404, so callers cannot probe for
things they can't access). Reads that fail resolve to 404; writes a viewer may
not perform resolve to 403.

- **Manage** (publish, share, delete, settings, rename) is **owner-only**.
- **Editor** scope is content-only: resources, tags, imports within the shared
  collection. Editors never manage.
- A link grant is recorded against the opened collection only.
- Collection-reference metadata and exports authorize the destination separately.
  A source share token is never forwarded to another collection.

## Roles and labels

Roles come in two separate scopes ([ADR-0013](../engineering-decisions/0013-permission-roles-and-display-labels.md)):

| Role | Scope | Comes from | Can |
| --- | --- | --- | --- |
| `owner` | Every collection in the hub | Owning the hub (`hub.ownerUserId`); moves with a collection transfer | Read, write content, manage; manage the hub in [Manage](manage-workspace.md), including blocking accounts |
| `editor` | One collection | A direct share (`CollectionShare`) | Read, write content |
| `reader` | One collection | A direct share, or a recorded link share | Read |
| `operator`, `admin` | The service, site-wide | An accepted, verified invitation (`OperatorGrant`, `AdminGrant`) | Run service operations; never read private collections ([service-operations.md](service-operations.md)) |

The collection's **creator** (`creatorUserId`) is a record, not a role: set once,
kept through transfers, shown only as attribution, never consulted for access.

Role names are stable identifiers in the API and database; each surface picks
its own label: the discussion badges replies from the owner or an editor as
**Curator**, sharing reads **Can view** / **Can edit**, operations reads
"service operator" / "service admin". Changing a label never renames a role.

## Service operations

The [service-operator contract](service-operations.md) adds explicit
product authority for account lookup, suspension/reactivation, all-session
revocation, public-content distribution holds and operator audit. Grants use
immutable user IDs, separate from collection roles. Startup invites an initial
admin; emailed-token consent creates only new recipients' named accounts/hubs.
Every recipient then verifies a fresh invitation-bound email OTP, including
matching signed-in sessions. Only successful verification creates the role and
session, atomically with proof consumption and audit. Admins invite/revoke
operators, whose verified acceptance is also required. Emergency zero-admin
recovery issues a fresh invitation instead of granting access. No private-content inspection, impersonation or credential override.

Account/collection restrictions are evaluated before the access grants
above, and on list/export/auth paths. A suspended owner cannot authenticate and
their hub's content is unavailable to others. A held collection remains
available to its active owner for correction, but unavailable to non-owners;
publication, sharing and transfer cannot bypass the hold. References confer no access.
Recovery preserves owner settings without restoring revoked sessions/grants.
Actions and audit are atomic. The linked contract owns concurrency, authority
lifecycle, privacy and retention details. The web console (`/ops`) finds
accounts by email or handle, resolves a public collection from its link, manages
the operator team and filters the audit; search text never appears in URLs.

## Discover filters (planned)

Search by text and tags, and filters by tag. **Popular tags** are the most-used
tags on published collections over the last 90 days; private collections never
contribute. No date-range filter until there is a concrete use for one.

## Ownership transfer

- **Collection transfer** (`POST /collections/:id/transfer`): an owner transfers
  one collection to an existing editor. The collection moves to their hub;
  its resource references keep pointing to unchanged destinations. Recipient
  shares on this collection are removed, the previous owner receives editor
  access, and the immutable creator is untouched. Self-transfer and destination
  slug collisions are rejected.
- **Account/hub transfer** is not a model — see [identity-and-handles.md](identity-and-handles.md) (email
  change).

## Publication and discovery

- **Publish** puts a collection on the product-wide **explore** surface
  (`GET /discover`, public, cursor-paginated, recency-ordered initially). Anyone
  can view; account holders **save** into their **saved/** surface. Saving
  requires publication; a save goes dormant on unpublish and revives on
  republish.
- **Publication is independent.** Only explicitly published collections appear
  in public lists. A published source does not expose any referenced collection.
  Its unreadable references remain neutral unavailable entries.
- **Discovery is tags + text — not handles.** In explore, the true north is
  searching by **tags and text**; the handle is *not* a global search facet.
  If you already know the hub you want, you go to it directly (`/@handle`) and
  search *within* that hub's publications. When you open a published
  collection, you can see **which hub published it** and follow that to explore
  more of their collections. So the handle serves direct navigation and
  attribution/click-through, while explore serves open discovery by tag/text.
- **shared/ vs saved/** — never mixed. shared/ is access *granted to you*
  (`CollectionShare`); saved/ is what *you chose to keep* from the public
  surface (`CollectionSave`). A share grants access; a save grants nothing.
