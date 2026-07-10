# Verification

The canonical verification gate:

```bash
bun run verify
```

It runs, in order:

1. `bun run check:boundaries` — fails if a client app imports `apps/api`
   internals or Prisma (a no-op pass until clients exist).
2. `bun run check:guide-pin` — fails if any file the onboarding walkthrough
   (`docs/guides/`) links changed after the guide's pinned commit (fix:
   sweep the guide, bump its pin in a guide-only commit).
3. `bun run types:typecheck` — type-checks `packages/types`.
4. `bun run email:typecheck` — type-checks `packages/email`.
5. `bun run format:check` — Biome formatting check across the workspace.
6. `bun run lint` — Biome lint across the workspace.
7. `bun run email:test` — email template tests (both render formats,
   validation rejections).
8. `bun run build` (in `apps/api`) — `nest build` (TypeScript compilation of
   the app and the generated Prisma client).
9. `bun run typecheck` (in `apps/api`) — `tsc --noEmit`, which also type-checks
   the test files that `nest build` does not compile.
10. `bun test src` (in `apps/api`) — unit tests.
11. `bun test test` (in `apps/api`) — e2e tests, which boot the real HTTP
    stack (`configureApp`: better-auth mount + body-parser ordering) against
    the local docker services.

Formatting and linting are Biome (`biome.json`). `useImportType` is disabled
for `apps/api` only (via a Biome override) because NestJS dependency injection
and `emitDecoratorMetadata` need runtime imports for decorated
classes/parameters; it stays enabled for `packages/*`, `tooling/`, and the
future `apps/web`. Autofix everything with `bun run check` (adds
`biome check --write`).

Requirements: `bun run infra:up` (PostgreSQL + Redis) for the e2e stage.

## Local Enforcement

A versioned `pre-push` hook in `tooling/git-hooks/` runs `bun run verify`
before every push. Branch protection and rulesets are unavailable on a
free-plan private repository, so the local hook is the blocking gate.
`bun install` wires it through the root `prepare` script
(`tooling/setup-git-hooks.ts` sets `core.hooksPath`; it no-ops without a
`.git` entry, so deployment image builds are unaffected). Deletion-only
pushes skip verification. Because the e2e stage needs the local services,
push with `bun run infra:up` done — or bypass an emergency push with
`git push --no-verify` or `SKIP_VERIFY=1` (generic name by the
no-branding-in-env-vars rule).

Keep the hook fast enough that nobody is tempted to bypass it by habit.
When later milestones make the full suite slow (integration tests,
container-backed checks), split the tiers: keep a fast command (format,
lint, typechecks, unit tests, static checks) as the pre-push gate and move
the full suite to hosted CI as the authoritative gate — enforced
server-side through required status checks once a paid plan is justified.
This escalation path is the decided design; only its trigger is pending.

## Expectations

- Every phase/milestone ends green on `bun run verify` before it is
  committed.
- E2E currently runs against the local dev database (accepted debt — see
  `docs/exec-plans/tech-debt-tracker.md`). Tests suffix their data uniquely,
  but fixtures with *fixed* seeds still accumulate across reruns — the
  derived-handle space for a fixed test name once exhausted after ~24 runs
  and broke sign-ups. When e2e fails strangely, reset the dev DB first
  (`docs/runbooks/local-development.md` § Resetting Local Data).
- New behavior with route-shape or authorization consequences gets an e2e
  regression test (`test/routes.e2e.spec.ts` is the pattern: it exists
  because two shadowed routes shipped unnoticed).

## Adding Checks

Promote repeated manual checks into Bun scripts (root `package.json`, later
`tooling/`) once they have been run manually twice. `bun run verify` should
remain the single command a contributor needs before committing.
