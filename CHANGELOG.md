# Changelog

All notable project changes are recorded here for humans and agents. Follow
the spirit of [Keep a Changelog](https://keepachangelog.com/en/1.1.0/) and use
Conventional Commit categories when preparing commits.

This file is not a replacement for design docs or ExecPlans. It is the durable
summary of what changed after completed work has been promoted out of `ref/`.

## Unreleased

### Added

- `docs/SECURITY.md` § "Origins, CORS, and CSRF": records that the absence of
  CORS configuration is deliberate and complete (CORS relaxes the browser's
  Same-Origin Policy; configuring nothing grants no relaxation), why CORS can
  never be the access-control boundary, the CSRF nuance (simple-shaped
  requests still send; JSON bodies force failing preflights; better-auth owns
  origin checks on auth routes), and the standing rule: any future
  state-changing endpoint accepting a "simple" browser request shape adds
  explicit CSRF protection at that moment. Written so future security reviews
  don't misread the absence as an oversight. Also de-staled the membership-era
  wording in the auth-boundary and audit sections.

- Root scripts adopt the `<service>:<action>` convention: `infra:up` /
  `infra:down` (docker compose), `api:dev` / `api:start` / `api:prod` /
  `api:build` / `api:test`, `email:test`, `types:typecheck`. Per-service dev
  scripts chain `infra:up` (idempotent), so there is no start-order to
  remember; bare `dev` is the daily orchestrator (infra + API watch; the web
  joins it at W3). The old `start:*`/`test`/`typecheck:*` root names are gone
  (one way per action).

- Account-email change is specified as the double-verified handover flow
  (Substack model): confirm from the current address (which sees the target
  address; ignoring changes nothing) → verify the new address → change
  applies and all sessions are revoked. Sign-in direction decided:
  **code-first from the get-go** (continue with email → code screen; the
  email carries code + direct link; password is the explicit alternative,
  never the headline — no username era to migrate away from). The W3
  Impeccable pass shapes presentation, not flow order. Both documented in
  SYSTEM_DESIGN/PRODUCT; templates for the two change steps
  (`renderEmailChangeConfirmation`, `renderNewEmailVerification`) join
  `packages/email` on a shared code-email base. Wiring lands with the
  auth-delivery slice.
- `packages/email` (`@nslinkhub/email`): backend-owned React Email templates,
  starting with the **sign-in code** email (`renderLoginCode`) — Substack-style
  minimal layout with the lowercase `nslinkhub` wordmark, large spaced code,
  validity line, sign-in button + plain-link fallback, bold do-not-share
  warning, muted support footer. Typed and validated inputs (https-only URLs,
  code format, 1–60 min expiry), HTML + plain-text renders, subject never
  carries the code. Wired into `bun run verify` (typecheck + tests). Delivery
  (Resend adapter, outbox, worker) still lands with the auth-delivery slice
  per `docs/design-docs/transactional-email.md`.

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

### Fixed

- Sign-up no longer auto-issues a reserved hub handle (review finding #2). The
  handle rules moved to a shared `hubs/handle.ts` used by both `HubsService`
  and the framework-free onboarding path; `createPersonalHub` skips reserved
  handles when deriving one (e.g. a user named "Explore" gets `explore-2`, not
  the reserved `explore`).

### Added (W3 readiness)

- `GET /api/v1/hubs/by-handle/:handle` — handle → hub-page resolution, backing
  the web's `/@handle` URLs (the payload carries the immutable `hubId`).
- `GET /api/v1/collections/:id` — the durable permalink read: the immutable id
  survives slug renames (hub+slug stays the pretty URL). Same optional-auth +
  share-token + ETag semantics as the hub+slug lookup.
- `@nslinkhub/types` gained `users.ts` (`Profile`, `UpdateProfileRequest`) and
  `CollectionShareView.email` — present for direct shares (the owner supplied
  the email), `null` for link-source shares (their email was never the
  owner's to see).

- System status/readiness (pigfarm pattern): `GET /api/v1/status` now reports
  per-dependency readiness — postgres (authoritative; down = 503
  `dependencies_unavailable`) and the queue Redis (reserved for future email
  delivery; down = `degraded`, product fully usable). Checks use a fresh,
  non-reconnecting client with a 1.5s timeout; the API holds no standing Redis
  connection until the email worker wires BullMQ. `GET /api/v1/health` stays
  the dependency-free liveness probe. Redis config collapsed to one
  `REDIS_URL` (validated, `_FILE`-capable, local default
  `redis://127.0.0.1:6379`) — `REDIS_HOST`/`REDIS_PORT`/`REDIS_PASSWORD` are
  gone; the stale "nslinkhub-api-v2" service tag is gone with the old static
  status payload.
- Zero-config dev / required prod: development needs no configuration
  (in-code localhost defaults, no secret files), while anything provided is
  honored — resolution order is exported env var → optional `apps/api/.env`
  → in-code default. `_FILE` inputs are the deployed contract
  (previews/staging/production). With
  `NODE_ENV=production`, startup validation refuses to boot when
  `DATABASE_URL`/`BETTER_AUTH_SECRET` are absent or the auth secret is the
  public dev default (unit-tested).
- Deployment-secret `_FILE` contract implemented
  (`apps/api/src/config/secret.ts` + unit tests): `DATABASE_URL_FILE` and
  `BETTER_AUTH_SECRET_FILE` (docker/swarm secrets) take precedence over the
  plain env vars; file content is trimmed; an unreadable `_FILE` path fails at
  startup; local defaults keep dev zero-config. Redis credentials adopt the
  same `readSecret` when the email worker wires BullMQ.

### Changed (W3 readiness)

- One public origin, no CORS: web and API are served same-origin (Traefik
  path-routes `/api/*` in production; Next.js rewrites proxy in dev). The API
  dev port moved to **4000** — 3000 belongs to the web app — and
  `BETTER_AUTH_URL` defaults to `http://localhost:4000`
  (see `docs/design-docs/infra-deployment.md` § Origins).
- `GET /collections/:id/children` is unpaginated and returns the plain section
  list: access inheritance guarantees every child of a readable parent is
  readable, so the per-child policy loop and the page/limit dialect (the API's
  only one) are gone; `PageMeta` left `@nslinkhub/types`. Section order lives
  in the parent's resources.
- Documented the web URL scheme as a W3 contract (`docs/SYSTEM_DESIGN.md`):
  `/c/<id>` is the durable permalink (survives rename/transfer/re-nest; what
  share buttons emit), `/@handle` + `/@handle/<slug>` are flat pretty browse
  URLs allowed to break; no nested URL forms — structure never encodes into
  an address.
- Docs re-arranged: the authoritative design moved up to **`docs/SYSTEM_DESIGN.md`**
  (was `docs/design-docs/hub-architecture.md` — the name had drifted; the doc
  covers the whole system, and the deep design now sits at a glance beside
  `SECURITY.md`/`RELIABILITY.md`). Root `ARCHITECTURE.md` stays the short
  stable map; `docs/design-docs/` holds only focused satellite designs. All
  references updated repo-wide.
- Docs de-staled after the Drive reshape: `transactional-email.md` no longer
  plans a "hub invitation" email (collection-share notification instead, and
  the outbox note reflects synchronous exports), `identity-sso.md` and
  `observability.md` dropped hub-role/invitation phrasing,
  `infra-deployment.md` worker example is the future email worker, Swagger
  metadata documents cookie + bearer auth (no more "Sprint 1").

### Changed

- Exports are synchronous and complete: `POST /api/v1/exports`
  `{ format, collectionIds[] (1–20), expand? }` replaces the queued-job design
  (`POST /collections/:id/export/markdown`, `/export/pdf`, and job polling are
  gone). All three formats ship — Markdown, PDF (`pdfkit`), and Word (`docx`)
  — via programmatic renderers, so no format needs a queue. Every collection
  id is authorization-checked up front; the response body is the file itself
  (`Content-Disposition: attachment`), zipped when several collections are
  selected (one document per collection). Documents read like a Google Doc:
  root collection = H1 + description, sub-collections expand in order as H2
  sections (never H3, by the two-level cap); `expand: false` collapses them to
  a single line. Removed the `ExportJob` model, `export_jobs` table, BullMQ
  processor, and export artifact/retention concerns; BullMQ/Redis stay in the
  stack solely for future email/notification delivery.
- Imports narrowed to bookmarks-HTML (primary migration path) plus a universal
  CSV column format (fill `url` + optional `title` from any tool); the
  WhatsApp-TXT parser is removed as too source-specific. Per-row error reports
  flag outlier rows to fix or drop. Import dedup now checks the resource's own
  canonical `url` (the `urlHash` lookup died with the links table).
- `@nslinkhub/types` caught up with the Drive model: removed the stale
  `ExportJob`/`ExportStatus`/`MarkdownExport` and membership-era types
  (`HubRole`, `MembershipStatus`, `InvitationStatus`, `HubMember`,
  `HubInvitation`, invitation/role-change/ownership-request shapes);
  `HubSummary` now carries `handle` (not `name`); added `CreateExportRequest`
  with `ExportFormat = "markdown" | "pdf" | "docx"`.
- De-normalized links and tags (the "store once, link many" / "shared tag pool"
  normalization stopped paying off in a single-user tool). An external resource
  now stores its own canonical `url` (dedup is a per-collection unique index);
  the `links` table and its module are removed. Tags are a normalized `text[]`
  on the resource and collection, set on create/update — the `tags`,
  `collection_tags`, `resource_tags` tables, the tags module, the tag
  attach/detach endpoints, and orphan-pruning are all removed. Cross-library
  retrieval is deferred to full-text search (Phase E). `@nslinkhub/types`
  updated (resource `url`/`tags`, collection `tags`, `CollectionShareView`
  uses `displayName`).
- Nesting is now a single action on existing collections. Removed `createChild`
  (`POST /collections/:id/children`, create-and-nest) and reparenting via
  `PATCH` (`parentCollectionId` dropped from the update DTO). The one way to
  nest is `POST /collections/:id/collections { collectionId }` — add an existing
  same-hub collection as a section, creating the structural parent link and the
  section entry atomically. Removing the section entry un-nests the collection.
  This eliminates the two-ways-to-nest ambiguity (and the hidden-section bug
  where reparent created a child without an entry). Collections are always
  created top-level.
- Collection-links are now **sections only**, and transfer is **top-level
  only** (resolves review findings #1, #3, #5, #6, #7). Removed the standalone
  "link an arbitrary collection" endpoint (`POST .../resources/collection-link`,
  its DTO, and the shared type): a collection-link exists only as a child
  collection created via `POST /collections/:id/children`, so every
  collection-link is same-hub, access-inherited, and within the two-level cap
  by construction. `POST /collections/:id/transfer` now rejects transferring a
  section — only a top-level collection transfers, moving with its whole
  subtree, so nothing is stranded cross-hub and no inherited access is dropped.
- Collection structure limits. Collection-links must target a collection in the
  same hub (rejecting cross-hub embeds that could re-expose another owner's
  collection). Collections nest at most two levels (a collection and its
  sections): the hierarchy trigger and the create/reparent paths reject
  sub-sections and reject nesting a collection that already has sections. The
  depth-8 hierarchy rule is replaced by this two-level rule.
- Resources simplified to a link, an editable title, and tags. Removed the
  `description` and `note` fields from the resource model, DTOs, `@nslinkhub/types`
  contract, Markdown export, and CSV import — a resource carries no summary;
  clarify a vague link by renaming its title.
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
