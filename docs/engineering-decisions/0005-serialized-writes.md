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

Authenticated mutations are serialized: each runs in one transaction under a
single global PostgreSQL advisory lock and rechecks the session there.
Read-only and slow work opts out explicitly, and network calls never run under
the lock. Details: [RELIABILITY.md](../RELIABILITY.md).

## Rationale

- Simple, provable ordering; no partial cross-entity states.
- Revisit with measured contention before scaling out.

## Constraints to preserve

- Slow or read-only work opts out explicitly; nothing makes outbound calls under the lock.
- A new mutation is locked by default.

## Links

- [RELIABILITY.md](../RELIABILITY.md)
- [final-pass-internals.md](../exec-plans/active/final-pass-internals.md)
