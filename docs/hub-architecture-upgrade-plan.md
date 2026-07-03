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

## Concept Mapping

| Pigfarm | NSLinkHub | Notes |
| --- | --- | --- |
| Organization (tenant root) | **Hub** | Owns everything; the only true identity boundary |
| Farm (team boundary in tenant) | — (not needed initially) | Repositories hang directly off the hub; a sub-boundary can be added later if needed |
| OrganizationMembership | **HubMembership** | `owner \| admin \| member` |
| FarmUserRole | — (defer) | Revisit per-repository roles only when a concrete workflow needs them |
| User (global identity, many orgs) | User (global identity, many hubs) | A user is just a user |

## Core Inherited Decisions

1. **Immutable IDs are the only identity.** Every entity keys on an immutable
   UUIDv7 (`hubId`, `userId`, `repositoryId`). Human-facing values — usernames,
   display names, hub names, emails — are mutable attributes. Never encode a
   mutable display value into authorization rules, foreign keys, route
   contracts, or durable integrations. (NSLinkHub already violates this in one
   place: `GET /users/:username/repositories/:slug`. Phase C fixes it.)
2. **The hub is the tenant root.** A hub owns repositories (and their entries,
   tags, share links, exports, imports). Users belong to hubs through
   `HubMembership` and can belong to many hubs. Nothing domain-owned hangs off
   a user directly.
3. **Tenant-scoped query contract.** Every hub-owned lookup requires `hubId`
   in the query, not just the record id. Route IDs never prove access.
   Repository/service methods should make unscoped queries hard to express.
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
   changes, role changes, ownership transfer, share-link rotation. Audit
   records are part of the product, tenant-scoped, in PostgreSQL.
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
Repository      — belongs to a hub (hubId replaces ownerId). Visibility rules
                  (public/unlisted+share-token/private) unchanged, but
                  "private" now means "hub members" rather than "one user".
Entry/Link/Tag  — unchanged shape; access derives from the owning repository's
                  hub. Hub-scoped queries carry hubId.
ExportJob       — belongs to hub + repository; requestedByUserId kept for audit.
```

Route consequences (breaking, fine — nothing is deployed):

```txt
POST   /api/v2/hubs                                  create hub (creator = owner)
GET    /api/v2/hubs/:hubId                           hub details (member)
POST   /api/v2/hubs/:hubId/invitations               invite (owner/admin)
POST   /api/v2/invitations/accept                    token in body
GET    /api/v2/hubs/:hubId/repositories              list (member; public subset for non-members)
POST   /api/v2/hubs/:hubId/repositories              create (member)
GET    /api/v2/hubs/:hubId/repositories/:slug        public lookup replaces /users/:username/...
       (hubId is canonical; a mutable vanity handle can alias it later,
        resolving handle -> hubId at the edge, never stored in references)
