# Verification

The canonical verification gate:

```bash
bun run verify
```

It runs client/telemetry boundary checks, local documentation links, the
guide-pin check, shared typechecks, Biome format/lint, tooling/email tests,
then API generation/build, typecheck, source unit tests and real-service e2e.
Test discovery names source files explicitly and excludes generated/compiled
copies. `check:docs` checks local inline/reference links and heading anchors
in current Markdown documents; completed plans are historical snapshots and
are excluded. External links are not fetched.

The e2e stage first runs `tooling/verify-test-isolation.ts`: a sentinel database
is created before four concurrent child processes prove distinct databases,
success/failure/SIGTERM cleanup, and preservation of a surviving run and the
sentinel. Only these owned fixtures are asserted; unrelated concurrent runs
may clean up their own databases during the check. Production
and non-loopback admin configuration are refused. No required service check
silently skips when PostgreSQL is missing.

`tooling/verify-api-tests.ts` then uses `tooling/test-database.ts` to create a
fresh random PostgreSQL database, apply every migration, run suites serially,
and drop only that database. It clears request budgets inside the disposable
DB between suites. On interruption, setup must settle before cleanup decides
ownership, and any running suite is terminated before dropping the DB. SIGKILL
or host failure can still leave a `test_*` database; inspect ownership/running
processes before manually removing an abandoned one.

Defaults use the local +4 ports. Override only through test-specific
`TEST_DATABASE_ADMIN_URL` (a loopback PostgreSQL role with CREATEDB) and
`TEST_REDIS_URL`. Development `DATABASE_URL` and `_FILE` inputs never select
the test database. Email tests use a random per-run queue namespace and remove only their own
queue keys. Tests force the capture provider regardless of local Resend settings.
Remote telemetry is disabled by the runner; SDK tests use a local listener.

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
- E2E does not require resetting development data. On failure inspect the
  failing suite and service connectivity; the next run gets a fresh database.
- `.github/workflows/verify.yml` runs this full gate on pushes and pull
  requests with required PostgreSQL and Redis services. Missing infrastructure
  is a failure, never a skipped green suite. Application compilation remains
  part of verification; Docker image builds and rehearsals are separate.
- `.github/workflows/release.yml` is manually dispatched for deployment
  preparation. It requires the full gate, then builds and rehearses an image
  before the publication job can run. Image acceptance does not block W3
  development. See [release preparation](release.md) for evidence and live gates.
- `bun run verify:release-image -- <image>` runs that additional Docker release
  check locally when preparing deployment artifacts. The completed
  [auth-delivery plan](../exec-plans/completed/prove-auth-delivery-boundary.md)
  records source verification and the fresh image check deferred to deployment.
- New behavior with route-shape or authorization consequences gets an e2e
  regression test (`test/routes.e2e.spec.ts` is the pattern: it exists
  because two shadowed routes shipped unnoticed).

## Adding Checks

Promote repeated manual checks into Bun scripts (root `package.json`, later
`tooling/`) once they have been run manually twice. `bun run verify` should
remain the single command a contributor needs before committing.
