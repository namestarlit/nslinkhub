# NSLinkHub API (NestJS v2)

NSLinkHub is a link-organization API for creating and sharing curated repositories of resources.

This repository is a greenfield NestJS v2 rewrite. The old Flask v1 is retained for historical record only.

## Current Documentation

- Product + architecture spec: `docs/nestjs-v2-feature-spec.md`
- Implementation status + next steps: `docs/implementation-status.md`

## Implemented So Far

- PostgreSQL schema migrations for Sprint 1 core entities
- TypeORM entities for users/repositories/links/entries/tags/export_jobs
- Auth (register/login/refresh/logout) with JWT and Argon2
- Repository CRUD, visibility checks, share-link rotation, nested child creation
- Entries CRUD + reorder with validation and version conflict checks
- Tag attach/remove for repositories and entries
- Import endpoints (CSV, bookmarks HTML, WhatsApp TXT) with initial parsing + persistence
- Markdown export and PDF export queue jobs
- Queue-backed + DB-backed export jobs (BullMQ + Redis + `export_jobs` table)
- Swagger setup at `/api/docs`

## Tech Stack

- NestJS
- PostgreSQL + TypeORM
- BullMQ + Redis
- JWT + Passport
- class-validator/class-transformer

## Prerequisites

- Node.js 22+
- PostgreSQL
- Redis

## Environment Variables

Recommended `.env` values:

```bash
PORT=3000

DB_HOST=127.0.0.1
DB_PORT=5432
DB_USER=postgres
DB_PASSWORD=postgres
DB_NAME=nslinkhub

JWT_ACCESS_SECRET=dev-access-secret
JWT_ACCESS_TTL=15m
JWT_REFRESH_SECRET=dev-refresh-secret
JWT_REFRESH_TTL=7d

REDIS_HOST=127.0.0.1
REDIS_PORT=6379
# REDIS_PASSWORD=
```

## Install

```bash
npm install
```

## Migrations

SQL migrations are in `src/database/migrations`:

- `0001_sprint1_schema.sql`
- `0002_export_jobs.sql`

Run them in order against your PostgreSQL DB (example with `psql`):

```bash
psql "$DATABASE_URL" -f src/database/migrations/0001_sprint1_schema.sql
psql "$DATABASE_URL" -f src/database/migrations/0002_export_jobs.sql
```

## Run

```bash
# dev
npm run start:dev

# build
npm run build

# tests
npm run test -- --watchman=false
```

## API Docs

When server is running:

- Swagger UI: `http://localhost:3000/api/docs`

## Notes

- PDF generation is queue-driven and currently stores an output reference placeholder.
- Import parsers are MVP-level and intended for hardening in next iterations.
