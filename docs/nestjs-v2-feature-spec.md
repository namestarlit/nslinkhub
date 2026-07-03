# NSLinkHub NestJS v2 Feature Specification (Greenfield Rewrite)

## 1. Product Vision

NSLinkHub is a link organization API for building and sharing curated guides.

Core value:
- Package many related links (with commentary) into one repository.
- Share one stable LinkHub URL instead of sending many individual links.
- Keep updating the repository over time so shared links always show latest content.
- Export repository content to Markdown/PDF for offline and broad sharing.

This v2 is a fresh implementation. `v1` is record-keeping only.

## 2. Sprint 1 Goals

- Build the core API for users, repositories, reusable links, and repository-specific resource entries.
- Support visibility and sharing modes (`public`, `unlisted`, `private`).
- Support hierarchical repositories (repository-in-repository organization).
- Add export to Markdown (and async PDF generation path).
- Add imports from CSV, browser bookmarks HTML, and WhatsApp `.txt`.
- Use PostgreSQL with UUIDv7 defaults where available.
- Normalize tags to lowercase.
- Use strong conditional caching with ETag as primary.
- Move unused-tag cleanup to scheduled background maintenance.

## 3. Technical Stack

- Framework: NestJS (TypeScript)
- Database: PostgreSQL
- ORM: TypeORM
- Validation: `class-validator` + `class-transformer`
- Auth: JWT (access + refresh)
- Docs: OpenAPI/Swagger (`@nestjs/swagger`)
- Rate limiting: `@nestjs/throttler`
- Scheduling/background jobs: `@nestjs/schedule`
- Optional queue for heavy tasks: BullMQ + Redis

## 4. Architecture Modules

- `AuthModule`
- `UsersModule`
- `RepositoriesModule`
- `LinksModule`
- `EntriesModule`
- `TagsModule`
- `SharingModule`
- `ImportModule`
- `ExportModule`
- `MaintenanceModule`
- `HealthModule`
- `CommonModule` (guards, filters, interceptors, utils)

## 5. Data Model

All primary models include:
- `created_at` (`timestamptz`, default now)
- `updated_at` (`timestamptz`, auto-updated)

### 5.1 User
- `id` (`uuid`, UUIDv7)
- `username` (unique, `^[a-z0-9_]+$`)
- `email` (unique, normalized lowercase)
- `password_hash`
- `bio` (nullable)
- `role` (`user` | `admin`)
- `created_at`, `updated_at`

### 5.2 Repository
- `id` (`uuid`, UUIDv7)
- `owner_id` (FK -> users.id)
- `slug` (owner-unique URL-safe identifier)
- `title`
- `description` (nullable)
- `visibility` (`public` | `unlisted` | `private`)
- `share_token_hash` (nullable; required for unlisted, store hash only)
- `parent_repository_id` (nullable FK -> repositories.id, `ON DELETE CASCADE`)
- `version` (`bigint`, optimistic concurrency token)
- `created_at`, `updated_at`

Constraints and rules:
- unique `(owner_id, slug)`
- index `(visibility, updated_at desc)`
- index `(parent_repository_id)`
- check: `visibility = unlisted` => `share_token_hash is not null`
- cycle prevention: parent assignment must not create cycles
- maximum hierarchy depth: 8
- parent delete behavior: cascade full subtree delete (no reparenting in Sprint 1)
- token lifecycle rule: `share_token_hash` may exist while visibility is `private` or `public` (pre-minted/rotated), but is required when visibility is `unlisted`

### 5.3 Link (Reusable URL Identity)
- `id` (`uuid`, UUIDv7)
- `canonical_url` (normalized absolute URL)
- `url_hash` (sha256 for fast unique checks)
- `created_at`, `updated_at`

Constraints:
- unique `(canonical_url)`
- unique `(url_hash)`

Purpose:
- Link is reusable across many repositories/users.
- Link row has no user-specific description/tags/notes.

### 5.4 Resource Entry (Repository-Specific Metadata)
- `id` (`uuid`, UUIDv7)
- `repository_id` (FK -> repositories.id, `ON DELETE CASCADE`)
- `link_id` (nullable FK -> links.id)
- `kind` (`external_link` | `repository_link`)
- `linked_repository_id` (nullable FK -> repositories.id, `ON DELETE CASCADE`, for `repository_link`)
- `title_override` (nullable)
- `description` (nullable)
- `note` (nullable markdown)
- `position` (int)
- `version` (`bigint`, optimistic concurrency token)
- `created_at`, `updated_at`

