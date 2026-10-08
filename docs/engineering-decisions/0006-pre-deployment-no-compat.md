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

Until a production deployment exists, the codebase describes only the current
product: renamed or removed things change outright, with no redirects, aliases
or shims; migrations may be squashed and local data reset and reseeded. Large
internal redesigns are welcome; the only blocker is a change to user-facing
behaviour, business workflow or UX. Procedure:
[migrations runbook](../runbooks/migrations.md).

## Rationale

- The codebase describes only the current product.
- Now is the cheapest time to fix structure.

## Constraints to preserve

- Squashes verify `prisma migrate diff` reports no difference.
- This record is superseded the day production exists.

## Links

- [migrations.md](../runbooks/migrations.md)
- [local-development.md](../runbooks/local-development.md)
