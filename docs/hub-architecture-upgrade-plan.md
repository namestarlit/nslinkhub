# Hub Architecture Upgrade Plan

Design decisions inherited from the pigfarm codebase
(`/home/ns/Person/stack/hashikome/pigfarm`, examined 2026-07-03) and a phased
plan to restructure NSLinkHub around **hubs** as the tenant root. Pigfarm's
implementation is still scaffold-stage; the decisions below come from its
design documents, which are the authoritative source:

- `pigfarm/ARCHITECTURE.md` (system shape + architectural invariants)
- `pigfarm/docs/design-docs/tenancy.md`
- `pigfarm/docs/design-docs/organization-authority.md`
- `pigfarm/docs/design-docs/auth-sessions.md`
- `pigfarm/docs/design-docs/foundation-conventions.md`
- `pigfarm/docs/design-docs/backend-authority.md`
- `pigfarm/docs/design-docs/controlled-onboarding.md`
- `pigfarm/docs/CORE_BELIEFS.md`

## Vocabulary

The container concept is renamed (decision 12): what the code today calls a
"repository" becomes a **collection** — the "folder" of NSLinkHub, what
folders are to Google Drive. What the code calls an "entry" becomes a
**resource**. A collection contains resources; a resource is an external link
or a link to another collection. The internal `links` URL-dedupe table keeps
its name. The rename lands with the Phase B/C reshaping (nothing is deployed)
and applies everywhere: schema, API routes, module/service names, docs, UI
copy.

```txt
Hub → Collections → Resources
```

## Concept Mapping

| Pigfarm | NSLinkHub | Notes |
| --- | --- | --- |
| Organization (tenant root) | **Hub** | Owns everything; the only true identity boundary |
| Farm (team boundary in tenant) | — (not needed initially) | Collections hang directly off the hub; a sub-boundary can be added later if needed |
| OrganizationMembership | **HubMembership** | `owner \| admin \| member` |
| FarmUserRole | **CollectionShare** (non-members only) | Per-collection reader/editor grants; member-level restriction intentionally not planned |
| User (global identity, many orgs) | User (global identity, many hubs) | A user is just a user |

## Core Inherited Decisions

1. **Immutable IDs are the only identity.** Every entity keys on an immutable
   UUIDv7 (`hubId`, `userId`, `collectionId`). Human-facing values — usernames,
   display names, hub names, emails — are mutable attributes. Never encode a
   mutable display value into authorization rules, foreign keys, route
   contracts, or durable integrations. (NSLinkHub already violates this in one
   place: `GET /users/:username/repositories/:slug`. Phase C fixes it.)
2. **The hub is the tenant root.** A hub owns collections (and their
   resources, tags, shares, exports, imports). Users belong to hubs through
   `HubMembership` and can belong to many hubs. Nothing domain-owned hangs off
   a user directly (user-level surfaces like shared/ and saved/ are views over
   grants and saves, not ownership).
3. **Tenant-scoped query contract.** Every hub-owned lookup requires `hubId`
   in the query, not just the record id. Route IDs never prove access.
   Data-access methods should make unscoped queries hard to express.
4. **Membership roles, minimal set.** `owner | admin | member`.
   - `owner`: administers the hub; invite/remove members, grant/revoke admin,
     transfer ownership, delete/archive the hub. A hub must always retain at
     least one owner (block removal/demotion of the last owner).
   - `admin`: manages content and non-owner members; cannot grant admin,
     remove owners, or archive the hub.
   - `member`: works with hub content per whatever content-level rules exist.
   Enforce role policy in backend guards/policy services, never only in
   client navigation.
5. **Invitations, not attachment.** Users join hubs through explicit
   invitation + authenticated acceptance. Resolve invitee email against the
   global user identity: reuse an existing verified account (after
   authenticated acceptance), create a pending identity only for a new email.
   Never silently attach a user to a hub or create duplicate identities.
   Invitation/verification tokens are separate random, expiring, one-time,
   purpose-bound secrets — never UUIDv7 ids — and are submitted in POST
   bodies, not path parameters.
