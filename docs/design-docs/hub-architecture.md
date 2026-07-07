# Hub Architecture

Authoritative design for NSLinkHub's tenancy, identity, sharing, and discovery.
This document states the system **as it is decided and built now** (the
Google-Drive individual model), not its history. Where it and `PRODUCT.md`
agree, both are canonical; `PRODUCT.md` holds the product-facing framing and
acceptance criteria, this holds the architectural model and rules.

Related documents:

- `PRODUCT.md` — product definition, capabilities, acceptance criteria.
- `docs/design-docs/identity-sso.md` — ns-series identity (nsauth, "Continue
  with namestarlit"), deliberately bounded to users + SSO (no orgs).
- `docs/design-docs/conventions.md` — API/persistence casing and envelope.
- `docs/design-docs/transactional-email.md`, `observability.md` — operational
  direction (Resend, Pino/OTel), built at their triggers.
- `docs/design-docs/infra-deployment.md` — namestarlit VPS + Dokploy.
- `docs/exec-plans/completed/drive-model-tenancy.md` — the reshape from the
  original shared-workspace model to this one, with the decision log.
- Patterns inherited from the pigfarm design docs (design only; no ownership
  relationship).

## The model in one line

```txt
User (1:1) Hub → Collections → Resources
```

Each **user** owns exactly **one hub** — their personal space, like a Google
Drive or a Tailscale tailnet. A hub owns **collections**; collections contain
**resources** and nest one level into sections. There are **no memberships,
invitations, roles, or usernames**. Collaboration is per-collection sharing
only; a hub is never a space others "join".

## Principles

1. **Immutable IDs are the only identity.** Every entity keys on an immutable
   UUIDv7 (`userId`, `hubId`, `collectionId`, `resourceId`). Human-facing
   values — the hub **handle**, the **display name**, emails — are mutable
   attributes and never appear in authorization rules, foreign keys, or durable
   route contracts. A durable link uses `hubId`/`collectionId`; renaming a
   handle never breaks a saved reference.
2. **One hub per user.** The hub is the tenant root and is 1:1 with its owner
   (`hub.ownerUserId`, unique). Every hub-owned query carries `hubId`; a route
   id never proves access. A user has no domain data except through their hub.
3. **Ownership is a transferable relationship, not identity.** A collection's
   owner is its `hubId`; a resource belongs to its collection. Transferring a
   collection reassigns the owning hub; the immutable **creator**
   (`collection.creatorUserId`) never changes.
4. **Collaboration is per-collection, Drive-style.** The only ways a non-owner
   gains access are a direct share (reader/editor), an active share link, or
   publication. There is no hub membership and no admin role — the hub owner is
   the only full authority over their space.
5. **Access inherits down the tree.** A grant on a collection applies to its
   descendant collections and their resources — sharing a "folder" shares its
   contents. Ownership already spans the whole subtree (one hub).
6. **Backend authority.** Business rules, validation, authorization, and
   derived state live in the API. Clients are replaceable delivery surfaces; a
   hidden control is not a permission check.
7. **Auth boundary.** better-auth owns credentials, sessions, and verification
   primitives; the product owns identity, authorization, and workflows. Session
   resolution goes through `resolveSessionUser`; services consume `AuthUser`.
   Sign-up onboarding (personal-hub creation) is an app-owned service callable
   from any auth path, so the later SSO integration is an integration, not a
   rewrite.
8. **Stable envelopes.** Success `{ data, meta? }`; failure
   `{ error: { code, message, requestId, details } }`; every response carries a
   server-generated PII-free `X-Request-Id`. Growth-prone lists paginate by
   opaque cursor.
9. **Naming boundaries.** Product branding stays out of schemas, table/column
   names, API fields, and env-var names.

Conventions in place and unchanged: Bun toolchain + runtime; Prisma as the
backend-only persistence boundary behind a Nest `PrismaService`; PostgreSQL 18
with `app_uuid_v7()` defaults; `timestamptz` UTC; camelCase API / snake_case
DB; global `ValidationPipe`; self-hosted better-auth with `Bun.password`
argon2id; Biome; `bun test`; committed `bun.lock`.

## Domain model

```txt
User            — global identity (better-auth). userId immutable; name (the
                  free-form display name), email, bio, image mutable. No
                  username, no role column.
Hub             — the user's one personal space. hubId immutable; ownerUserId
                  (unique FK, 1:1); handle (unique, mutable) — the public
                  identity; description.
Collection      — belongs to a hub (hubId = owner). creatorUserId immutable
                  (provenance). slug (unique per hub), title, description,
                  published, linkSharingEnabled, share_token_hash,
                  parentCollectionId (≤ 2 levels), version.
Resource        — an item in a collection; the smallest unit of content.
                  kind = external_link (its own canonical `url`, one per
                  collection) | collection_link (linkedCollectionId, same hub).
                  titleOverride, tags (text[]), position, version. No summary,
                  no shared links/tags tables.
CollectionShare — (collectionId, userId, role reader|editor, source
                  direct|link). Per-collection access without any hub
                  membership. Feeds the shared/ surface.
CollectionSave  — (collectionId, userId, savedAt). A social-style bookmark of a
                  published collection. Feeds the saved/ surface.
ExportJob       — belongs to hub + collection; requestedByUserId.
```

## Identity and handles

- **Handle** — a hub's public, mutable, unique identity (YouTube-handle style,
  lowercase `[a-z0-9-]`, 3–60 chars, reserved words blocked). It is a *handy
  way to reach a known hub* — `/@handle` resolves to the hub's page — never a
  key. The durable key is `hubId`; a handle rename breaks nothing.
