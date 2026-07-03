# Verification

The canonical verification gate:

```bash
bun run verify
```

It runs, in order:

1. `bun run build` — `nest build` (TypeScript compilation of the app and the
   generated Prisma client).
2. `bun run lint` — ESLint over `src` and `test` (with `--fix`).
3. `bun test src` — unit tests.
4. `bun test test` — e2e tests, which boot the real HTTP stack
   (`configureApp`: better-auth mount + body-parser ordering) against the
   local docker services.

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