6. **Auth boundary.** better-auth owns credentials, sessions, verification
   primitives. The product owns identity, membership, authorization, audit,
   and workflows. Don't wrap every better-auth method; add app-owned services
   only where a workflow crosses into product authority or must be atomic.
7. **Backend authority.** Business rules, validation, authorization, derived
   state live in the API. Clients (future web UI) are replaceable delivery
   surfaces; a hidden button is not a permission check.
8. **Atomic bootstrap.** Creating a hub atomically persists the hub, the
   creator's `owner` membership, and (once auditing exists) the audit record —
   one transaction, no partially-created tenants.
9. **Audit sensitive actions.** Hub creation/archival, invitations, membership
   changes, role changes, ownership transfer, publication changes, share-link
   rotation. Audit records are part of the product, tenant-scoped, in
   PostgreSQL.
10. **Stable API error envelope.** Machine-readable `code`, human `message`,
    server-generated PII-free `requestId`, optional `details`. Keep codes
    stable so clients can act on them.
11. **Append-oriented + idempotent async work.** Long-term: transactional
    outbox rows in PostgreSQL relayed to BullMQ; consumers assume
    at-least-once delivery and stay idempotent. Redis dispatches, PostgreSQL
    is authoritative. (NSLinkHub's export queue writes the job row and
    enqueues directly today — acceptable until reliability matters.)
12. **Naming boundaries.** Keep product branding out of schemas, table/column
    names, API fields, and env-var names; keep it configurable.
13. **Conventions already shared with pigfarm** (no action needed): Bun as
    toolchain and runtime, Prisma as the backend-only persistence boundary
    behind a Nest `PrismaService`, PostgreSQL 18 with native uuidv7,
    `timestamptz` UTC storage, camelCase API / snake_case DB, global
    `ValidationPipe`, self-hosted better-auth with `Bun.password` argon2id,
    `bun test`, committed `bun.lock`.

## Target Model

```txt
User            — global identity (better-auth). userId immutable; username,
                  displayName, email mutable. Username is a login/display
                  convenience, never an authorization or routing key.
Hub             — tenant root. hubId immutable UUIDv7. name/description/handle
                  mutable. Personal hubs and shared hubs are the same thing.
HubMembership   — (hubId, userId, role: owner|admin|member, status). A user's
                  authority in a hub. Unique per (hubId, userId).
HubInvitation   — (hubId, email, role, tokenHash, expiresAt, status). Accepted
                  by an authenticated user; produces a membership.
Collection      — (was: repository) belongs to a hub. Publication is a
                  boolean: published (on the product-wide explore surface) or
                  unpublished (hub members + explicit shares). Nests via
                  parentCollectionId.
CollectionShare — (collectionId, userId, role: reader|editor, source:
                  direct|link) — per-user access to one collection without hub
                  membership. Feeds each user's shared/ surface.
CollectionSave  — (collectionId, userId, savedAt) — a social-style bookmark of
                  a published collection. Feeds each user's saved/ surface;
                  viewable only while the collection stays published.
Resource        — (was: entry) external link or collection link inside a
                  collection; access derives from the owning collection.
Link/Tag        — unchanged; `links` stays the internal URL-dedupe table.
ExportJob       — belongs to hub + collection; requestedByUserId kept for audit.
```

Route consequences (breaking, fine — nothing is deployed):