- **Display name** — free-form (`user.name`), any text the person wants. Not a
  login credential and not unique.
- **Login** is email + password (SSO later). There is no username.
- **Account/hub handover** is done by **changing the account email** (verified),
  not a transfer model — a hub is 1:1 with its account, so handing over the
  account hands over the hub. Lands with the email/MFA hardening.
- **nsauth SSO** is bounded to users + SSO + profile (no orgs); see
  `identity-sso.md`. Products keep their own userId authoritative and their own
  authorization; the IdP never decides who may edit a collection.

## Access model

A single policy service (`CollectionPolicyService`) is the one source of truth.
For a collection it resolves, walking **up the ancestor chain** (same hub,
depth-bounded), the strongest of:

1. **Owner** — the viewer owns the collection's hub → full authority (read,
   write content, manage) over the whole subtree.
2. **Direct share** — reader (read) or editor (read + content write) on the
   collection or any ancestor.
3. **Active link** — a valid presented share token, or a recorded link-share,
   on the collection or any ancestor while link sharing stays enabled → read.
4. **Published** — the collection or any ancestor is published → read (a
   signed-in reader may save).

Otherwise the collection is **not found** (404, so callers cannot probe for
things they can't access). Reads that fail resolve to 404; writes a viewer may
not perform resolve to 403.

- **Manage** (publish, share, delete, settings, rename) is **owner-only**.
- **Editor** scope is content-only: resources, tags, imports within the shared
  collection (and, by inheritance, its sections). Editors never manage.
- A link grant is recorded against the collection whose link actually matched
  (which may be an ancestor), so it lands correctly in the recipient's
  shared/.

## Collections and resources

- **Nesting is one action on existing collections.** A collection is created
  standalone; to nest, you add an existing same-hub collection into another as a
  section (`POST /collections/:id/collections`). That single action creates the
  structural parent link **and** the section entry together; removing the
  section entry un-nests the collection. There is exactly one way to nest and
  one to un-nest — no create-and-nest shortcut and no reparent-via-update.
- **Nesting is capped at two levels**: a collection and its sections. A section
  cannot contain sub-sections, and a collection that already has sections cannot
  itself be nested. Enforced by the `check_collection_hierarchy` trigger and the
  nest service path. "Chapters with sections, no sub-chapters."
- **Resource kind is set by how it was added, never by inspecting a URL.**
  - A pasted/copied URL is always an **external link** — a hyperlink with an
    editable title, tags, and position. It never expands or nests; opening it
    navigates outward, subject to the destination's own access.
  - A **collection-link** is a **section** — created only by nesting an existing
    same-hub collection, never as a link to an arbitrary collection. Because a
    collection-link is always a structural section, it is always in the same
    hub, always access-inherited, and bounded by the two-level cap — so it
    cannot become a dead link or embed (and re-publish) another owner's
    collection. Cross-hub references are a future read-only **shortcut**.
- **Resources carry no summary.** Clarify a vague link by renaming its title;
  tags carry the rest. Ordering makes a collection a guide; export expands its
  nested sections in order.

## Ownership transfer

- **Collection transfer** (`POST /collections/:id/transfer`) is Drive-accurate:
  the owner transfers a **top-level** collection only to a user who is
  **already an editor** on it (a section cannot be transferred alone — it moves
  with its parent). The collection subtree moves into the recipient's hub,
  the recipient's now-redundant shares are removed, the previous owner is given
  **editor** access across the subtree (it lands in their shared/), and the
  immutable **creator** is untouched. Self-transfer and recipient-hub slug
  collisions are rejected.
- **Account/hub transfer** is not a model — see "Identity and handles" (email
  change).

## Publication and discovery

- **Publish** puts a collection on the product-wide **explore** surface
  (`GET /explore`, public, cursor-paginated, recency-ordered initially). Anyone
  can view; account holders **save** into their **saved/** surface. Saving
  requires publication; a save goes dormant on unpublish and revives on
  republish.
- **Publishing exposes sections (by design).** Because access inherits down,
  publishing a collection makes its sub-sections publicly readable as part of
  it — they are readable but not separately listed in explore (`published`
  stays false on the children). This is required for guides to work; it is also
  a public exposure, so the W3 publish flow must confirm it, naming how many
  sections become readable. No policy change — a documented, intended behavior.
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

## Tags

Optional labels stored **directly on** a collection or resource as a normalized
`text[]` (lowercase, de-duplicated, capped at write time) — set as part of
create/update, not a separate attach/detach step. There is no shared tag table,
no global namespace, and no "click a tag → everything tagged it" view: that
global machinery added complexity without value for a single-user tool.
Cross-library retrieval is a full-text search concern (Phase E), covering
titles, tags, and text together. Keep tags flat — no hierarchies or governance.

## Export

Export a collection as Markdown, PDF, or Word. Export **expands nested sections
in order** into one document (a table-of-contents collection becomes a printed
guide in a single pass); external-link resources stay as references and are not
inlined. Markdown is synchronous; PDF and Word are queued jobs.

## Workspace and client surfaces

A Bun-workspace monorepo:

```txt
apps/
  api/        NestJS backend. Prisma schema/migrations/generated client and
              PrismaService stay inside; clients never touch persistence.
  web/        Next.js — the full product surface (planned, Track W3).
  extension/  MV3 capture companion (planned, Track W4).
packages/
  types/      @nslinkhub/types — hand-curated API wire contracts.
  config/     shared TypeScript/tooling configuration.
tooling/      repository checks (client boundary check).
```

Dependency rules: clients depend on the API contract and `@nslinkhub/types`
only — never Prisma or `apps/api` internals (enforced by
`tooling/check-client-boundaries.ts`). API authorization is the source of
truth; UI hiding is not a security rule. Packages use the `@nslinkhub/*` scope.

Surface roles: **Web** is the full surface (explore, hub page, collections,
resources, tags, sharing, transfer, saves, account). **Extension** is a
constrained capture companion (authenticate, pick collection, capture the tab
or selection via popup/context-menu/shortcut) using the existing
external-resource endpoint; no management surface, no reimplementation of
dedupe or publication rules; bearer-token auth in session-scoped storage.

## Delivery status and remaining tracks

The backend model above is **built and verified** (one hub per user, Drive
sharing with downward inheritance, collection transfer, two-level nesting,
same-hub collection-links, minimal resources, tag pruning). Shared contracts
(`@nslinkhub/types`) and the client boundary check are in place. Nothing is
deployed, so schema changes reshape `prisma/migrations/0_init` rather than
stacking migrations.

Remaining:

- **W3 — Web app.** Opens with an impeccable design/product pass producing the
  three web design documents (`web-product-experience`, `web-interface-system`,
  `web-design-tokens`), then scaffolds `apps/web` and builds vertical slices:
  explore, sign-in, the hub page, collection list/detail (guides), resource
  capture, sharing + transfer management, shared/ and saved/. Cookie sessions.
- **W4 — Browser extension.** `apps/extension` (MV3) capture companion.
- **Phase E — tracked, not blocking.**
  - nsauth SSO once it exists (users + SSO; see `identity-sso.md`).
  - Audit records; transactional outbox + worker split; Resend email delivery;
    Pino/OTel observability.
  - `/@handle` vanity route resolving to `hubId` (direct hub navigation).
  - Explore discovery by **tags + text** (search) beyond the initial recency
    list; full-text search across collections/resources.
  - Read-only cross-hub **shortcut** references to shared collections.
  - Pending shares for unregistered emails (invitation-style, activated on
    sign-up).
  - Resource-level saves — evaluate after collection saves prove the loop.
