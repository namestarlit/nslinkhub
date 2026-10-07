# ADR-0006: Pre-deployment: no compatibility code; squash and reset freely

**Status:** accepted  
**Date:** 2026-10-07

## Context

Nothing is deployed and there is one developer. Compatibility code would be dead
code from day one.

## Options considered

- Keep redirects, aliases and additive-only migrations
- Change outright until production exists

## Decision

Until a production deployment exists: renamed routes, removed features and
reversed decisions change outright with no redirects, aliases or shims;
migrations may be squashed into one `0_init` (generated from the migrated schema
so hand-written SQL survives) and local databases reset and reseeded
(`bun run db:seed`). Large internal redesigns are welcome; the only blocker is a
change to user-facing behaviour, business workflow or UX.

## Rationale

- The codebase describes only the current product.
- Now is the cheapest time to fix structure.

## Constraints to preserve

- Squashes verify `prisma migrate diff` reports no difference.
- This record is superseded the day production exists.

## Links

- [migrations.md](../runbooks/migrations.md)
- [local-development.md](../runbooks/local-development.md)
