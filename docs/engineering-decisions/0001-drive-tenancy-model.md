# ADR-0001: Google-Drive tenancy: one hub per user, per-collection sharing

**Status:** accepted  
**Date:** 2026-10-07

## Context

Early designs had shared workspaces with memberships and roles. That made every
query depend on membership state and made sharing a single collection awkward.

## Options considered

- Organization/workspace memberships with roles
- One personal hub per user with per-collection grants (Google Drive model)

## Decision

Every user owns exactly one hub. Collections are the unit of sharing. Access to a
collection resolves through one policy service, in order: hub owner (full) →
direct share (reader/editor) → active share link → published. There are no
memberships, no roles beyond owner/reader/editor, and no admin bypass.

## Rationale

- Sharing matches how people already think (a file, not a team).
- One policy chain keeps authorization auditable and testable in one place.
- No membership state to keep consistent across features.

## Constraints to preserve

- Every hub-owned query carries `hubId`; route IDs never prove access.
- Collection access goes only through `CollectionPolicyService`.
- Grants apply to one collection; references and links never inherit them.
- Operator authority is separate and never grants private reads (see the operator-authority record).

## Links

- [tenancy-and-access.md](../design-docs/tenancy-and-access.md)
- [SECURITY.md](../SECURITY.md)
