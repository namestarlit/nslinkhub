# Restructure the repository into a Bun workspace (Track W1)

This ExecPlan is a living document. Maintain it according to `PLANS.md`.
Keep `Progress`, `Surprises & Discoveries`, `Decision Log`, and
`Outcomes & Retrospective` current as work proceeds.

## Purpose / Big Picture

The repository becomes a Bun-workspace monorepo with the backend at
`apps/api`, making room for `apps/web`, `apps/extension`, and `packages/*`
(see `docs/design-docs/hub-architecture.md`, "Workspace And Client Surfaces").
This is Track W1 — the first step of the locked order
**W1 → A → B → C → D → W2 → W3 → W4** — and is purely mechanical: no behavior
change, every later diff lives at its final path, and the `apps/api` +
`apps/web` split is exactly the image boundary the deployment platform
consumes (`docs/design-docs/infra-deployment.md`).

Observable result: `bun run verify` passes from the repository root before
and after; the API boots (`bun run start:dev`), serves `/api/v1/health`, and
the e2e suite passes — with the backend living under `apps/api`.

## Progress

- [x] (2026-07-03) Converted the root to a Bun workspace (`apps/*`, `packages/*`).
- [x] (2026-07-03) Moved the backend to `apps/api` via `git mv` (src/, test/,
      prisma/, prisma.config.ts, tsconfig*.json, nest-cli.json,
      eslint.config.mjs, .prettierrc/.prettierignore; untracked `.env` and
      `src/generated` moved with their directories).
- [x] (2026-07-03) Created `apps/api/package.json` (`@nslinkhub/api`); root
      `package.json` slimmed to workspace management + delegating scripts.
- [x] (2026-07-03) Added `packages/config` with `tsconfig.base.json`;
      `apps/api/tsconfig.json` extends it.
- [x] (2026-07-03) Swept path-sensitive references (.gitignore, README,
      AGENTS.md, ARCHITECTURE.md, runbooks).
- [x] (2026-07-03) `bun install` regenerated the lock; postinstall
      `prisma generate` produces `apps/api/src/generated/prisma`.
- [x] (2026-07-03) `bun run verify` green from root (build + lint + unit +
      e2e); API boots via root script; both smoke suites ALL PASS; fresh-DB
      `migrate deploy` OK; `migrate diff` reports no drift.
- [x] (2026-07-03) Docs updated; plan moved to `completed/`.

## Surprises & Discoveries

- Observation: `dotenv` and `express` were consumed directly
  (`prisma.config.ts`/`auth.ts` import `dotenv/config`; `app.setup.ts`
  imports `express`) but were never declared — they resolved only via
  single-package hoisting. The workspace layout broke both.
  Evidence: postinstall failed with "Cannot find module 'dotenv/config'";
  e2e failed with "Cannot find package 'express'". Fixed by declaring both
  as real dependencies of `@nslinkhub/api`.
- Observation: `declaration: true` broke the build under workspaces — tsc
  emitted TS2742 ("inferred type of 'auth' cannot be named") because zod
  types now resolve through Bun's `.bun/` store path.
  Evidence: `nest build` error at `src/auth/auth.ts:22`. Fixed by dropping
  declaration emit — the API is an app, not a library.
- Observation: Bun's `--cwd` must follow `run` (`bun run --cwd apps/api X`);
  `bun --cwd apps/api run X` prints the script list instead of executing.
  Evidence: root `verify` no-op'd until the flag order was fixed.

## Decision Log

- Decision: W1 lands before the tenancy phases.
  Rationale: The move is mechanical and the codebase is at its smallest;
  every later diff lives at its final path (hub design doc, settled).
  Date/Author: 2026-07-03 / namestarlit
- Decision: `compose.yml` stays at the repository root; `.env` moves into
  `apps/api` (amends the original intent to keep both at root).
  Rationale: compose serves the whole workspace, but dotenv and Nest's
  ConfigModule resolve `.env` from the process cwd, which is `apps/api`
  under the delegating scripts.
  Date/Author: 2026-07-03 / namestarlit
- Decision: Declare `dotenv` and `express` as direct dependencies; drop
  `declaration` emit from the app tsconfig.
  Rationale: imports must be declared where they are consumed; the API
  emits no library types.
  Date/Author: 2026-07-03 / namestarlit

## Outcomes & Retrospective

Shipped exactly as planned: the backend lives at `apps/api` under a Bun
workspace with delegating root scripts and a shared tsconfig base in
`packages/config`; behavior is unchanged (verify green, both smoke suites
pass, no schema drift, fresh-DB migrations work). The main lesson: the
single-package layout had been masking undeclared dependencies — the
workspace boundary surfaced them immediately, which is precisely the kind of
mechanical enforcement the monorepo is for. Next: Phase A (foundation
conventions).

## Context And Orientation

Current layout (single-package repo): NestJS backend in `src/` (modules,
`src/auth/auth.ts` better-auth instance, `src/app.setup.ts` shared HTTP
stack, `src/database/` PrismaService, `src/generated/prisma/` gitignored
generated client), e2e tests in `test/`, Prisma schema/migrations in
`prisma/` with `prisma.config.ts` at root, local services in `compose.yml`,
verification via root `bun run verify`.