```txt
POST   /api/v2/hubs                                  create hub (creator = owner)
GET    /api/v2/hubs/:hubId                           hub page (public: display info
                                                     + published collections; more for members)
POST   /api/v2/hubs/:hubId/invitations               invite (owner/admin)
POST   /api/v2/invitations/accept                    token in body
GET    /api/v2/hubs/:hubId/collections               list (member; published subset otherwise)
POST   /api/v2/hubs/:hubId/collections               create (member)
GET    /api/v2/hubs/:hubId/collections/:slug         lookup (replaces /users/:username/...;
       hubId is canonical; a mutable vanity handle can alias it later,
       resolving handle -> hubId at the edge, never stored in references)
/api/v2/collections/:id/*                            resources, tags, children,
       exports — authorized via publication + membership + shares
POST   /api/v2/collections/:id/publish               publish to explore
POST   /api/v2/collections/:id/unpublish
PUT    /api/v2/collections/:id/link-sharing          enable/disable/rotate link
POST   /api/v2/collections/:id/shares                direct share {email, role}
DELETE /api/v2/collections/:id/shares/:userId        revoke
POST   /api/v2/collections/:id/save                  save/bookmark (auth; published only)
DELETE /api/v2/collections/:id/save                  unsave
GET    /api/v2/explore                               published collections (public, cursor)
GET    /api/v2/me/shared                             the user's shared/ surface
GET    /api/v2/me/saved                              the user's saved/ surface
```

## Publication And Discovery (the explore surface)

Publishing is not merely "public if you have the URL" — it is **publication to
NSLinkHub's product-wide public page** (the explore surface):

- Published collections are listed on `GET /api/v2/explore` (public,
  cursor-paginated) and on their hub's public page. Anyone, signed in or not,
  can view them.
