# NSLinkHub Implementation Status

## Snapshot

Status date: 2026-03-07

The codebase now contains a working Sprint 1 backend skeleton with real persistence and auth flows for the core modules.

## Completed

### 1. Data and Migrations

- Added initial schema migration:
  - `users`, `repositories`, `links`, `entries`, `tags`, join tables
  - constraints for visibility, entry kind, tag uniqueness links, and hierarchy checks
  - helper functions/triggers (`app_uuid_v7`, `set_updated_at`, hierarchy trigger)
- Added export jobs migration:
  - `export_jobs` table with statuses and indexes

### 2. Entity Layer

Implemented TypeORM entities:

- `UserEntity`
- `RepositoryEntity`
- `LinkEntity`
- `EntryEntity`
- `TagEntity`
- `RepositoryTagEntity`
- `EntryTagEntity`
- `ExportJobEntity`

### 3. App and Infrastructure Wiring

- Config module + TypeORM configured in `AppModule`
- Swagger + global validation pipe in `main.ts`
- Response helper envelope (`{ data, meta? }`)

### 4. Auth and Users

- Register/login/refresh/logout service logic implemented
- Argon2 password hashing
- JWT access/refresh tokens
- Passport JWT strategy
- Auth guard + optional auth guard
- Current-user decorator
- User read/update/delete with owner/admin checks

### 5. Repositories

- Create/list/get/update/delete repository
- Owner/admin write access checks
- Visibility-aware reads (`public`, `private`, `unlisted` with share token)
- Share-link token rotation endpoint (hashed token storage)
- Child repository creation + parent link entry creation
- ETag + Last-Modified set on repository GET
- If-None-Match check for 304 response
- Version conflict checks on update (`version` + `If-Match` parsing)

### 6. Entries

- Create external link entries (link reuse by canonical URL)
- Create repository-link entries
- List entries by repository with visibility checks
- Update/delete entry
- Reorder implementation with strict validation:
  - complete set of IDs
  - no duplicates
  - no unknown IDs
  - contiguous positions
  - version conflict handling

### 7. Tags

- Attach/remove tags to/from repositories
- Attach/remove tags to/from entries
- Tag create-on-demand with normalization

### 8. Imports

- Authenticated import endpoints:
  - CSV
  - browser bookmarks HTML
  - WhatsApp TXT
- Target repository resolution:
  - use existing repository
  - or create new repository
- URL canonicalization and dedupe behavior
- Partial-failure response payload fields
- File size validation (10MB)

### 9. Exports and Queue

- Markdown export from repository entries
- PDF export jobs are now DB-backed and queue-driven:
  - enqueue BullMQ job
  - persist job state in `export_jobs`
  - processor updates `queued -> running -> completed/failed`
- Export job status endpoint reads from DB

## Current Gaps / Limitations

- No migration runner command yet (migrations are SQL files applied manually)
- Some module behavior is still MVP-level and needs hardening:
  - imports: richer CSV parsing/escaping, stronger bookmarks parsing
  - exports: real PDF artifact generation/storage instead of placeholder output ref
- Authorization is implemented in services, but a reusable policy/ability layer is not yet in place
- No full integration/e2e test suite for all new modules yet
- Redis and Postgres health checks are not yet exposed as deep health probes

## Recommended Next Steps

### Priority 1

- Add migration execution command/workflow (TypeORM migrations or a dedicated SQL runner script)
- Implement persistent refresh-token/session revocation strategy
- Replace PDF placeholder with actual render pipeline + object storage upload

### Priority 2

- Harden import parsers:
  - robust CSV parser
  - robust bookmarks parser with folder-tree fidelity
  - WhatsApp parsing heuristics + metadata extraction
- Add rate limit profiles per endpoint class (auth/read/write/import/export)
- Add background cleanup jobs:
  - unused tags
  - expired export artifacts/job retention

### Priority 3

- Add full e2e suite covering:
  - auth flows
  - visibility/share token behavior
  - reorder conflict cases
  - import/export happy and failure paths
- Add structured error code catalog and global exception filter normalization
- Add caching improvements:
  - broaden ETag coverage across list/detail endpoints
  - optional If-Modified-Since compatibility checks where needed

## Quick Run Checklist

1. Configure `.env` (DB/Redis/JWT)
2. Apply SQL migrations in order
3. `npm install`
4. `npm run start:dev`
5. Open Swagger at `/api/docs`