/api/v2/repositories/:id/*                           unchanged (entries, tags,
       share-link, children, exports) but authorized via hub membership
```

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
Web        Full surface: hubs, memberships, invitations, repositories,
           entries, tags, imports, exports, sharing, account security.
Extension  Constrained companion: authenticate, pick hub + repository,
           capture current tab / selection / context-menu link (title, URL,
           note), see capture status. No management, no settings, no
           second implementation of visibility or dedupe rules — it submits
           commands and renders results.
```

- The web app's design and product philosophy get coined in a dedicated
  impeccable pass before building (pigfarm's pattern: its
  `web-product-experience.md`, `web-interface-system.md`, and
  `web-design-tokens.md` were produced first and the UI built against them).
  Produce the same three documents for NSLinkHub.
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
- Decide cursor pagination for growth-prone lists (entries, repositories);
  keep page/limit only where lists stay small.

### Phase B — Hub tenancy schema

- Add `hubs`, `hub_memberships` (+ `hub_invitations` if Phase D lands
  together) to `prisma/schema.prisma`; reshape `0_init` rather than adding a
  data migration.
- `repositories.owner_id` → `repositories.hub_id` (FK to hubs, cascade).
- Keep `users.username` as mutable convenience (login via better-auth username
  plugin already works); it stops appearing in any route or FK.
- Hub creation is atomic: hub + creator owner-membership in one transaction.
- Every user gets a personal hub created at sign-up (better-auth
  `databaseHooks.user.create.after` or an app-owned onboarding service) —
  this keeps "individual user" a special case of the same model, not a
  parallel code path.

### Phase C — Authorization rework

- Replace `ownerId === user.userId` checks in services with a hub policy
  service: `requireHubRole(hubId, userId, minRole)` backed by memberships;
  keep the `UserRole.ADMIN` platform bypass.
- Enforce the scoped-query contract: repository lookups take `hubId` +
  `repositoryId`; entry/tag/export lookups resolve the repository first and
  carry its hub. Route IDs never prove access.
- Move the owner/slug public lookup to `GET /hubs/:hubId/repositories/:slug`;
  delete the `/users/:username/...` route (username is mutable — decision 1).
- Visibility semantics: `private` = hub members; `unlisted` share-token and
  `public` behavior unchanged.
- Update smoke scripts and e2e regression tests (`test/routes.e2e.spec.ts`).

### Phase D — Invitations + membership management

- `HubInvitation` flow per decision 5: create (owner/admin), email intent
  (can be a logged no-op until email exists), authenticated acceptance,
  expiring one-time hashed tokens, no enumeration leaks.
- Membership endpoints: list members, change role, remove member — with the
  last-owner rule enforced.
- Ownership transfer as an explicit workflow (two-step or immediate — decide).

### Track W — Workspace and client surfaces

Orthogonal to the tenancy phases. W1 is mechanical and can land any time; the
web app should start only after Phases B–C so it is built against hub routes,
never against the user-owned routes being removed.

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
  vertical slices: sign-in, hub switcher, repository list/detail, entry
  capture, share-link management. Cookie sessions (better-auth) — same
  origin or configured CORS + trusted origins.
- **W4 — Browser extension.** `apps/extension` (MV3, Chrome/Edge/Firefox):
  sign-in, default hub+repository picker, one-click capture of the current
  tab (uses the existing external-entry endpoint; dedupe/canonicalization
  stay backend-owned), context-menu "Save to NSLinkHub". Bearer-token auth
  with session-scoped storage.

### Phase E — Later hardening (track, don't block)

- Audit records for the sensitive actions in decision 9.
- Transactional outbox + worker split for exports/email (decision 11).
- Vanity hub handles (mutable, unique-while-active, resolve to hubId).
- Per-repository roles (pigfarm's FarmUserRole analog) only if a workflow
  demands finer grain than hub-wide roles.

## Open Decisions For The Next Session

1. Personal-hub UX: auto-created at signup (recommended, Phase B) — name it
   after displayName? Can a personal hub be deleted if it's the user's last?
2. Does `member` create repositories, or only `admin`+? (Pigfarm gives members
   no access until assigned; for a link-sharing product, `member` with write
   access is probably right. Decide before Phase C guards.)
3. Public hub pages: is an unauthenticated `GET /hubs/:hubId` (public repos
   only) wanted in Phase C, or defer?
4. Keep `page/limit` pagination or adopt cursors in Phase A (decision affects
   client contracts once, so decide early).
5. Error envelope shape: adopt pigfarm's exactly (`{ "error": { code, message,
   requestId, details } }`) or fold into the existing `{ data, meta }`
   convention.
6. Workspace timing: land W1 (mechanical move to `apps/api`) before or after
   the tenancy phases? Doing it first means every later diff lives at its
   final path; doing it later avoids mixing a move with behavior changes.
7. Extension capture UX: popup-only, or also a keyboard shortcut and
   context-menu item in the first cut?
