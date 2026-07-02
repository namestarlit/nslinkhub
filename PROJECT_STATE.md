# PROJECT_STATE

## Project Purpose

NSLinkHub is a NestJS backend API for organizing, tagging, importing, and sharing curated link repositories (including nested repositories), with async export workflows.

## Technology Stack

- Bun (runtime + package manager)
- NestJS (TypeScript)
- Prisma
- PostgreSQL
- BullMQ + Redis
- better-auth
- argon2id via `Bun.password`
- class-validator / class-transformer
- Swagger/OpenAPI

## Major Architectural Components

- API modules: `auth`, `users`, `repositories`, `entries`, `tags`, `imports`, `exports`, `health`
- Shared layer: guards, decorators, DTOs, enums, response/etag utilities
- Persistence layer: Prisma schema + migrations (`prisma/`)
- Async processing: export queue processor (`exports` queue) with DB-backed job records

For detailed structure and flow, read `ARCHITECTURE.md`.

## Important Directories

- `src/modules/` — domain modules (controllers/services/dto)
- `src/common/` — shared guards/decorators/utils/interfaces
- `src/database/migrations/` — SQL migrations (`0001`, `0002`)
- `docs/` — product spec and session handoff docs
- `.codex/` — AI session workflow instructions

## Current Development Stage

Sprint 1 backend foundation is implemented with real service logic for major modules and queue + DB-backed export jobs. Recent correctness hardening addressed reorder consistency (per-entry versions + uniqueness-safe transactional updates), repository parent validation on update, shared URL canonicalization reuse, and authenticated logout routing. Remaining work is production hardening (real PDF artifact generation, migration workflow automation, parser robustness, broader test coverage).
