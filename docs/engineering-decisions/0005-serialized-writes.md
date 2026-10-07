# ADR-0005: One global write lock serializes authenticated mutations

**Status:** accepted  
**Date:** 2026-10-07

## Context

At current scale, correctness of cross-entity invariants (holds, transfers,
shares, receipts) matters more than write throughput.

## Options considered

- Fine-grained row locks per feature
- One transaction-scoped advisory lock for every authenticated mutation

## Decision

Every authenticated non-GET request runs inside one transaction holding a single
PostgreSQL advisory lock (`AUTHORITY_LOCK`), and rechecks the live session under
it. Read-only commands (exports) and parsed uploads opt out explicitly. Network
calls never run inside the lock; follow-up work (title lookups) runs after
commit.

## Rationale

- Simple, provable ordering; no partial cross-entity states.
- Revisit with measured contention before scaling out.

## Constraints to preserve

- Slow or read-only work opts out explicitly; nothing makes outbound calls under the lock.
- A new mutation is locked by default.

## Links

- [RELIABILITY.md](../RELIABILITY.md)
- [final-pass-internals.md](../exec-plans/active/final-pass-internals.md)
