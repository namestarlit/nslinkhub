# Core Beliefs

## Repository Knowledge

- The repository is the source of truth for implementation decisions.
- `AGENTS.md` and `ARCHITECTURE.md` are maps. Detailed guidance belongs in
  focused documents close to the affected concern.
- Substantial work is recorded in versioned execution plans (`PLANS.md`).

## Architecture

- Enforce important boundaries mechanically where practical.
- Keep the backend a modular monolith until scale demands otherwise.
- Make the backend authoritative for business logic, workflow decisions,
  validation, authorization, and derived state.
- Treat web, extension, and future clients as replaceable delivery surfaces.
- Prefer explicit contracts and predictable module structure over hidden
  coupling.

## Delivery

- Build depth-first in small, verifiable slices; every phase ends green.
- Use Bun as the canonical TypeScript toolchain.
- Use agent judgment for exploration and repair; use Bun scripts for
  repeatable mechanics and verification checkpoints.
- Encode recurring review feedback into documentation, tests, or tooling.
- Track accepted compromises explicitly
  (`docs/exec-plans/tech-debt-tracker.md`) and pay down drift continuously.

## Product Safety

- Tenant (hub) isolation is a backend invariant.
- Sharing correctness is a correctness requirement: access resolution flows
  through one policy service; a revoked share or rotated link takes effect
  immediately.
- Immutable identity is non-negotiable: mutable human-facing values never
  become authorization keys, route keys, or foreign keys.
- Concurrent-edit safety (version checks) protects user curation work from
  silent overwrites.
- Auditability of sensitive actions is part of the product, not optional
  operational polish.
