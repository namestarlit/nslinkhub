# Repository Guide

This repository is the source of truth for the NSLinkHub product and
engineering decisions. External documents are references only. Keep this file
short: it is a map for contributors and coding agents, not a complete manual.

## Start Here

1. Read `ARCHITECTURE.md` for the stable system map and dependency rules.
2. Read `PRODUCT.md` for the product definition and acceptance criteria.
3. Read `docs/SYSTEM_DESIGN.md` — the authoritative architecture
   (the Google-Drive individual model: one hub per user, collection-level
   sharing with downward inheritance, discovery, workspace). The backend is
   built; W3 (web) and W4 (extension) remain.
4. Read the focused document for the area being changed
   (`docs/design-docs/index.md`).
5. For substantial work, read `PLANS.md`, then create or update an ExecPlan in
   `docs/exec-plans/active/`.
6. Run the verification workflow: `bun run verify`
   (see `docs/runbooks/verification.md`; e2e needs `bun run infra:up`).
7. For completed work, update `CHANGELOG.md` before preparing commits.

For web design work (Track W3), use the Impeccable skill after the design
documents it produces exist; repository docs and acceptance criteria remain
authoritative.

## Working Rhythm

1. **Brief before implementing.** State what is about to change and why — a
   sentence or two, or the relevant ExecPlan section — before touching files,
   so the direction can be corrected before the diff exists.
2. **Implement the complete milestone**, not fragments.
3. **Verify**: `bun run verify` green (plus any plan-specific checks).
4. **Present for review**: summarize the result and the diff.
5. **Commit once per completed, reviewed milestone — then push.** No
   micro-commits, no pushing half-reviewed states.

## Focused References

- `PRODUCT.md`: canonical product definition and acceptance criteria.
- `docs/CORE_BELIEFS.md`: engineering principles.
- `docs/SECURITY.md`: tenant isolation, authorization, tokens, and auth
  boundary rules.
- `docs/RELIABILITY.md`: idempotency, concurrency, jobs, and data rules.
- `docs/SYSTEM_DESIGN.md`: the authoritative system design — the Google-Drive
  individual tenancy model, access rules, web URL scheme, and remaining tracks.
- `docs/design-docs/index.md`: focused satellite design documents.
- `docs/design-docs/conventions.md`: API/persistence casing and envelope rules.
- `docs/design-docs/identity-sso.md`: ns-series IAM direction (nsauth,
  "Continue with namestarlit") — built as an IAM, first slice ships AuthN+SSO;
  domain authorization stays product-owned; constraints current work respects.
- `docs/design-docs/infra-deployment.md`: ns-series deployment (namestarlit VPS,
  Dokploy Stack mode, GHCR images, topology-file conventions).
- `docs/runbooks/local-development.md`: setup and everyday commands.
- `docs/runbooks/verification.md`: the canonical verification gate.
- `docs/runbooks/migrations.md`: Prisma migration discipline.
- `docs/runbooks/reference-context.md`: disposable `ref/` usage and cleanup.
- `PLANS.md`: required format for substantial execution plans.
- `docs/exec-plans/tech-debt-tracker.md`: accepted compromises and follow-ups.
- `CHANGELOG.md`: durable summary of completed project changes.

## Toolchain

- Use Bun for package installation, script execution, and tests. Commit
  `bun.lock`; do not add npm, Yarn, or pnpm lockfiles.
- Use Biome for formatting and linting (`biome.json`); `bun run check`
  autofixes. `useImportType` is disabled for `apps/api` only — NestJS DI and
  `emitDecoratorMetadata` need runtime imports for decorated
  classes/parameters — and stays on elsewhere. Do not re-enable it there or
  re-add ESLint/Prettier.
- Run Prisma through `bunx prisma` from `apps/api` (configuration in
  `apps/api/prisma.config.ts`; the datasource URL lives there, not in the
  schema).
- Schema changes use `prisma migrate dev --create-only` + review: the
  `app_uuid_v7()` function, `set_updated_at` triggers, the hierarchy trigger,
  CHECK constraints, and partial unique indexes exist only in migration SQL
  and must never be dropped by an auto-generated diff.
- `compose.yml` is local development only. Production topology is
  `docker.stack.<env>.yml` in the swarm dialect (see the infra direction doc).
- Use Conventional Commit style: `feat: ...`, `fix: ...`, `docs: ...`,
  `chore: ...`, `test: ...`, with `!` and a `BREAKING CHANGE:` footer for
  breaking changes. One commit per completed, reviewed milestone (see
  Working Rhythm).

## Non-Negotiable Invariants

- Database identities are immutable UUIDv7 values. Mutable human-facing values
  (hub handles, display names, emails) never appear in authorization rules,
  foreign keys, or route contracts. Durable links use `hubId`, never the
  handle, so a handle rename never breaks a saved reference.
- The backend owns authoritative business rules, validation, authorization,
  and derived state. Clients are replaceable delivery surfaces; UI hiding is
  never a security rule.
- better-auth owns credentials, sessions, and verification primitives; the
  product owns identity, authorization, and workflows. Session resolution goes
  through `resolveSessionUser`; services consume `AuthUser`, never better-auth
  types.
- Sign-up onboarding stays in an app-owned service callable from any auth
  path (the SSO direction depends on this).
- Every hub-owned query carries `hubId`; route IDs never prove access;
  collection access flows through the single policy service — Google-Drive
  model: hub owner (full) → direct share (reader/editor) → active link →
  published. One hub per user; no memberships, no roles beyond owner/reader/
  editor, no admin bypass.
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
