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
separate scopes:

- **Per collection:** `owner` (derived from owning the collection's hub; moves
  with a transfer), `reader` and `editor` (direct shares on that one collection;
  nothing carries over to other collections).
- **Site-wide service management:** `operator` and `admin`, granted to an
  account by invitation. They never grant access to private collections and
  make no one an owner (ADR-0009).

They appear in API contracts, the database and policy code, and are not renamed
for wording. Each surface chooses the label that serves its reader:

- Discussion: replies from the owner or an editor are badged **Curator** —
  readers only need to know the reply comes from someone who maintains the
  collection.
- Sharing: roles read **Can view** / **Can edit**, saying exactly what the
  person can do.
- Operations: "service operator" / "service admin".

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
