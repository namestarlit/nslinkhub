# ADR-0013: Permission roles are stable; display labels are chosen per surface

**Status:** accepted  
**Date:** 2026-10-08

## Context

The discussion labelled the owner's replies "Curator" and editors' replies
"Editor", and renaming the `editor` role to "Curator" was proposed. A role name
is used in the API, the database, policy code, tests and every client; a label
is what a person reads in one place, and the best word differs by place.

## Options considered

- Rename the permission role whenever the wording changes.
- Keep permission roles as stable identifiers and choose display labels per
  surface.

## Decision

Permission roles are stable identifiers that describe capability, in two
separate scopes: per collection (`owner`, `reader`, `editor`) and site-wide
service management (`operator`, `admin`). They are not renamed for wording;
each surface chooses the label that serves its reader. Role scopes and current
labels: [tenancy-and-access.md](../design-docs/tenancy-and-access.md#roles-and-labels).

## Rationale

- Contracts and stored data stay stable; wording can improve freely.
- Precise identifiers keep authorization readable; plain labels keep the
  interface readable. "Curator" as a permission would be vague (can a curator
  publish or share? no) and collides with the product's name for the owner.
- Mirrors ADR-0002: stable identity underneath, human-facing values on top.

## Constraints to preserve

- Changing a label is a client change (and a changelog entry), never an API or
  schema rename.
- Labels never imply a capability the role doesn't have; the API remains the
  authority on what each role may do.
- A new role is a new identifier, an engineering decision, and a policy change.
- The collection's **creator** is a record, not a role: set once, kept through
  transfers, used only for attribution, and never consulted for access.

## Links

- [tenancy-and-access.md](../design-docs/tenancy-and-access.md)
- [ADR-0001](0001-drive-tenancy-model.md), [ADR-0002](0002-immutable-identities.md)
