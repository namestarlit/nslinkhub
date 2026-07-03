# Hub Architecture Plan

Authoritative design and implementation plan for restructuring NSLinkHub
around **hubs** as the tenant root, with the collection/resource vocabulary,
Drive-style sharing, the explore/save discovery loop, and the pigfarm-derived
monorepo. All decisions herein are settled (finalized 2026-07-03); this
document states the target design in its final form.

Related documents:

- `docs/identity-sso-direction.md` — ns-series identity ("Continue with
  namestarlit"); imposes constraints noted in Phase B/C.
- `docs/infra-deployment-direction.md` — ns-series deployment platform
  (namestarlit VPS + Dokploy, GHCR images via GitHub Actions); Track W's
  app split is the image boundary it consumes.
- `ref/hub-upgrade-next-session.md` — implementation session starter.
- `ref/migration-plan.md` — the completed Bun/Prisma/better-auth stack
  migration this plan builds on (including the squash-don't-stack migration
  pattern).
- Architectural conventions inherited from the pigfarm design documents
  (`/home/ns/Person/stack/hashikome/pigfarm/docs/design-docs/` — tenancy,
  organization authority, auth sessions, foundation conventions, backend
  authority). Design patterns only; no ownership relationship.

## Vocabulary

```txt
Hub → Collections → Resources
```

- A **hub** is the tenant root — the only true identity boundary.
- A **collection** is the container of curated content — what a folder is to
  Google Drive. Collections nest.
- A **resource** is an item in a collection: an external link or a link to
  another collection.
- The internal `links` URL-dedupe table keeps its name.

## Principles

1. **Immutable IDs are the only identity.** Every entity keys on an immutable
   UUIDv7 (`hubId`, `userId`, `collectionId`). Human-facing values —
   usernames, display names, hub names, emails — are mutable attributes and
   never appear in authorization rules, foreign keys, or route contracts.
2. **The hub is the tenant root.** A hub owns collections and everything in
   them (resources, tags, shares, exports, imports). Users belong to hubs
   through memberships and can belong to many. Nothing domain-owned hangs off
   a user directly; user-level surfaces (shared/, saved/) are views over
   grants and saves, not ownership.
3. **Tenant-scoped query contract.** Every hub-owned lookup requires `hubId`,
   not just the record id. Route IDs never prove access. Data-access methods
   make unscoped queries hard to express.
4. **Hub roles are minimal**: `owner | admin | member`.
   - `owner` — administers the hub: invite/remove members, grant/revoke
     admin, transfer ownership, delete/archive the hub. A hub always retains
     at least one owner (removal/demotion of the last owner is blocked).
   - `admin` — manages content and non-owner members; cannot grant admin,
     remove owners, or archive the hub.
   - `member` — full content write: creates/edits/deletes collections,
     resources, tags, imports, exports within the hub.
   Role policy is enforced in backend guards/policy services, never only in
   client navigation. Member-level content restriction is intentionally not
   modeled; non-members are covered by collection shares.
5. **Invitations, not attachment.** Users join hubs only through explicit
   invitation + authenticated acceptance. Invitee emails resolve against the
   global identity: reuse an existing verified account (after authenticated
   acceptance), create a pending identity only for a new email. Nothing
   attaches a user to a hub implicitly. Invitation/verification tokens are
   random, expiring, one-time, purpose-bound secrets — never UUIDv7 ids —
   submitted in POST bodies, not path parameters.
6. **Every user gets a personal hub at sign-up** — auto-created, named after
   the display name, creator as owner — and it is a completely normal hub:
   renameable, deletable, invitable, no special-casing. Users may
   legitimately end up with zero hubs.
7. **Auth boundary.** better-auth owns credentials, sessions, and
   verification primitives. The product owns identity, membership,
   authorization, audit, and workflows. Sign-up onboarding (personal hub
   creation) lives in an app-owned service callable from any auth path — a
   hard requirement of the SSO direction.
8. **Backend authority.** Business rules, validation, authorization, and
   derived state live in the API. Clients are replaceable delivery surfaces;
   a hidden button is not a permission check.
9. **Atomic bootstrap.** Creating a hub atomically persists the hub, the
   creator's owner membership, and (once auditing exists) the audit record.
10. **Stable error envelope.** Failures return
    `{ "error": { code, message, requestId, details } }` with stable
    machine-readable codes and server-generated PII-free request IDs;
    successes keep the `{ data, meta }` shape.
11. **Cursor pagination** for growth-prone lists (resources, collections,
    explore). The contract locks before any client ships.
12. **Audit sensitive actions** (tracked for Phase E): hub creation/archival,
    invitations, membership and role changes, ownership transfer, publication
    changes, share-link rotation. Tenant-scoped audit records in PostgreSQL.
13. **Naming boundaries.** Product branding stays out of schemas,
    table/column names, API fields, and env-var names.

Conventions already in place and unchanged: Bun as toolchain and runtime,
Prisma as the backend-only persistence boundary behind a Nest `PrismaService`,
PostgreSQL 18 with native uuidv7 defaults, `timestamptz` UTC storage,
camelCase API / snake_case DB, global `ValidationPipe`, self-hosted
better-auth with `Bun.password` argon2id, `bun test`, committed `bun.lock`.

## Domain Model

```txt
User            — global identity (better-auth). userId immutable; username,
                  displayName, email mutable. Username is a login/display
                  convenience, never an authorization or routing key.
Hub             — tenant root. hubId immutable UUIDv7. name/description
                  mutable. Personal and shared hubs are the same thing.
HubMembership   — (hubId, userId, role: owner|admin|member, status).
                  Unique per (hubId, userId).
HubInvitation   — (hubId, email, role, tokenHash, expiresAt, status).
                  Accepted by an authenticated user; produces a membership.
Collection      — belongs to a hub. `published` boolean (default false) +
                  `linkSharingEnabled` boolean + rotatable share-token hash.
                  Nests via parentCollectionId. Slug unique per hub.
CollectionShare — (collectionId, userId, role: reader|editor,
                  source: direct|link). Per-user access to one collection
                  without hub membership. Feeds the shared/ surface.
CollectionSave  — (collectionId, userId, savedAt). A social-style bookmark of
                  a published collection. Feeds the saved/ surface.
Resource        — external link or collection link inside a collection;
                  access derives from the owning collection.
Link/Tag        — `links` is the internal URL-dedupe table; tags attach to
                  collections and resources.
ExportJob       — belongs to hub + collection; requestedByUserId for audit.
```

## API Surface

All routes under `/api/v1`.

```txt
POST   /api/v1/hubs                                  create hub (creator = owner)
GET    /api/v1/hubs/:hubId                           hub page (public: display info
                                                     + published collections; more for members)
POST   /api/v1/hubs/:hubId/invitations               invite (owner/admin)
POST   /api/v1/invitations/accept                    token in body
GET    /api/v1/hubs/:hubId/collections               list (member; published subset otherwise)
POST   /api/v1/hubs/:hubId/collections               create (member)
GET    /api/v1/hubs/:hubId/collections/:slug         lookup by hub + slug
/api/v1/collections/:id/*                            resources, tags, children,
       exports — authorized via publication + membership + shares
POST   /api/v1/collections/:id/publish               publish to explore
POST   /api/v1/collections/:id/unpublish
PUT    /api/v1/collections/:id/link-sharing          enable/disable/rotate link
POST   /api/v1/collections/:id/shares                direct share {email, role}
DELETE /api/v1/collections/:id/shares/:userId        revoke
POST   /api/v1/collections/:id/save                  save (auth; published only)
DELETE /api/v1/collections/:id/save                  unsave
GET    /api/v1/explore                               published collections (public, cursor)
GET    /api/v1/me/shared                             the user's shared/ surface
GET    /api/v1/me/saved                              the user's saved/ surface
```

`hubId` is canonical in URLs. A mutable vanity handle may later alias it,
resolved to `hubId` at the edge and never stored in references.

## Publication And Discovery

Publishing puts a collection on NSLinkHub's product-wide public surface:

- Published collections are listed on `GET /api/v1/explore` (public,
  cursor-paginated; recency-ordered initially) and on their hub's public
  page. Anyone can view them, signed in or not.
- Account holders **save** published collections — the social-media bookmark
  gesture — into their **saved/** surface. Visitors are prompted to create an
  account to save.
- Saving requires publication. Unpublishing does not delete save rows; the
  saved item goes dormant (presentation decided by the web pass) and revives
  on republish.
- Publishing/unpublishing is a hub-member action and an audited event.

**shared/ vs saved/** — both user-level surfaces, never mixed: shared/ is
access *granted to you* (CollectionShare); saved/ is what *you chose to keep*
from the public surface (CollectionSave). A share grants access; a save
grants nothing.

## Sharing Model

Hub membership is intentionally heavyweight — it is for people who belong in
the hub. Seeing or editing one collection never requires membership; that is
what per-collection sharing (the Google Drive model) is for.

A collection is **published** (public via explore) or **unpublished** (hub
members + explicit shares only; default). On top of publication, two sharing
mechanisms:

1. **Link sharing — anyone with the link reads.** A per-collection toggle
   with a rotatable unguessable token. Always read-only. When a signed-in
   user opens a valid share link, the collection is recorded under their
   shared/ surface (`CollectionShare`, `source: link`, role `reader`); that
   access remains valid only while link sharing stays enabled — disabling or
   rotating the link cuts it off.
2. **Direct sharing — a specific person, read or write.** Share to an email
   address; requires a namestarlit-product account (existing accounts only;
   pending shares for unregistered emails are a Phase E item). Creates
   `CollectionShare` with `source: direct`, role `reader` (default) or
   `editor`. Independent of the link toggle, individually revocable, and
   surfaces under the recipient's shared/.

**Editor scope is content-only**: resources, tags, imports inside that one
collection. Editors do not publish/unpublish, manage sharing, delete the
collection, or touch anything else in the hub. Publication and share
management stay with hub members per hub-role rules.

**Access resolution for a collection** (single policy service; first match
wins): published → anyone reads (signed-in may save); hub membership → per
hub role; direct share → per share role; active link + valid token (or
link-sourced share row while the link stays enabled) → read; otherwise →
not found.

## Workspace And Client Surfaces

Bun-workspace monorepo:

```txt
apps/
  api/        the NestJS backend (Prisma schema, migrations, generated
              client, PrismaService stay inside — clients never touch
              persistence)
  web/        Next.js product surface (App Router, src/, Tailwind, @/* alias,
              run through Bun) — the FULL product surface
  extension/  WebExtension (Manifest V3) for Chrome/Edge/Firefox — a
              constrained capture companion, not a second product surface

packages/
  types/      shared API contracts (hand-curated first; OpenAPI-generated
              clients are a later option — Swagger decorators exist)
  config/     shared TypeScript/lint/tooling configuration
  (domain/, events/, email/ only when a concrete need appears)

tooling/      repository checks (no Prisma/persistence imports in clients,
              docs freshness)
```

Dependency rules:

- Clients depend on backend API contracts; they never become alternate domain
  engines and never import backend persistence code.
- API authorization is the source of truth; UI hiding is not a security rule.
- Workspace packages use the `@nslinkhub/*` scope.

Surface roles:

```txt
Web        Full surface: explore, hubs, memberships, invitations, collections,
           resources, tags, imports, exports, sharing, saves, account security.
Extension  Capture companion: authenticate, pick hub + collection, capture
           current tab / selection via popup, context menu, and keyboard
           shortcut (all three from the first cut). Submits commands and
           renders results; no management surface, no local reimplementation
           of publication or dedupe rules. Bearer-token auth with
           session-scoped storage (never long-lived secrets in sync storage).
```

The web app's design and product philosophy are coined in a dedicated
impeccable pass before building, producing NSLinkHub equivalents of pigfarm's
web-product-experience / web-interface-system / web-design-tokens documents.
Explore, shared/, and saved/ are first-class in that pass — the public face
and the retention loop of the product.

## Implementation Plan

Order: **W1 → A → B → C → D → W2 → W3 → W4**, with E tracked alongside.
Every phase ends green (build, lint, `bun test`, smoke) and is committed
separately. Nothing is deployed: schema changes reshape
`prisma/migrations/0_init` rather than stacking data migrations.

### W1 — Workspace restructure (mechanical, first)

- Root becomes a Bun workspace; the backend moves to `apps/api` (source,
  `prisma/`, `prisma.config.ts`, tsconfig, tests move together;
  `docker-compose.yml` and root scripts stay and delegate).
- Add `packages/config`; keep root `bun.lock`.
- No behavior change; everything builds/tests from the root before and after.

### Phase A — Foundation conventions

- Error envelope + request-id middleware (principle 10).
- Configuration validated at startup (`@nestjs/config` schema validation).
- Cursor pagination for resource/collection/explore listings (principle 11).

### Phase B — Schema

Current-code mapping for this phase: today's `repositories` table/module is
the collection concept, `entries` is the resource concept, `owner_id` is the
user-ownership column being replaced, and `visibility`
(public/unlisted/private) is the publication state being replaced.

- Rename: `repositories` → `collections`, `entries` → `resources` (modules,
  services, controllers, DTOs follow).
- Add `hubs`, `hub_memberships`, `collection_shares`, `collection_saves`
  (+ `hub_invitations` if Phase D lands together).
- `collections.owner_id` → `collections.hub_id` (FK to hubs, cascade).
- `collections.visibility` → `published` boolean (default false) +
  `link_sharing_enabled` boolean alongside the rotatable `share_token_hash`;
  drop the visibility CHECK constraints.
- `users.username` remains a mutable login/display convenience; it appears in
  no route and no FK.
- Atomic hub creation (hub + owner membership in one transaction); personal
  hub auto-created at sign-up through an app-owned onboarding service
  (auth-path-agnostic per the SSO constraints).

### Phase C — Authorization + public surfaces

- Hub policy service `requireHubRole(hubId, userId, minRole)` replaces all
  user-ownership checks; the platform-admin bypass is preserved.
- Scoped-query contract enforced (principle 3): collection lookups take
  `hubId` + `collectionId`; resource/tag/export lookups resolve the
  collection first and carry its hub.
- Collection access resolution implemented as the single policy service from
  "Sharing Model".
- Public surfaces: `GET /explore` and the public hub page.
- Sharing endpoints: publish/unpublish, link-sharing toggle+rotate, direct
  shares CRUD, `GET /me/shared`, link-sourced share recording.
- Saves: save/unsave (published only), `GET /me/saved` with dormant handling.
- Route change: hub+slug lookup at `GET /hubs/:hubId/collections/:slug`; the
  username-based lookup route is deleted (principle 1).
- Regression tests (extend `test/routes.e2e.spec.ts`): unpublished collection
  invisible to strangers and absent from explore; direct-share reader reads
  but cannot write; editor writes resources but cannot publish or manage
  shares; link rotation cuts off link-sourced access; saving an unpublished
  collection is rejected; a save goes dormant on unpublish and revives on
  republish.

### Phase D — Invitations + membership management

- `HubInvitation` flow per principle 5 (email delivery can be a logged no-op
  until email infrastructure exists).
- Membership endpoints: list members, change role, remove member — with the
  last-owner rule enforced.
- Ownership transfer as an explicit workflow.

### W2 — Shared contracts

- Extract `packages/types` with the API request/response types the web app
  needs.
- Add the `tooling/` boundary check (clients import neither `apps/api/src`
  internals nor Prisma).

### W3 — Web app

- Impeccable design/product pass first (three design documents), then
  scaffold `apps/web` and build vertical slices: explore (public), sign-in,
  hub switcher, collection list/detail, resource capture, sharing
  management, shared/ and saved/.
- Cookie sessions (better-auth); same origin or configured CORS + trusted
  origins.

### W4 — Browser extension

- `apps/extension` (MV3): sign-in, default hub+collection picker, capture via
  popup + context menu + keyboard shortcut, using the existing
  external-resource endpoint (dedupe/canonicalization stay backend-owned).

### Phase E — Tracked, not blocking

- ns-series SSO ("Continue with namestarlit") once nsauth exists — see
  `docs/identity-sso-direction.md` for the integration shape and the
  constraints Phases B/C already respect.
- Audit records (principle 12).
- Transactional outbox + worker split for exports/email.
- Vanity hub handles (mutable, unique-while-active, resolve to hubId).
- Pending shares for unregistered emails (invitation-style email, activated
  on sign-up).
- Resource-level saves — evaluate after collection saves prove the loop.
- Explore ranking/curation beyond recency — a product decision for the web
  pass.
