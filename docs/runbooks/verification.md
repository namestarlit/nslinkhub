# Verification

The canonical verification gate:

```bash
bun run verify
```

It runs, in order:

1. `bun run check:boundaries` — fails if a client app imports `apps/api`
   internals or Prisma (a no-op pass until clients exist).
2. `bun run typecheck:types` — type-checks `packages/types`.
3. `bun run format:check` — Biome formatting check across the workspace.
4. `bun run lint` — Biome lint across the workspace.
5. `bun run build` (in `apps/api`) — `nest build` (TypeScript compilation of
   the app and the generated Prisma client).
6. `bun run typecheck` (in `apps/api`) — `tsc --noEmit`, which also type-checks
   the test files that `nest build` does not compile.
7. `bun test src` — unit tests.
8. `bun test test` — e2e tests, which boot the real HTTP stack
   (`configureApp`: better-auth mount + body-parser ordering) against the
   local docker services.

Formatting and linting are Biome (`biome.json`). `useImportType` is disabled
for `apps/api` only (via a Biome override) because NestJS dependency injection
and `emitDecoratorMetadata` need runtime imports for decorated
classes/parameters; it stays enabled for `packages/*`, `tooling/`, and the
future `apps/web`. Autofix everything with `bun run check` (adds
`biome check --write`).

Requirements: `docker compose up -d` (PostgreSQL + Redis) for the e2e stage.

## Expectations

- Every phase/milestone ends green on `bun run verify` before it is
  committed.
- E2E currently runs against the local dev database (accepted debt — see
  `docs/exec-plans/tech-debt-tracker.md`); tests create uniquely-suffixed
  data so reruns don't collide.
- New behavior with route-shape or authorization consequences gets an e2e
  regression test (`test/routes.e2e.spec.ts` is the pattern: it exists
  because two shadowed routes shipped unnoticed).

## Adding Checks

Promote repeated manual checks into Bun scripts (root `package.json`, later
`tooling/`) once they have been run manually twice. `bun run verify` should
remain the single command a contributor needs before committing.
