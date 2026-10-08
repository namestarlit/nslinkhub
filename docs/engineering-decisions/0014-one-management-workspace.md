# ADR-0014: One management workspace, scoped by role

**Status:** accepted, amended 2026-10-08: **Manage** (`/manage`) is the hub
owner's workspace; running the service is a separate console, `/platform`
(renamed from `/ops`), for admins and operators  
**Date:** 2026-10-08

## Context

Service operators and admins had their own console ("Service operations"),
while hub owners had nowhere to manage their hub as a whole: moderate comments
across collections, see who has access, block someone, import, or review their
hub's audit. Operators cannot do those things for owners, because they cannot
see private content.

## Options considered

- Separate consoles per role (service operations plus a new owner area).
- One workspace whose scope and sections follow the viewer's roles.

## Decision

Under the recorded 2026-10-08 amendment, **Manage** is the hub owner’s workspace,
scoped to their own hub. Admins and operators use a separate **platform console**
at `/platform` (implemented at `/ops` until the route change ships). Owners
manage only their hub; service authority never grants private-content access.
Sections and routes: [manage-workspace.md](../design-docs/manage-workspace.md).

## Rationale

- One place for hub-wide management, with consistent table, row-action and
  audit patterns; the separate platform console preserves the scope boundary.
- Owners can do what operators must not: moderate and manage private content
  in their own hub.
- Hub-level work (imports, people, activity) gets a natural home.

## Constraints to preserve

- Each section is authorized by the API for the viewer's role and scope; the
  UI showing a section is never the permission.
- Service sections never show private titles or content (ADR-0009).
- Owner scope never reaches beyond the owner's hub.

## Links

- [manage-workspace.md](../design-docs/manage-workspace.md)
- [ADR-0009](0009-operator-authority.md), [ADR-0013](0013-permission-roles-and-display-labels.md)
