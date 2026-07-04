# Shared API contracts + client boundary check (Track W2)

This ExecPlan is a living document. Maintain it according to `PLANS.md`.

## Purpose / Big Picture

Track W2 of `docs/design-docs/hub-architecture.md`. Extract the API's
request/response shapes into a shared workspace package (`@nslinkhub/types`)
that the web app (W3) and extension (W4) consume, and add a repository check
that mechanically forbids clients from importing backend internals or Prisma.
Observable: `packages/types` type-checks on its own; `bun run verify` runs the
boundary check (a no-op pass today, since no clients exist yet) alongside the
API verify.

## Progress

- [x] (2026-07-04) `packages/types` (`@nslinkhub/types`): source-only package (exports
      `src/index.ts`), extending `packages/config`, with envelope, common
      unions, collections, resources, hubs, imports contract types
      (timestamps as ISO strings — the wire format, not backend `Date`).
- [x] (2026-07-04) `packages/types` typecheck script (`tsc --noEmit`).
- [x] (2026-07-04) `tooling/check-client-boundaries.ts`: fail if `apps/web`/`apps/extension`
      import `apps/api`, `@prisma/client`, or the generated Prisma client.
- [x] (2026-07-04) Root `verify` runs the boundary check + types typecheck + api verify.
- [x] (2026-07-04) `bun run verify` green from the root; docs + CHANGELOG; plan completed.

## Surprises & Discoveries

- Observation: `nodenext` module resolution demands explicit `.js` extensions
  on relative imports, which broke the types package. Switched it to
  `moduleResolution: bundler` (module esnext) — correct for a source-only
  package consumed by Bun/Next bundlers, and extensionless.
  Evidence: TS2835 on every relative import until the tsconfig change.
- Observation: the boundary check was proven both ways — a temporary
  `apps/web/src` fixture importing `@prisma/client` failed it; removing the
  fixture restored the clean pass.
  Evidence: exit 1 with the violation printed, then exit 0.

## Decision Log

- Decision: contract types use `string` for timestamps (ISO), not `Date`.
  Rationale: the package describes the JSON wire format a client receives;
  `Date` is a backend in-memory detail lost across serialization.
  Date/Author: 2026-07-04 / namestarlit
- Decision: `packages/types` is source-only (no build step); consumers read
  the TS via `exports` → `src/index.ts` (Bun natively, Next via
  transpilePackages).
  Rationale: avoids a compile/publish step for an internal workspace package.
  Date/Author: 2026-07-04 / namestarlit
- Decision: hand-curated types now; a generated client (OpenAPI) or a
  backend-mapper assignability assertion is deferred (Phase E / tech debt).
  Rationale: the design says "hand-curated to start"; keeps W2 mechanical.
  Date/Author: 2026-07-04 / namestarlit
- Decision: `apps/api` does not import `@nslinkhub/types` yet.
  Rationale: its mappers return `Date`; wiring the string contract into the
  backend would force serialization gymnastics. Drift is caught later by
  generation. The contract is client-facing for now.
  Date/Author: 2026-07-04 / namestarlit

## Outcomes & Retrospective

Shipped as planned. `@nslinkhub/types` gives W3/W4 a typed, backend-independent
contract to build against, and the boundary check mechanically enforces the
clients-consume-contracts-only rule from day one. Verified green (boundary +
types typecheck + api build/lint/unit/23 e2e). Next: W3 — the web app, opened
by an impeccable design/product pass producing the three web design docs.

## Context And Orientation

Bun workspace with `apps/api` and `packages/config` (tsconfig base). The API
returns the `{ data, meta? }` / `{ error }` envelope with camelCase keys
(`docs/design-docs/conventions.md`); response mappers (`toPublicCollection`,
`toPublicResource`, member/invitation/share/save views) define the shapes to
mirror. No clients exist yet.

## Plan Of Work

1. `packages/types/package.json` (`@nslinkhub/types`, `exports` → src),
   `tsconfig.json` extending the config base, `src/*` contract modules +
   `index.ts` barrel.
2. `tooling/check-client-boundaries.ts`: walk `apps/web`/`apps/extension`
   source; regex import specifiers; fail on forbidden targets; pass when the
   dirs are absent.
3. Root `package.json`: `check:boundaries` script; `verify` runs boundaries +
   `--cwd packages/types typecheck` + `--cwd apps/api verify`.
4. Verify; docs; complete the plan.

## Concrete Steps

```bash
bun install
bun run verify   # boundary check + types typecheck + api build/lint/unit/e2e
```

## Validation And Acceptance

- `packages/types` type-checks with `tsc --noEmit`.
- The boundary check passes with no clients, and (proven by a temporary
  fixture during development) fails on a forbidden import.
- `bun run verify` green from the root.

## Idempotence And Recovery

Additive; no backend or schema change. Recovery is git.

## Interfaces And Dependencies

- New workspace package `@nslinkhub/types` (source-only wire contracts).
- New root check `tooling/check-client-boundaries.ts`, wired into `verify`.
- No change to `apps/api` behavior or contracts.
