# Reliability

## Idempotency

- Background jobs are idempotent; consumers assume at-least-once delivery.
- URL capture deduplicates by canonical URL hash, so repeated captures of the
  same resource converge instead of duplicating.

## Concurrency

- Collection and resource updates use version checks (optimistic
  concurrency); stale writes fail with `409` rather than overwriting.
- Reorder writes use the two-pass temporary-offset transaction to respect the
  unique `(collection, position)` constraint without transient conflicts.

## Jobs And Queues

- Current state: nothing queues. Exports are synchronous (programmatic
  renderers, file in the response); BullMQ/Redis stay in the stack for the
  future email/notification path.
- Target state (hub design doc, deferred list): PostgreSQL transactional
  outbox relayed to BullMQ, with queue consumers in separate worker
  processes. PostgreSQL stays authoritative; Redis dispatches and is never
  the source of truth.
- Queue Redis (when production-shaped) runs with AOF persistence and
  `noeviction`, and is never reused as a cache.

## Data

- PostgreSQL 18 is the single source of truth. `timestamptz` UTC everywhere;
  `created_at` is the authoritative audit timestamp (never inferred from
  UUIDv7 values).
- Schema changes go through reviewed Prisma migrations
  (`docs/runbooks/migrations.md`); database objects that Prisma cannot model
  live in migration SQL and must never be dropped by an auto-generated diff.
- Production databases get off-host backups with tested restores before
  launch (`docs/design-docs/infra-deployment.md`).

## Observability (target state)

- Structured logs with server-generated request IDs; the stable error
  envelope carries the request ID to users. Centralized
  log/metric/trace shipping is tracked in the tech-debt tracker and lands
  before first production release.