Constraints:
- check: `kind = external_link` => `link_id is not null` and `linked_repository_id is null`
- check: `kind = repository_link` => `linked_repository_id is not null` and `link_id is null`
- unique `(repository_id, position)`
- unique `(repository_id, link_id)` where `link_id is not null`
- index `(repository_id, updated_at desc)`

Behavior:
- Editing one entry does not affect other entries using same link.
- Deleting one entry does not delete the shared link if referenced elsewhere.

### 5.5 Tag
- `id` (`uuid`, UUIDv7)
- `name` (unique, lowercase only)
- `created_at`, `updated_at`

Rule:
- On write: trim + lowercase + collapse internal whitespace.

### 5.6 Join Tables
- `repository_tags(repository_id, tag_id)`
- `entry_tags(entry_id, tag_id)`

Join table constraints:
- `repository_tags` primary key `(repository_id, tag_id)`
- `entry_tags` primary key `(entry_id, tag_id)`

## 6. UUIDv7 Strategy

Primary plan:
- PostgreSQL with native `uuidv7()` defaults.

Fallback plan (if hosting does not support native `uuidv7()`):
- Generate UUIDv7 in application layer using a standards-compliant library.
- Keep DB column type as `uuid`.
- Keep identical API contract and migration files except default expression.

Deployment requirement:
- CI must run a startup check and log whether DB-native or app-generated UUIDv7 mode is active.

## 7. Authorization, Visibility, and Sharing

Visibility rules:
- `public`: listed and readable without auth.
- `unlisted`: not listed; readable only via valid share token link.
- `private`: owner/admin only.

Unlisted token rules:
- Token passed in query param `?s=<token>` for browser/share friendliness.
- Token can optionally be sent via `X-Share-Token` header for API clients.
- Stored as hash; raw token shown only once at creation/rotation.
- Rotation immediately invalidates prior token.

Leak prevention:
- Child listing must apply visibility checks per child.
- Never infer visibility from parent; always evaluate each node independently.
- Mixed trees must not leak private or unlisted children in public endpoints.

## 8. API Contract (v2)

Base path: `/api/v1`

### Auth
- `POST /auth/register`
- `POST /auth/login`
- `POST /auth/refresh`
- `POST /auth/logout`

### Users
- `GET /users/:username`
- `PATCH /users/:username` (owner/admin)
- `DELETE /users/:username` (owner/admin)

### Repositories
- `POST /repositories` (auth)
- `GET /repositories/public` (paginated)
- `GET /users/:username/repositories/:slug` (visibility-aware; moved out of `/repositories` so it cannot shadow `/repositories/:id/*` routes)
- `PATCH /repositories/:id` (owner/admin, optimistic lock)
- `DELETE /repositories/:id` (owner/admin)
- `POST /repositories/:id/share-link` (owner/admin; create/rotate unlisted token)
- `POST /repositories/:id/children` (owner/admin)
- `GET /repositories/:id/children` (visibility-aware)

### Entries and Links
- `POST /repositories/:id/entries/external` (owner/admin; creates/reuses Link + creates entry)
- `POST /repositories/:id/entries/repository-link` (owner/admin; links child repository as entry)
- `GET /repositories/:id/entries` (visibility-aware)
- `PATCH /repositories/:id/entries/:entryId` (owner/admin, optimistic lock)
- `DELETE /repositories/:id/entries/:entryId` (owner/admin)
- `PATCH /repositories/:id/entries/reorder` (owner/admin, optimistic lock)

### Tags
- `POST /repositories/:id/tags` (owner/admin)
- `DELETE /repositories/:id/tags/:tagName` (owner/admin)
- `POST /entries/:entryId/tags` (owner/admin)
- `DELETE /entries/:entryId/tags/:tagName` (owner/admin)

### Export
- `POST /repositories/:id/export/markdown`
- `POST /repositories/:id/export/pdf` (async)
- `GET /exports/jobs/:jobId`

### Import
- `POST /imports/csv` (auth)
- `POST /imports/bookmarks-html` (auth)
- `POST /imports/whatsapp-txt` (auth)

### System
- `GET /health`
- `GET /status`

## 9. Concurrency and Reorder Semantics

Model:
- Optimistic concurrency on repositories and entries using `version`.
- Mutating requests include `If-Match` ETag or explicit `version`.

Conflict behavior:
- Version mismatch returns `409 CONFLICT`.

Reorder validation:
- Payload must include a complete set of current entry IDs.
- No duplicates.
- No unknown IDs.
- Positions must be contiguous `0..n-1`.
- Invalid payload returns `400`.

Conflict resolution:
- No last-write-wins for reorder; stale clients must refetch and retry.

## 10. Caching and Conditional Requests

