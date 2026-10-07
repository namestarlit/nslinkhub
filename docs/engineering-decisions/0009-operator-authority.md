# ADR-0009: Separate operator authority; step-up for sensitive actions

**Status:** accepted  
**Date:** 2026-10-07

## Context

Running the service needs account and content moderation without turning
operators into readers of private content.

## Options considered

- Admin role inside the product policy
- Separate service-operator authority with its own audit

## Decision

Service admins and operators have a separate, explicitly granted authority.
They manage accounts and public-content holds but never read private content;
every action and read is audited. Sensitive actions need a recent email code:
the person confirms it's them, chooses to send the code, and the waiting action
then finishes by itself. Operator search text never appears in page URLs.

## Rationale

- Moderation without a privacy back door.

## Constraints to preserve

- Operator listings show no private titles.
- Actions require a reason; there are no confirmation checkboxes.

## Links

- [service-operations.md](../design-docs/service-operations.md)
- [SECURITY.md](../SECURITY.md)
