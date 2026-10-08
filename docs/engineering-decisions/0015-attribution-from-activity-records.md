# ADR-0015: Attribution comes from activity records

**Status:** accepted  
**Date:** 2026-10-08

## Context

Collections are built by several people: the creator, the owner, editors. Readers
should see who contributed and who added what; owners need an audit of their
hub. Separately maintained maintainer lists and audit logs would drift apart.

## Options considered

- Store maintainer lists and per-item authors as separate mutable fields.
- Record every change as an activity entry and derive attribution from it,
  as GitHub derives contributors from commits.

## Decision

Every change to a hub's content and settings is recorded as an append-only
activity entry (actor, action, target, time), written in the same transaction
as the change. Attribution is derived from those entries: the collection's
creator, who added each item, and a collection's maintainers (everyone who
shaped its content). The same entries
are the hub's audit trail. The creator remains a record, never a role
(ADR-0013). What is recorded and shown:
[attribution-and-activity.md](../design-docs/attribution-and-activity.md).

## Rationale

- One source of truth for "who did what"; nothing to keep in sync.
- Matches a model people already understand (commits and contributors).
- The owner's audit and the reader's attribution can never disagree.

## Constraints to preserve

- Entries hold ids and actions only — no names, emails, tokens or authored text
  (names are resolved when shown, honouring each person's attribution setting).
- Entries are written atomically with the change and never edited.
- Attribution never grants access, and shows only what the viewer may read.

## Links

- [attribution-and-activity.md](../design-docs/attribution-and-activity.md)
- [ADR-0002](0002-immutable-identities.md), [ADR-0013](0013-permission-roles-and-display-labels.md)
