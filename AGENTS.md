# Repository Guide

This repository is the source of truth for the NSLinkHub product and
engineering decisions. External documents are references only. Keep this file
short: it is a map for contributors and coding agents, not a complete manual.

## Start Here

1. Read `ARCHITECTURE.md` for the current system map.
2. Read `docs/hub-architecture-upgrade-plan.md` — the authoritative target
   design (hubs → collections → resources, sharing, discovery, workspace) and
   the locked implementation order (W1 → A → B → C → D → W2 → W3 → W4).
3. Read the focused document for the area being changed.
4. For substantial work, read `PLANS.md`, then create or update an ExecPlan in
   `docs/exec-plans/active/`.
5. Verify with `bun run build`, `bun run lint`, `bun test src`, and
   `bun test test` (e2e needs `docker compose up -d`).
6. For completed work, update `CHANGELOG.md` before preparing commits.

For web design work (Track W3), use the Impeccable skill after the design
documents it produces exist; repository docs and acceptance criteria remain
authoritative.

## Focused References

- `docs/hub-architecture-upgrade-plan.md`: authoritative target design and
  phased implementation plan.
- `docs/identity-sso-direction.md`: ns-series identity ("Continue with
  namestarlit", nsauth) and the constraints current work must respect.
- `docs/infra-deployment-direction.md`: ns-series deployment (namestarlit VPS,
  Dokploy Stack mode, GHCR images, topology-file conventions).
- `docs/nestjs-v2-feature-spec.md`: original product spec (historical
  background; the hub plan supersedes it where they conflict).
- `PLANS.md`: required format for substantial execution plans.
- `docs/exec-plans/tech-debt-tracker.md`: accepted compromises and follow-ups.
- `CHANGELOG.md`: durable summary of completed project changes.

## Toolchain

- Use Bun for package installation, script execution, and tests. Commit
  `bun.lock`; do not add npm, Yarn, or pnpm lockfiles.
- Run Prisma through `bunx prisma` (configuration in `prisma.config.ts`; the
  datasource URL lives there, not in the schema).
- Schema changes use `prisma migrate dev --create-only` + review: the
  `app_uuid_v7()` function, `set_updated_at` triggers, the hierarchy trigger,
  CHECK constraints, and partial unique indexes exist only in migration SQL
  and must never be dropped by an auto-generated diff.
- `compose.yml` is local development only. Production topology is
  `docker.stack.<env>.yml` in the swarm dialect (see the infra direction doc).
- Use Conventional Commit style: `feat: ...`, `fix: ...`, `docs: ...`,
  `chore: ...`, `test: ...`, with `!` and a `BREAKING CHANGE:` footer for
  breaking changes.

## Non-Negotiable Invariants

- Database identities are immutable UUIDv7 values. Mutable human-facing values
  (usernames, display names, hub names, emails) never appear in authorization
  rules, foreign keys, or route contracts.
- The backend owns authoritative business rules, validation, authorization,
  and derived state. Clients are replaceable delivery surfaces; UI hiding is
  never a security rule.
- better-auth owns credentials, sessions, and verification primitives; the
  product owns identity, membership, authorization, and workflows. Session
  resolution goes through `resolveSessionUser`; services consume `AuthUser`,
  never better-auth types.
- Sign-up onboarding stays in an app-owned service callable from any auth
  path (the SSO direction depends on this).
- Once hubs land: every hub-owned query carries `hubId`; route IDs never
  prove access; collection access flows through the single policy service
  (published → membership → direct share → active link).
- NestJS route order: literal routes are declared before parameter routes in
  the same controller, and catch-all lookups never share a prefix with
  `:id/*` subresources.
- Clients (web, extension) never import Prisma Client, generated Prisma
  types, or `apps/api` internals once the workspace split lands.
- `main.ts`/`app.setup.ts` mount the better-auth handler before body parsers;
  new global middleware must respect that ordering. E2E tests boot through
  `configureApp` so they run the production HTTP stack.
- Production images are prebuilt (GHCR, SHA-pinned); nothing builds on the
  VPS. Secrets reach services as `_FILE` inputs and are never logged or baked
  into images.
- Keep product branding out of schemas, table/column names, API fields, and
  env-var names.

## Documentation Rules

- Keep `ARCHITECTURE.md` stable and concise. Put evolving detail in `docs/`.
- Update repository-local docs when behavior, boundaries, or decisions change.
- Record user-facing and maintenance-relevant completed work in `CHANGELOG.md`.
- Use `ref/` only for disposable, git-ignored implementation context (see
  `ref/README.md`). Never store secrets, PII, or the only copy of a durable
  decision there.
- Maintain active ExecPlans according to `PLANS.md` at each stopping point.
- Move completed execution plans from `docs/exec-plans/active/` to
  `docs/exec-plans/completed/`.