Non-obvious couplings a mover must know:

- `prisma/schema.prisma` generator `output = "../src/generated/prisma"` —
  a relative path that must remain correct after the move.
- `prisma.config.ts` loads `dotenv/config` and defines the datasource URL;
  the Prisma CLI is invoked from wherever this file is found. After the
  move it lives at `apps/api/prisma.config.ts`; CLI invocations run from
  `apps/api` (root script delegates).
- `src/auth/auth.ts` imports the generated client via a relative path
  (`../generated/prisma/client`) because the better-auth CLI cannot resolve
  the `src/*` tsconfig alias — preserve whichever form keeps
  `bunx @better-auth/cli generate` working from `apps/api`.
- tsconfig uses `baseUrl` + `src/*`-style imports throughout the app; the
  moved tsconfig must preserve resolution (and `tsconfig.build.json`
  excludes `test` and `**/*spec.ts`).
- `.gitignore` entries `/src/generated`, `/dist` become `apps/api/...`
  forms.
- `package.json` `postinstall: prisma generate` must still run correctly
  under workspaces (it belongs to `apps/api`; Bun runs workspace postinstalls).
- E2E tests import `../src/app.module` and `../src/app.setup` and require
  the docker services; smoke scripts from earlier sessions hit
  `http://localhost:3000/api/v1`.
- The `trustedDependencies` list in the root package.json
  (`@prisma/engines`, `prisma`, `unrs-resolver`) must keep working after
  the dependency moves to the workspace package.

## Plan Of Work

1. Create `apps/api/`, `packages/config/`. Write the root workspace
   `package.json` (private, `workspaces`, delegating scripts) and
   `apps/api/package.json` carrying today's dependencies, scripts, and
   `postinstall`.
2. `git mv` the backend directories/files into `apps/api`: `src`, `test`,
   `prisma`, `prisma.config.ts`, `nest-cli.json`, `tsconfig.json`,
   `tsconfig.build.json`, `eslint.config.mjs`, `.prettierrc`,
   `.prettierignore`.
3. Add `packages/config/tsconfig.base.json` with the compiler options shared
   across future apps; `apps/api/tsconfig.json` extends it and keeps the
   app-specific options (decorators, baseUrl/paths, outDir).
4. Sweep path-sensitive references: `.gitignore`, the generator `output` in
   `schema.prisma` (recheck relative depth), root-README commands, runbook
   commands, `ARCHITECTURE.md` layout block and codemap.
5. `bun install` at root (regenerates lock with workspace layout; verify
   `prisma generate` postinstall produces `apps/api/src/generated/prisma`).
6. Verify (see Concrete Steps), fix fallout, keep this plan updated.

## Concrete Steps

From the repository root:

```bash
docker compose up -d
bun install
bun run verify          # build + lint + unit + e2e, delegating into apps/api
bun run start:dev &     # boots apps/api on :3000
curl -s localhost:3000/api/v1/health   # {"data":{"status":"ok"}}
```

Fresh-database migration check (per `docs/runbooks/migrations.md`):

```bash
docker exec nslinkhub-postgres psql -U postgres -c "CREATE DATABASE scratch"
cd apps/api && DATABASE_URL="postgresql://postgres:postgres@127.0.0.1:5432/scratch" \
  bunx prisma migrate deploy
docker exec nslinkhub-postgres psql -U postgres -c "DROP DATABASE scratch"
```

## Validation And Acceptance

- `bun run verify` passes from the root (all four stages).
- `bunx prisma migrate diff --from-config-datasource --to-schema
  prisma/schema.prisma` (run in `apps/api`) reports "No difference detected"
  against the dev DB.
- The API boots from the root script; `/api/v1/health` responds; a sign-up →
  create → share smoke against the running server behaves exactly as before
  the move.
- `git log --follow apps/api/src/main.ts` shows history preserved (moves,
  not delete+add).
- No file outside `apps/api`, `packages/`, root workspace files, and docs
  changed behaviorally.

## Idempotence And Recovery

Everything is file moves and config edits — no schema or data changes. Any
failed state recovers with `git status` + `git checkout`/`git reset` to the
pre-move commit. `bun install` and `prisma generate` are safe to repeat. The
dev database is untouched by this plan.

## Artifacts And Notes

(Record move fallout, resolver quirks, and Bun-workspace behaviors here as
they are discovered.)

## Interfaces And Dependencies

- Preserved contracts: every `/api/v1` route, the better-auth mount order
  (`app.setup.ts` before body parsers), `AuthUser` consumption via
  `resolveSessionUser`, Prisma 7 + `@prisma/adapter-pg`, PostgreSQL 18 /
  Redis 7 services from root `compose.yml`.
- Workspace scope is `@nslinkhub/*` (hub design doc, dependency rules).
- Clients-never-import-persistence becomes mechanically checkable once
  `packages/types` exists (Track W2) — out of scope here.
