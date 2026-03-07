# PROJECT_STATE

## Project Purpose

NSLinkHub is a NestJS backend API for organizing, tagging, importing, and sharing curated link repositories (including nested repositories), with async export workflows.

## Technology Stack

- NestJS (TypeScript)
- TypeORM
- PostgreSQL
- BullMQ + Redis
- JWT + Passport
- Argon2
- class-validator / class-transformer
- Swagger/OpenAPI

## Major Architectural Components

- API modules: `auth`, `users`, `repositories`, `entries`, `tags`, `imports`, `exports`, `health`
- Shared layer: guards, decorators, DTOs, enums, response/etag utilities
- Persistence layer: SQL migrations + TypeORM entities
- Async processing: export queue processor (`exports` queue) with DB-backed job records

For detailed structure and flow, read `ARCHITECTURE.md`.

## Important Directories

- `src/modules/` — domain modules (controllers/services/entities/dto)
- `src/common/` — shared guards/decorators/utils/interfaces
- `src/database/migrations/` — SQL migrations (`0001`, `0002`)
- `docs/` — product spec and session handoff docs
- `.codex/` — AI session workflow instructions

## Current Development Stage

Sprint 1 backend foundation is implemented with real service logic for major modules and queue + DB-backed export jobs. Recent correctness hardening addressed reorder consistency (per-entry versions + uniqueness-safe transactional updates), repository parent validation on update, shared URL canonicalization reuse, and authenticated logout routing. Remaining work is production hardening (real PDF artifact generation, migration workflow automation, parser robustness, broader test coverage).
