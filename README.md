# NSLinkHub API (NestJS v2)

NSLinkHub is a link-organization API for creating and sharing curated repositories of resources.

This repository is a greenfield NestJS v2 rewrite. The old Flask v1 is retained for historical record only.

## Working In This Repository

- **New here?** Walk `docs/guides/developer-onboarding-walkthrough.md` — six
  hands-on sessions from zero to ready-to-build (commit-pinned; freshness is
  enforced by `bun run verify`).
- Then `AGENTS.md` — the contributor/agent map: reading order, toolchain
  rules, non-negotiable invariants, and documentation conventions (ExecPlans
  in `docs/exec-plans/`, disposable context in git-ignored `ref/`, completed
  work in `CHANGELOG.md`).

## Current Documentation

- Product definition: `PRODUCT.md`
- Authoritative system design (Drive individual model): `docs/SYSTEM_DESIGN.md`
- Onboarding walkthrough: `docs/guides/developer-onboarding-walkthrough.md`
- ns-series identity direction: `docs/design-docs/identity-sso.md`
- ns-series deployment direction: `docs/design-docs/infra-deployment.md`

## Implemented So Far

- **The entire backend** (tracks W1→A→B→C→D→W2 + the Drive-model reshape):
  one hub per user, collections with two-level nesting (one nest action),
  external resources with canonical URLs + tags, collection-level sharing
  (link/direct/publish with downward inheritance), top-level ownership
  transfer, saves, explore, id permalinks + handle resolution
- Auth via self-hosted [better-auth](https://better-auth.com) (email +
  password, DB-backed sessions, bearer tokens for API clients, argon2id via
  `Bun.password`); one personal hub auto-created at sign-up
- Synchronous export (Markdown/PDF/Word; multi-collection, zipped) and
  imports (bookmarks-HTML + universal CSV with per-row error reports)
- `@nslinkhub/types` (wire contracts) and `@nslinkhub/email` (code-email
  templates); liveness + per-dependency readiness endpoints; `_FILE`
  deployment-secret contract with zero-config dev
- Swagger at `/api/docs`; remaining tracks: W3 (web), W4 (extension)

## Tech Stack

- Bun (package manager **and** runtime)
- NestJS
- PostgreSQL + Prisma (with `@prisma/adapter-pg`)
- better-auth (sessions, bearer plugin; no username — identity is a hub handle)
- BullMQ + Redis
- class-validator/class-transformer

## Prerequisites

- Bun 1.3+
- Docker (or local PostgreSQL + Redis)

## Environment Variables

Recommended `.env` values:

```bash
# API port; 3000 belongs to the web app (Next.js dev default).
PORT=4000

DATABASE_URL=postgresql://postgres:postgres@127.0.0.1:5436/nslinkhub

BETTER_AUTH_SECRET=change-me-to-a-long-random-string
BETTER_AUTH_URL=http://localhost:4000

# Queue Redis (future email/notification delivery; checked by /status)
REDIS_URL=redis://127.0.0.1:6383
```

When `DATABASE_URL` or `REDIS_URL` is unset, the local dev defaults
(`postgresql://postgres:postgres@127.0.0.1:5436/nslinkhub`,
`redis://127.0.0.1:6383`) are used.

Deployment secrets use the `_FILE` contract: `DATABASE_URL_FILE`,
`BETTER_AUTH_SECRET_FILE`, and `REDIS_URL_FILE` point at secret files
(docker/swarm secrets) and take precedence over the plain variables.

## Install

```bash
bun install   # also runs `prisma generate` (postinstall)
```

## Local services

```bash
bun run infra:up       # PostgreSQL 18 + Redis 7 (docker compose up -d)
bun run infra:down     # stop them
```

## Repository Layout

Bun workspace: the backend is `apps/api` (`@nslinkhub/api`); shared tooling
config lives in `packages/config`. Root scripts delegate, so everything below
runs from the repository root.

## Migrations

Migrations are managed by Prisma Migrate in `apps/api/prisma/migrations`
(Prisma commands run from `apps/api`, where `prisma.config.ts` lives):

```bash
cd apps/api && bunx prisma migrate deploy
```

To evolve the schema, edit `apps/api/prisma/schema.prisma` and use
`bunx prisma migrate dev --create-only`, then review the generated SQL —
several database objects (the `app_uuid_v7()` function, `set_updated_at`
triggers, the collection-hierarchy trigger, CHECK constraints, and partial
unique indexes) exist only in migration SQL and must never be dropped by an
auto-generated diff.

## Run

```bash
# daily driver (script convention: <service>:<action>; dev = orchestrator)
bun run dev        # infra up (idempotent) + API watch (:4000); web joins at W3
bun run api:dev    # the same, single service

# build + prod
bun run api:build
bun run api:prod

# tests
bun run api:test       # API unit + e2e (e2e needs services running)
bun run email:test     # email template tests
```

## Auth

Auth endpoints are served by better-auth under `/api/v1/auth/*`. The main ones:

- `POST /api/v1/auth/sign-up/email` — `{ email, password, name }`
- `POST /api/v1/auth/sign-in/email` — `{ email, password }`
- `POST /api/v1/auth/sign-out`
- `GET  /api/v1/auth/get-session`

Browser clients get an HttpOnly session cookie. API clients read the session
token from the `set-auth-token` response header on sign-in and send it as
`Authorization: Bearer <token>` (better-auth bearer plugin). Sessions are
DB-backed and refresh themselves server-side.

## API Docs

When server is running:

- Swagger UI: `http://localhost:4000/api/docs`

## Notes

- Exports are synchronous — the response body is the file (zip when several
  collections are selected); no queue, nothing stored server-side.
- Import parsers are MVP-level and intended for hardening in next iterations.
