# ARCHITECTURE

## 1. System Purpose

NSLinkHub is a backend API for organizing and sharing curated link repositories. It supports user accounts, nested repositories, link entries, tagging, import pipelines, and asynchronous export jobs.

## 2. Technology Stack

- Language: TypeScript
- Framework: NestJS
- API transport: HTTP (Nest controllers)
- ORM/data access: TypeORM
- Database: PostgreSQL
- Queue/async processing: BullMQ
- Queue backend: Redis
- Auth: JWT + Passport
- Password hashing: Argon2
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
  - TypeORM entities in `src/modules/**/entities`
  - SQL migrations in `src/database/migrations`
- Infrastructure Layer:
  - App/bootstrap config in `src/main.ts` and `src/app.module.ts`
  - Auth strategy/guards in `src/modules/auth` + `src/common/guards`
  - Queue processor for export jobs in `src/modules/exports/exports.processor.ts`

## 4. Key Modules

- `auth`:
  - registration/login/refresh/logout
  - JWT token issuing and strategy validation
- `users`:
  - user retrieval, updates, deletion with ownership/admin checks
- `repositories`:
  - repository CRUD, visibility enforcement, share-token handling, child repository creation
- `entries`:
  - external-link and repository-link entries
  - entry list/update/delete/reorder
- `tags`:
  - attach/remove tags for repositories and entries
- `imports`:
  - CSV, bookmarks HTML, and WhatsApp TXT ingestion into repository entries
- `exports`:
  - markdown export generation
  - PDF export job enqueueing + status tracking (`export_jobs` + BullMQ)
- `health`:
  - basic health/status endpoints

## 5. Directory Map

- `src/modules/` — domain modules (controllers/services/entities/dto)
- `src/common/` — shared guards, decorators, enums, utilities, interfaces
- `src/database/migrations/` — SQL schema evolution scripts
- `src/database/data-source.ts` — TypeORM data-source definition
- `docs/` — project spec and session handoff docs
- `.codex/` — AI session workflow and restart instructions

## 6. Data Flow Overview

Typical request flow:
1. Request hits controller endpoint (`/api/v2/*`).
2. DTO validation/transformation runs via global `ValidationPipe`.
3. Guard/auth strategy may authenticate and attach current user context.
4. Service executes business logic and access checks.
5. Service reads/writes entities via TypeORM repositories.
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
