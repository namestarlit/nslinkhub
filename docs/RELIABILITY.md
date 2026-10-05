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

- Email uses an encrypted PostgreSQL transactional outbox relayed to BullMQ,
  with delivery in a separate worker process. PostgreSQL stays authoritative;
  Redis dispatches opaque outbox IDs and is never the source of truth.
- Exports are synchronous (programmatic renderers, file in the response) and
  do not queue. Other notification workflows remain separate product work.
- Queue Redis (when production-shaped) runs with AOF persistence and
  `noeviction`, and is never reused as a cache.
- The email slice includes leases, bounded retries, crash recovery, terminal
  failure handling, and credential-retention cleanup. Provider success and
  database bookkeeping are separate outcomes; an external send is not an
  exactly-once database transaction. See `docs/design-docs/transactional-email.md`.
- Tests of relays and workers require disposable databases and queue namespaces;
  never let a test relay claim development work or erase a shared queue.

## Data

- PostgreSQL 18 is the single source of truth. `timestamptz` UTC everywhere;
  `created_at` is the authoritative audit timestamp (never inferred from
  UUIDv7 values).
- Schema changes go through reviewed Prisma migrations
  (`docs/runbooks/migrations.md`); database objects that Prisma cannot model
  live in migration SQL and must never be dropped by an auto-generated diff.
- Production databases get off-host backups with tested restores before
  launch (`docs/design-docs/infra-deployment.md`).

## Audit and abuse budgets

- Sensitive collection management commits its audit row atomically; audit
  failure rolls back the action. Transfer history remains in its original hub
  and a receiving event is written to the destination hub in that transaction.
- Request budgets use atomic PostgreSQL upsert/count rollover across replicas.
  Store failure is fail-closed (503); dependency probes bypass the budget.
- Every minute each API replica removes at most 1,000 counters expired for
  more than a day using `SKIP LOCKED`; maintenance failure emits a sanitized
  event and retries on the next interval. No overlapping maintenance per
  process. Monitor backlog before raising limits or public traffic.
- Auth audit records expire after 90 days; delivery metadata expires after
  30 days. Collection audit has no automatic expiry. Account deletion and
  collection-audit retention require an explicit policy before public exposure;
  account deletion is disabled until a verified workflow and that policy exist.

## Observability and release verification

- LogTape console/Sentry logs and one manual incoming span carry isolated
  server-generated request IDs; unexpected exceptions are sanitized and
  correlated once. Telemetry sink/collector failure does not fail requests.
- API shutdown has a five-second bound including at most two seconds of
  telemetry flushing; the email worker has a ten-second shutdown bound.
  API startup uses the same entrypoint for source and compiled output;
  image checks exercise compiled API/worker startup and secret files.
- The [release runbook](runbooks/release.md) separates disposable local
  migration/backup/restore and outage proof from outstanding live Swarm,
  off-host restore, routing and collector checks.
