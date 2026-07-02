# ARCHITECTURE

## 1. System Purpose

NSLinkHub is a backend API for organizing and sharing curated link repositories. It supports user accounts, nested repositories, link entries, tagging, import pipelines, and asynchronous export jobs.

## 2. Technology Stack

- Language: TypeScript
- Framework: NestJS
- API transport: HTTP (Nest controllers)
- Runtime/package manager: Bun
- ORM/data access: Prisma (`@prisma/adapter-pg` driver adapter)
- Database: PostgreSQL
- Queue/async processing: BullMQ
- Queue backend: Redis
- Auth: better-auth (self-hosted; DB sessions, bearer + username plugins)
- Password hashing: argon2id via `Bun.password`
- Validation: class-validator + class-transformer
- API docs: Swagger (`/api/docs`)

## 3. High-Level Architecture

- API Layer:
  - Nest controllers under `src/modules/*/*.controller.ts`
  - DTO validation on request input
- Service Layer:
  - Business logic in `*.service.ts`
  - Access checks and workflow orchestration
- Persistence Layer:
  - Prisma schema in `prisma/schema.prisma` (generated client in `src/generated/prisma`)
  - Prisma migrations in `prisma/migrations`
- Infrastructure Layer:
  - App/bootstrap config in `src/main.ts` and `src/app.module.ts`
  - better-auth instance in `src/auth/auth.ts` (handler mounted in `src/main.ts`); guards in `src/common/guards`
  - Queue processor for export jobs in `src/modules/exports/exports.processor.ts`

## 4. Key Modules

- `auth` (better-auth, mounted at `/api/v2/auth/*`):
  - sign-up/sign-in (email + username), sign-out, get-session; bearer tokens for API clients
  - JWT token issuing and strategy validation
- `users`:
  - user retrieval, updates, deletion with ownership/admin checks
- `repositories`:
  - repository CRUD, visibility enforcement, share-token handling, child repository creation
- `entries`:
  - external-link and repository-link entries
  - entry list/update/delete/reorder
  - reorder uses per-entry optimistic version checks
- `tags`:
  - attach/remove tags for repositories and entries
- `imports`:
  - CSV, bookmarks HTML, and WhatsApp TXT ingestion into repository entries
  - shared URL canonicalization utility used for dedupe parity with entries
- `exports`:
  - markdown export generation
  - PDF export job enqueueing + status tracking (`export_jobs` + BullMQ)
- `health`:
  - basic health/status endpoints

## 5. Directory Map

- `src/modules/` — domain modules (controllers/services/dto)
- `src/common/` — shared guards, decorators, enums, utilities, interfaces
- `src/auth/` — better-auth instance/config
- `src/database/` — `PrismaModule`/`PrismaService`
- `prisma/` — Prisma schema, config, and migrations
- `src/generated/prisma/` — generated Prisma client (gitignored; `bun install` regenerates)
- `docs/` — project spec and session handoff docs
- `.codex/` — AI session workflow and restart instructions

## 6. Data Flow Overview

Typical request flow:
1. Request hits controller endpoint (`/api/v2/*`).
2. DTO validation/transformation runs via global `ValidationPipe`.
3. Guard/auth strategy may authenticate and attach current user context.
4. Service executes business logic and access checks.
5. Service reads/writes rows via the Prisma client (`PrismaService`).
6. Response is returned in a consistent envelope (`{ data, meta? }`).

Async export flow:
1. Client requests PDF export.
2. Service creates `export_jobs` row and enqueues BullMQ job.
3. Processor consumes queue job, updates status (`queued -> running -> completed|failed`).
4. Client polls export job status endpoint.

## 7. External Integrations

- PostgreSQL (primary persistence)
- Redis (BullMQ queue backend)

No third-party HTTP APIs are currently integrated.

## 8. Architectural Constraints

- SQL migrations are source-of-truth for schema changes; `synchronize` is disabled.
- UUID strategy and DB functions are defined in migrations (including app UUID helper).
- Visibility rules (`public`/`unlisted`/`private`) and ownership checks are enforced in services.
- Queue-backed export jobs must persist status in DB (`export_jobs`), not in-memory state.
- Keep module boundaries explicit (controller -> service -> repository/entity).
