# ADR-0003: The backend owns the rules; native forms work without JavaScript

**Status:** accepted  
**Date:** 2026-10-07

## Context

The web and the planned browser extension are delivery surfaces. Duplicating
rules in clients drifts; JavaScript-only forms fail on slow or blocked scripts.

## Options considered

- Client-side validation as the authority
- Backend-owned rules with native form posts enhanced by JavaScript

## Decision

The API owns validation, authorization and derived state. Clients are
replaceable delivery surfaces whose checks give early feedback only. Web
journeys are native form posts first, enhanced by JavaScript; the mechanics are
in [ARCHITECTURE.md](../../ARCHITECTURE.md) (Runtime Architecture) and the
[interface system](../design-docs/web-interface-system.md).

## Rationale

- One source of truth for rules; clients stay replaceable.
- Every journey works without JavaScript and is testable both ways.

## Constraints to preserve

- UI hiding is never a security rule.
- Form posts accept only same-origin, URL-encoded bodies.
- Clients never import Prisma or API internals; raw `fetch` lives only in `lib/http.ts`.
- Browser journeys are tested with and without JavaScript.

## Links

- [ARCHITECTURE.md](../../ARCHITECTURE.md)
- [web-interface-system.md](../design-docs/web-interface-system.md)