Primary mechanism:
- `ETag` and `If-None-Match`.

Secondary compatibility:
- `Last-Modified` and `If-Modified-Since` supported for clients that need it.

Rules:
- ETag computed from canonical response shape + current version hash.
- If `If-None-Match` matches, return `304`.
- If both validators are present, ETag takes precedence.
- Server timestamps are UTC and RFC 1123 formatted.
- Compare timestamps at second precision and treat client skew conservatively.

## 11. Import and Export Behavior

### 11.1 Browser bookmarks HTML mapping
- Parse folder tree.
- Each folder becomes a repository.
- Each subfolder becomes child repository (`parent_repository_id` set).
- Each child repository is also added to parent as `repository_link` entry.
- Bookmark URL becomes external entry in folder repository.

### 11.2 WhatsApp `.txt` import
- UTF-8 default; fallback to Latin-1 with explicit warning in report.
- Extract valid HTTP/HTTPS URLs.
- Optional local context text becomes `title_override`/`description`.

### 11.3 CSV import
- Required column: `url`.
- Optional: `title`, `description`, `note`, `tags`.
- Sanitize exported CSV cells to prevent spreadsheet formula injection by prefixing `'` when cell begins with `=`, `+`, `-`, `@`.

### 11.4 Import hardening
- Max upload size: 10 MB per file (Sprint 1 default).
- Reject unsupported mime/content types with `415`.
- Malformed input returns partial-failure report where possible.
- Duplicate detection uses canonical URL.
- Canonicalization rules:
  - lowercase scheme/host
  - remove default ports
  - normalize trailing slash on empty path
  - sort query params
  - strip known tracking params (`utm_*`, `fbclid`, `gclid`)

### 11.5 Partial-failure response contract
- `total_rows`
- `processed_rows`
- `imported_count`
- `skipped_count`
- `error_count`
- `errors[]` with row index, reason, and raw value snippet

## 12. Background Maintenance and Operations

Scheduled tasks:
- Unused tag cleanup every 6 hours.
- Async export job retention cleanup daily.

Async export job retention:
- Keep job metadata for 14 days.
- Keep generated files for 7 days (configurable).
- Expired artifacts removed automatically.

Rate limits:
- Auth endpoints: strict (example `10/min/ip`).
- Standard read endpoints: moderate (example `120/min/ip`).
- Mutations: moderate-low (example `60/min/ip`).
- Import/export job creation: strict (example `10/hour/user`).

Repository deletion behavior:
- Deleting a repository deletes its subtree.
- `repository_link` entries in parents that point to deleted nodes are deleted by FK cascade.
- External links are not deleted globally; only entry rows are removed.

## 13. Non-Functional Requirements

- Security:
  - Argon2 preferred for password hashing (bcrypt acceptable fallback)
  - short-lived access tokens + rotated refresh tokens
- Reliability:
  - transactional writes for multi-step operations
- Performance:
  - paginated defaults (`limit=20`, max `100`)
  - indexes on visibility, owner, parent, and updated fields
- Observability:
  - request-id structured logs
  - import/export metrics and failure logs

## 14. Sprint 1 Delivery Plan

### Phase A: Foundation
- Setup NestJS modules, PostgreSQL connection, migrations.
- Implement repository hierarchy, Link + Entry split, and UUIDv7 mode detection (DB-native vs app fallback).

### Phase B: Core CRUD + visibility
- Auth and user profile endpoints.
- Repository, entry, and tag CRUD.
- Public/unlisted/private access controls.
- Share token creation and rotation.

### Phase C: Import/export MVP
- Markdown export.
- Async PDF export job + status endpoint.
- CSV/bookmarks/WhatsApp imports with partial-failure reporting.

### Phase D: Caching + operations
- ETag/If-None-Match on read endpoints.
- Secondary Last-Modified/If-Modified-Since support.
- Scheduled cleanup jobs (unused tags and expired export artifacts).

### Phase E: Quality gates
- Unit tests for import parsers and visibility logic.
- E2E tests for token access and mixed-visibility trees.
- E2E tests for optimistic concurrency and reorder conflicts.

## 15. Decisions Locked for Sprint 1

- Greenfield rewrite; no `v1` compatibility constraints.
- PostgreSQL as source of truth.
- UUIDv7 IDs across primary entities.
- DB-native UUIDv7 preferred, app-layer UUIDv7 fallback allowed.
- `created_at` and `updated_at` on primary tables.
- Tags normalized to lowercase.
- Nested repositories and repository-link entries are first-class.
- ETag as primary cache validator.
- `If-Modified-Since` kept as secondary compatibility mechanism.
