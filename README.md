# NSLinkHub API (NestJS v2)

NSLinkHub is a link-organization API for creating and sharing curated repositories of resources.

This repository is a greenfield NestJS v2 rewrite. The old Flask v1 is retained for historical record only.

## Working In This Repository

Start with `AGENTS.md` — the contributor/agent map: reading order, toolchain
rules, non-negotiable invariants, and documentation conventions (ExecPlans in
`docs/exec-plans/`, disposable context in git-ignored `ref/`, completed work
in `CHANGELOG.md`).

## Current Documentation

- Hub architecture plan (authoritative target design): `docs/hub-architecture-upgrade-plan.md`
- ns-series identity direction: `docs/identity-sso-direction.md`
- ns-series deployment direction: `docs/infra-deployment-direction.md`
- Product spec (historical background): `docs/nestjs-v2-feature-spec.md`
- Stack migration log (Bun + Prisma + better-auth): `docs/exec-plans/completed/stack-migration-bun-prisma-better-auth.md`

## Implemented So Far

- PostgreSQL schema managed by Prisma Migrate (single `0_init` baseline)
- Prisma models for users/repositories/links/entries/tags/export_jobs + better-auth tables
- Auth via self-hosted [better-auth](https://better-auth.com) (email/username sign-in,
  DB-backed sessions, bearer tokens for API clients, argon2id hashing via `Bun.password`)
- Repository CRUD, visibility checks, share-link rotation, nested child creation
- Entries CRUD + reorder with validation and version conflict checks
- Tag attach/remove for repositories and entries
- Import endpoints (CSV, bookmarks HTML, WhatsApp TXT) with initial parsing + persistence
- Markdown export and PDF export queue jobs
- Queue-backed + DB-backed export jobs (BullMQ + Redis + `export_jobs` table)
- Swagger setup at `/api/docs`

## Tech Stack

- Bun (package manager **and** runtime)
- NestJS
- PostgreSQL + Prisma (with `@prisma/adapter-pg`)
- better-auth (sessions, bearer plugin, username plugin)
- BullMQ + Redis
- class-validator/class-transformer

## Prerequisites

- Bun 1.3+
- Docker (or local PostgreSQL + Redis)

## Environment Variables

Recommended `.env` values:

```bash
PORT=3000

DATABASE_URL=postgresql://postgres:postgres@127.0.0.1:5432/nslinkhub

BETTER_AUTH_SECRET=change-me-to-a-long-random-string
BETTER_AUTH_URL=http://localhost:3000

REDIS_HOST=127.0.0.1
REDIS_PORT=6379
# REDIS_PASSWORD=
```

When `DATABASE_URL` is unset, the local dev default
(`postgresql://postgres:postgres@127.0.0.1:5432/nslinkhub`) is used.

## Install

```bash
bun install   # also runs `prisma generate` (postinstall)
```

## Local services

```bash
docker compose up -d   # PostgreSQL 18 + Redis 7
```

## Migrations

Migrations are managed by Prisma Migrate in `prisma/migrations`:

```bash
bunx prisma migrate deploy
```

To evolve the schema, edit `prisma/schema.prisma` and use
`bunx prisma migrate dev --create-only`, then review the generated SQL —
several database objects (the `app_uuid_v7()` function, `set_updated_at`
triggers, the repository-hierarchy trigger, CHECK constraints, and the partial
unique index on entries) exist only in migration SQL and must never be dropped
by an auto-generated diff.

## Run

```bash
# dev (watch)
bun run start:dev

# build + prod
bun run build
bun run start:prod

# tests
bun test src    # unit
bun test test   # e2e (needs PostgreSQL + Redis running)
```

## Auth

Auth endpoints are served by better-auth under `/api/v1/auth/*`. The main ones:

- `POST /api/v1/auth/sign-up/email` — `{ email, password, name, username }`
- `POST /api/v1/auth/sign-in/email` — `{ email, password }`
- `POST /api/v1/auth/sign-in/username` — `{ username, password }`
- `POST /api/v1/auth/sign-out`
- `GET  /api/v1/auth/get-session`

Browser clients get an HttpOnly session cookie. API clients read the session
token from the `set-auth-token` response header on sign-in and send it as
`Authorization: Bearer <token>` (better-auth bearer plugin). Sessions are
DB-backed and refresh themselves server-side.

## API Docs

When server is running:

- Swagger UI: `http://localhost:3000/api/docs`

## Notes

- PDF generation is queue-driven and currently stores an output reference placeholder.
- Import parsers are MVP-level and intended for hardening in next iterations.