- Visitors are prompted to create an account to **save** a published
  collection — the social-media bookmark gesture. Saves land in the user's
  **saved/** surface.
- A save is viewable only while the collection stays published. Unpublishing
  does not delete save rows; the saved item goes dormant (listed as
  unavailable or hidden — web UX decides the presentation), exactly like a
  bookmarked social post whose author restricted it. Republishing revives it.
- Signed-in users get the same explore surface as a browsing destination.
- Publishing/unpublishing is a hub-member action (per hub-role rules) and an
  audited event.

**shared/ vs saved/:** both are user-level (not hub-scoped) surfaces.
shared/ is access *granted to you* (CollectionShare — Drive "Shared with me");
saved/ is what *you chose to keep* from the public surface (CollectionSave —
social bookmarks). They never mix: a share grants access; a save grants
nothing, it just remembers a published thing.

## Sharing Model (Google Drive philosophy)

Hub membership is intentionally heavyweight — it is for people who belong in
the hub, not a workaround for letting one person see one collection. The
gap it would otherwise create ("how many users must I invite just so someone
can *see* this?") is closed by per-collection sharing, modeled on how Google
Drive shares files. Without this, recipients of a link fall back to storing
it in browser bookmarks — the exact behavior the product exists to replace.

**Publication (replaces public/unlisted/private).** A collection is either
**published** — on the explore surface, visible to everyone — or
**unpublished** — visible to hub members and explicit shares only. Default:
unpublished. The old `unlisted` state is subsumed by unpublished +
link-sharing enabled; the CHECK constraints and share-token-required rules
around `unlisted` disappear.

**Two sharing mechanisms on top of publication:**

1. **Link sharing (anyone with the link → read).** A per-collection toggle
   with a rotatable unguessable token (the existing share-token
   infrastructure, reframed). Always read-only. When a signed-in user opens
   a valid share link, the collection is recorded under their **shared/**
   surface (`CollectionShare` with `source: link`, role `reader`); that
   recorded access remains valid only while link sharing stays enabled —
   disabling or rotating the link cuts it off, exactly like Drive.
2. **Direct sharing (specific person → read or write).** Share to an email
   address; requires a linkhub account (resolve email → userId; sharing to
   an unregistered email is an open item — start by requiring an existing
   account). Creates `CollectionShare` with `source: direct` and role
   `reader` (default) or `editor`. Direct grants are independent of the
   link toggle and revocable individually. The collection appears under the
   recipient's **shared/** surface.

**Editor scope.** An `editor` writes content inside that one collection —
resources, tags, imports. Editors do not publish/unpublish, manage sharing,
delete the collection, or touch anything else in the hub. Publication and
share management stay with hub members (per hub-role rules).

**Access resolution for a collection** (first match wins):
published → anyone reads (and signed-in users may save); hub membership →
per hub role; direct share → per share role; active link + valid token (or
link-sourced share row while the link stays enabled) → read; otherwise →
not found.

## Workspace And Client Surfaces

NSLinkHub inherits pigfarm's monorepo shape. The current repository is
backend-only by original intent (backend/frontend separation was the goal from
the start); the restructure makes room for the clients.

```txt
apps/
  api/        the existing NestJS backend moves here unchanged
              (Prisma schema, migrations, generated client, PrismaService
               stay inside apps/api — clients never touch persistence)
  web/        Next.js product surface (App Router, src/, Tailwind, @/* alias,
              run through Bun) — the FULL product surface
  extension/  WebExtension (Manifest V3) for major browsers — a constrained
              capture companion, not a second product surface

packages/
  types/      shared API contracts (request/response types) where sharing
              reduces drift — start hand-curated, consider OpenAPI-generated
              clients later (Swagger decorators already exist)
  config/     shared TypeScript/lint/tooling configuration
  (domain/, events/, email/ only when a concrete need appears)

tooling/      repository checks (boundary checks worth porting from pigfarm:
              no Prisma/persistence imports in clients, docs freshness)
```

Dependency rules (pigfarm `ARCHITECTURE.md`, adopted verbatim):

- Clients depend on backend API contracts; they never become alternate domain
  engines and never import backend persistence code.
- API authorization is the source of truth; UI hiding is not a security rule.
- Workspace packages use one scope (`@nslinkhub/*`); product branding stays
  out of schemas, API fields, and env-var names.

Surface roles (pigfarm `client-surfaces.md`, mobile stance applied to the
extension):

```txt
Web        Full surface: explore, hubs, memberships, invitations, collections,
           resources, tags, imports, exports, sharing, saves, account security.
Extension  Constrained companion: authenticate, pick hub + collection,
           capture current tab / selection / context-menu link (title, URL,
           note), see capture status. No management, no settings, no
           second implementation of publication or dedupe rules — it submits
           commands and renders results.
```

- The web app's design and product philosophy get coined in a dedicated
  impeccable pass before building (pigfarm's pattern: its
  `web-product-experience.md`, `web-interface-system.md`, and
  `web-design-tokens.md` were produced first and the UI built against them).
  Produce the same three documents for NSLinkHub. The explore surface,
  shared/, and saved/ are first-class in that pass — they are the public face
  and the retention loop of the product.
- Extension auth: better-auth bearer tokens (already configured). Treat token
  storage in the extension as the main design risk — prefer
  `chrome.storage.session`-backed short-lived tokens obtained through an
  explicit sign-in in the extension, never long-lived secrets in sync storage.
  Target Chrome/Edge/Firefox first (MV3), Safari only if demand appears.

## Phased Upgrade Plan

Each phase ends green (build, lint, `bun test`, smoke) and is committed
separately. The Prisma migration squash pattern from `ref/migration-plan.md`
applies: nothing is deployed, so prefer reshaping `0_init` over stacking
data-shuffling migrations.

### Phase A — Foundation conventions (small, independent)

- Stable error envelope (`code`, `message`, `requestId`, `details`) via a
  global exception filter + request-id middleware; keep codes stable.
- Validate configuration at startup (`@nestjs/config` schema validation).
- Cursor pagination for growth-prone lists (resources, collections, explore);
  keep page/limit only where lists stay small.

### Phase B — Hub tenancy schema (+ the rename)

- Rename tables/models with the reshape: `repositories` → `collections`,
  `entries` → `resources` (module, service, controller, DTO names follow).
- Add `hubs`, `hub_memberships`, `collection_shares`, `collection_saves`
  (+ `hub_invitations` if Phase D lands together) to `prisma/schema.prisma`;
  reshape `0_init` rather than adding a data migration.
- `collections.owner_id` → `collections.hub_id` (FK to hubs, cascade).
- `collections.visibility` → `published` boolean (default false) +
  `link_sharing_enabled` boolean alongside the existing rotatable
  `share_token_hash`; drop the unlisted CHECK constraints.
- Keep `users.username` as mutable convenience (login via better-auth username
  plugin already works); it stops appearing in any route or FK.
- Hub creation is atomic: hub + creator owner-membership in one transaction.
- Every user gets a personal hub created at sign-up (better-auth
  `databaseHooks.user.create.after` or an app-owned onboarding service) —
  this keeps "individual user" a special case of the same model, not a
  parallel code path.

### Phase C — Authorization rework + public surfaces

- Replace `ownerId === user.userId` checks in services with a hub policy
  service: `requireHubRole(hubId, userId, minRole)` backed by memberships;
  keep the `UserRole.ADMIN` platform bypass.
- Enforce the scoped-query contract: collection lookups take `hubId` +
  `collectionId`; resource/tag/export lookups resolve the collection first and
  carry its hub. Route IDs never prove access.
- Move the owner/slug public lookup to `GET /hubs/:hubId/collections/:slug`;
  delete the `/users/:username/...` route (username is mutable — decision 1).
- Implement the access-resolution chain from "Sharing Model": published →
  membership → direct share → active link. Collection access answers come
  from one policy service so resources/tags/exports can't drift.
- Public surfaces: `GET /api/v2/explore` (published collections,
  cursor-paginated) and the public hub page (decision 3).
- Sharing endpoints: publish/unpublish, link-sharing toggle+rotate, direct
  shares CRUD, `GET /me/shared`; record link-sourced shares when a signed-in
  user opens a valid share link.
- Saves: save/unsave endpoints (published collections only), `GET /me/saved`
  with dormant handling for unpublished items.
- Update smoke scripts and e2e regression tests (`test/routes.e2e.spec.ts`)
  including: unpublished collection invisible to strangers and absent from
  explore, direct-share reader can read but not write, editor can write
  resources but not publish or manage shares, link rotation cuts off
  link-sourced access, saving an unpublished collection is rejected, a save
  goes dormant on unpublish and revives on republish.

### Phase D — Invitations + membership management

- `HubInvitation` flow per decision 5: create (owner/admin), email intent
  (can be a logged no-op until email exists), authenticated acceptance,
  expiring one-time hashed tokens, no enumeration leaks.
- Membership endpoints: list members, change role, remove member — with the
  last-owner rule enforced.
- Ownership transfer as an explicit workflow (two-step or immediate — decide).

### Track W — Workspace and client surfaces

Resolved ordering (decision 6): **W1 → A → B → C → D → W2 → W3 → W4**. The
web app starts only after Phases B–C so it is built against hub routes, never
against the user-owned routes being removed.

- **W1 — Workspace restructure.** Root becomes a Bun workspace; the backend
  moves to `apps/api` (source, `prisma/`, `prisma.config.ts`, tsconfig, tests
  move together; `docker-compose.yml` and root scripts stay and delegate).
  Add `packages/config`; keep root `bun.lock`. Everything still builds/tests
  from the root. No behavior change.
- **W2 — Shared contracts.** Extract `packages/types` with the API
  request/response types the web app will need (hand-curated to start).
  Enforce the boundary mechanically (a `tooling/` check that clients import
  neither `apps/api/src` internals nor Prisma).
- **W3 — Web app.** First an impeccable design/product-philosophy pass
  producing the NSLinkHub equivalents of pigfarm's web-product-experience /
  web-interface-system / web-design-tokens docs; then scaffold
  `apps/web` (Next.js App Router, Tailwind, Bun-run) and build the first
  vertical slices: explore (public), sign-in, hub switcher, collection
  list/detail, resource capture, sharing management, shared/ and saved/.
  Cookie sessions (better-auth) — same origin or configured CORS + trusted
  origins.
- **W4 — Browser extension.** `apps/extension` (MV3, Chrome/Edge/Firefox):
  sign-in, default hub+collection picker, one-click capture of the current
  tab (uses the existing external-resource endpoint; dedupe/canonicalization
  stay backend-owned), context-menu "Save to NSLinkHub". Bearer-token auth
  with session-scoped storage.

### Phase E — Later hardening (track, don't block)

- Audit records for the sensitive actions in decision 9.
- Transactional outbox + worker split for exports/email (decision 11).
- Vanity hub handles (mutable, unique-while-active, resolve to hubId).
- Sharing to unregistered emails (pending share + invitation-style email,
  activated on sign-up) — Phase C starts with existing accounts only.
- Resource-level saves (bookmarking a single resource, not just a
  collection) — evaluate after collection saves prove the loop.
- Explore ranking/curation (recency first; anything smarter is a product
  decision for the web pass).
- Per-collection roles for *hub members* are intentionally not planned:
  members already have full content write (decision 2), and non-members are
  covered by collection shares (decision 8). Revisit only if a concrete
  workflow needs member-level restriction.

## Resolved Decisions (with the user, 2026-07-03)

1. **Personal hub: auto-create as a normal hub.** Sign-up atomically creates
   a hub named after the display name with the creator as owner. It is a
   completely normal hub — renameable, deletable, invitable; no "personal"
   special-casing anywhere. Users may legitimately have zero hubs.
2. **`member` has full content write.** Members create/edit/delete
   collections, resources, tags, imports, exports within the hub. `admin`
   adds member management; `owner` adds hub administration.
3. **Public hub page ships in Phase C.** Minimal unauthenticated
   `GET /hubs/:hubId` returning hub display info + its published
   collections. Locks the public URL shape before the web app builds on it.
4. **Cursor pagination, adopted in Phase A** for resource, collection, and
   explore listings — the contract locks once, before any client exists.
5. **Pigfarm error envelope for errors**: failures return
   `{ "error": { code, message, requestId, details } }` with stable codes;
   successes keep the existing `{ data, meta }` shape.
6. **W1 lands first, before the tenancy phases.** The move is mechanical and
   the codebase is at its smallest; every later diff lives at its final path
   (`apps/api`). Implementation order: **W1 → A → B → C → D → W2 → W3 → W4**,
   with E tracked alongside.
7. **Extension first cut: popup + context menu + keyboard shortcut.** All
   three capture paths from the start.
8. **Drive-style per-collection sharing** (2026-07-03, follow-up): hub
   invitations are for people who belong in the hub; seeing or editing one
   collection never requires membership. Collections get link sharing
   (anyone with the link → read) and direct sharing by email (requires a
   linkhub account; `reader` default or `editor`), both surfacing under the
   recipient's user-level **shared/** view. See "Sharing Model".
9. **Publish/unpublish replaces public/unlisted/private**, and publishing
   means **publication to the product-wide explore surface** — listed on
   `GET /explore` and the hub's public page, viewable by anyone, savable by
   account holders. Unpublished = hub members + shares. Unlisted is subsumed
   by unpublished + link sharing enabled.
10. **Link shares are always read-only**, and link-derived shared/ entries
    stay valid only while the link is enabled (rotation/disable cuts them
    off). Direct shares are independent and individually revocable.
11. **Editor scope is content-only**: resources/tags/imports inside that one
    collection — no publish/unpublish, no share management, no delete, no
    other hub access. Direct sharing starts with existing accounts;
    unregistered-email sharing is a tracked Phase E item.
12. **Rename: repository → collection, entry → resource** (2026-07-03,
    follow-up). "Collection" chosen over basket/stack/shelf as the folder
    analog of NSLinkHub; a collection contains resources. The rename applies
    to schema, routes, code modules, and product copy, landing with Phase B/C.
13. **Saves are social-style bookmarks of published collections.** Stored as
    `CollectionSave` rows, surfaced under **saved/**, viewable only while the
    collection stays published (dormant on unpublish, revived on republish).
    saved/ (what you kept) and shared/ (what you were granted) never mix.
