# Changelog

All notable project changes are recorded here for humans and agents. Follow
the spirit of [Keep a Changelog](https://keepachangelog.com/en/1.1.0/) and use
Conventional Commit categories when preparing commits.

This file is not a replacement for design docs or ExecPlans. It is the durable
summary of what changed after completed work has been promoted out of `ref/`.

## Unreleased

### Changed

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
