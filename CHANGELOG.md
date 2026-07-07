# Changelog

All notable project changes are recorded here for humans and agents. Follow
the spirit of [Keep a Changelog](https://keepachangelog.com/en/1.1.0/) and use
Conventional Commit categories when preparing commits.

This file is not a replacement for design docs or ExecPlans. It is the durable
summary of what changed after completed work has been promoted out of `ref/`.

## Unreleased

### Added

- Nested access inheritance: the collection access policy now resolves up the
  ancestor chain, so a share, active link, or publication on a parent
  collection grants the same access to its descendants (and their resources),
  Drive-folder style. Also fixes published nested guides — a published
  table-of-contents collection now makes its sub-sections readable. A link
  grant records against the collection whose link was actually used (which may
  be an ancestor).

- Collection ownership transfer (`POST /api/v1/collections/:id/transfer`,
  `{ email }`). Drive-style: only the owner may transfer, only to a user who is
  already an `editor`. The collection subtree moves into the recipient's hub,
  the recipient's now-redundant shares are removed, the previous owner is given
  `editor` access across the subtree (landing it in their shared/), and the
  immutable creator is untouched. Guards: self-transfer and recipient-hub slug
  collisions are rejected.

### Changed

- Collections gained an immutable `creatorUserId` (provenance), set at
  creation, distinct from the mutable owner (`hubId`). Groundwork for
  Drive-style collection ownership transfer: on transfer the owner (hub)
  changes but the creator does not. `ON DELETE SET NULL` so a collection
  outlives its creator's account after a transfer.

- Tenancy reshaped to the Google-Drive individual model (before Track W3).
  A hub is now **one personal space per user** (1:1), identified by a mutable,
  unique **handle** (the "hub name") plus a free-form **display name**. Removed
  hub memberships, invitations, and roles (`HubMembersService`,
  `HubInvitationsService`, their controllers/DTOs, and the `HubMembership` /
  `HubInvitation` tables); removed the better-auth `username` plugin and the
  `username`/`displayUsername` fields; removed the global `User.role` and the
  admin bypass (no admin persona). Collection access is now owner → direct
  reader/editor share → active link → published, with no membership branch.
  Ownership is a transferable FK (`hub.ownerUserId`, `collection.hubId`);
  durable links use the immutable `hubId`, so a handle rename never breaks a
  saved reference. The username-based `/users/:username` routes became a
  self-service profile at `/api/v1/profile` (display name, bio, handle). The
  `0_init` migration was reshaped (squash) with all hand-written SQL objects
  preserved. Full write-up: `docs/exec-plans/active/drive-model-tenancy.md`.

- Tags: orphaned tags are now pruned automatically. Because tags are global
  (unique by name, shared across hubs), a tag is deleted only when nothing
  references it anywhere — after detaching it from a collection/resource, or
  after a resource/collection delete cascades its last reference away. Adds a
  `pruneOrphanTags` helper (tags module) wired into the detach and delete
  paths, hardens tag creation to an upsert against races, and an e2e test.
  Removes the "unused tags never removed" tech-debt item.

- Tooling: replaced ESLint + Prettier with Biome (`biome.json`) for
  workspace-wide formatting and linting, run from the repository root and
  wired into `bun run verify` (`format:check` + `lint`). `useImportType` is
  disabled for `apps/api` only, because NestJS dependency injection and
  `emitDecoratorMetadata` require runtime imports for decorated
  classes/parameters; it stays enabled for `packages/*`, `tooling/`, and the
  future `apps/web`. Added an explicit `apps/api` `tsc --noEmit` typecheck to
  `verify` (also covers test files). Trade-off recorded in the tech-debt
  tracker: Biome has no type-aware lint rules, so `no-floating-promises` and
  `no-unsafe-*` coverage is dropped (type errors still caught by `tsc`).

- Operational-foundations direction: documented transactional email
  (`docs/design-docs/transactional-email.md` — Resend behind an application
  adapter, backend-owned React Email templates, PostgreSQL outbox + BullMQ
  worker, signed webhooks; better-auth mints verification/reset tokens, the
  app only delivers them) and observability
  (`docs/design-docs/observability.md` — Pino JSON logging, Sentry +
  OpenTelemetry/OTLP + Grafana Alloy → Grafana Cloud, PII allowlist). Both are
  direction only; implementation lands at its tracked trigger. Full-text
  search moved from an open product decision to a tracked Phase E item.

- Shared contracts (Track W2): added `packages/types` (`@nslinkhub/types`) —
  a source-only workspace package of hand-curated API request/response wire
  contracts (envelope, collections, resources, hubs, imports, exports;
  timestamps as ISO strings) for the web app and extension to consume, and
  `tooling/check-client-boundaries.ts`, which fails if a client imports
  `apps/api` internals or Prisma. The root `bun run verify` now runs the
  boundary check and the types typecheck alongside the API verify.

- Invitations + membership management (Phase D): hub roles are now enforced
  (owner > admin > member) via `HubsService.requireHubRole`. Hubs gained the
  ways people join and are managed: `POST /hubs/:hubId/invitations`
  (`{email, role}` — inviting a member needs admin+, inviting an admin needs
  owner; random expiring one-time hashed token, email delivery a logged
  no-op), list/revoke invitations, and `POST /invitations/accept` (`{token}`
  in the body; the authenticated acceptor's email must match; creates the
  membership). Membership endpoints: `GET /hubs/:hubId/members`,
  `PATCH /members/:userId` (role change, owner-only), `DELETE /members/:userId`
  (admin removes members, owner removes anyone, self-leave allowed) — all
  under the last-owner rule — and `POST /hubs/:hubId/transfer-ownership`
  (target member → owner, actor → admin, one transaction). This completes the
  backend of the hub architecture; remaining work is the client tracks and
  Phase E hardening.

- Authorization + public surfaces (Phase C): a single
  `CollectionPolicyService` now resolves all collection access (first match:
  published → read, hub membership → full, direct share → reader/editor,
  active link/token → read) and replaces the interim membership checks across
  collections, resources, tags, imports, and exports. Capability tiers land:
  hub members manage (publish, share, delete), direct-share editors write
  content only, readers/link/published read only. New surfaces: `GET /explore`
  (replaces `/collections/public`), public hub pages `GET /hubs/:hubId` and
  `GET /hubs/:hubId/collections`, hub-scoped lookup
  `GET /hubs/:hubId/collections/:slug` (which replaces and deletes the
  mutable-username lookup route), publish/unpublish, `PUT /link-sharing`
  (enable/disable/rotate; disabling clears the token), direct shares CRUD,
  save/unsave, and `GET /me/shared` + `GET /me/saved` (with dormant handling).
  Opening a valid share link records a link-sourced share on the viewer's
  shared/ surface, valid only while link sharing stays enabled. Reads that
  fail access now return 404 (not 403) for resources the caller cannot know
  exist.

- Documented the API/persistence casing convention
  (`docs/design-docs/conventions.md`): camelCase JSON keys, snake-token enum
  values, snake_case DB columns via Prisma `@map`. Fixed the one endpoint
  that broke it — the import response now returns camelCase counts
  (`totalRows`, `importedCount`, `errorCount`, …) instead of snake_case, and
  gained its first e2e coverage.

- Hub tenancy (Phase B): the domain model became **Hub → Collections →
  Resources**. Hubs are the tenant root and own collections through a
  `hub_id` foreign key; users belong to hubs via `hub_memberships`
  (`owner | admin | member`) and every sign-up atomically creates a personal
  hub (owner membership) through an app-owned, auth-path-agnostic onboarding
  hook. The visibility triad was replaced by a `published` boolean plus
  `link_sharing_enabled` (rotatable share token); `collection_shares`,
  `collection_saves`, and `hub_invitations` tables were added (schema now;
  endpoints in Phases C/D). The `0_init` migration was reshaped (nothing is
  deployed) and the `repositories`/`entries` modules, routes, and vocabulary
  were renamed to `collections`/`resources` — API routes move to
  `/api/v1/collections/:id/resources|tags|children|export` and
  `/api/v1/users/:username/collections/:slug`. Interim access is
  hub-membership based; Phase C installs the full policy service. Fixed a
  latent bug found in passing: the browser-friendly `?s=<token>` share-link
  query was rejected by the global `forbidNonWhitelisted` pipe.

- Foundation conventions (Phase A): failures now return the stable error
  envelope `{ error: { code, message, requestId, details } }` with stable
  machine-readable codes; every response carries a server-generated
  `X-Request-Id`; startup fails fast on malformed configuration; and the
  entries and public-repositories listings switched from page/limit to
  opaque cursor pagination (`meta: { limit, nextCursor }`, `total` dropped).

- Restructured the repository into a Bun workspace (Track W1): the backend
  moved to `apps/api` (`@nslinkhub/api`) with history-preserving renames,
  shared TypeScript base config landed in `packages/config`, and root
  scripts delegate (`bun run verify` et al. keep working from the root).
  The move surfaced and fixed two undeclared direct dependencies (`dotenv`,
  `express`) and dropped library-style declaration emit from the app build.

- Retired the v2 feature spec. It described the pre-hub direction (user
  ownership, visibility triad, JWT auth) and is superseded by PRODUCT.md and
  the hub design; only currently-true behavior was carried over
  (canonical-URL rules, import partial-failure reporting) plus two real gaps
  into the tech-debt tracker (unused-tag cleanup, export retention). Its
  spec-era API contracts (ETag/Last-Modified caching, folder-tree bookmark
  mapping) were dropped — the hub-era API design decides those fresh.

- Migrated the stack to Bun (runtime + package manager), Prisma 7 (driver
  adapter, generated client, single `0_init` migration owning triggers and
  CHECK constraints), and self-hosted better-auth (bearer + username plugins,
  argon2id via `Bun.password`), replacing npm/Node, TypeORM, and JWT/Passport.
- Restarted API versioning at `/api/v1` (the Flask-era v1 never shipped).
- Renamed `docker-compose.yml` to `compose.yml` (local development only);
  production topology will live in swarm-dialect `docker.stack.<env>.yml`
  files.
- Adopted the pigfarm workflow wholesale: `AGENTS.md` map + `CLAUDE.md`,
  `PRODUCT.md` as the canonical product definition, ExecPlans under
  `docs/exec-plans/` (`PLANS.md` format, tech-debt tracker), focused
  principles docs (`docs/CORE_BELIEFS.md`, `docs/SECURITY.md`,
  `docs/RELIABILITY.md`), design documents under `docs/design-docs/` with an
  index, runbooks under `docs/runbooks/` (local development, verification,
  migrations, reference context), a root `bun run verify` gate, a rewritten
  concise `ARCHITECTURE.md` map, git-ignored `ref/` scratch area, and this
  changelog. The pre-ExecPlan session workflow (TASKS.md, `.codex/`,
  developer-workflow/dev-session/implementation-status/PROJECT_STATE docs)
  was removed.

### Fixed

- DB-generated ids are returned on insert (entry/tag/export-job creation no
  longer fails on new rows) — fixed wholesale by the Prisma migration.
- `PATCH .../entries/reorder` was unreachable (shadowed by the `:entryId`
  route); reorder is now declared before parameter routes.
- `GET /repositories/:id/entries` and `GET /repositories/:id/children` were
  unreachable (shadowed by the `:owner/:slug` catch-all); the owner/slug
  lookup moved to `GET /users/:username/repositories/:slug` with e2e
  regression tests, including a non-uuid 400 canary.

### Added

- Local dev services via `compose.yml` (PostgreSQL 18, Redis 7).
- E2E regression suite running the production HTTP stack (better-auth mount +
  body-parser ordering) through shared `configureApp`.
- Authoritative forward design: hub architecture plan (hubs → collections →
  resources, Drive-style sharing, explore/saves, workspace + clients) and the
  ns-series identity and deployment directions.
