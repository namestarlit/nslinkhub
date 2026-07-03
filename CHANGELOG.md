# Changelog

All notable project changes are recorded here for humans and agents. Follow
the spirit of [Keep a Changelog](https://keepachangelog.com/en/1.1.0/) and use
Conventional Commit categories when preparing commits.

This file is not a replacement for design docs or ExecPlans. It is the durable
summary of what changed after completed work has been promoted out of `ref/`.

## Unreleased

### Changed

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
