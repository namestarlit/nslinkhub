# Next session: hub architecture upgrade

Start here, then read `docs/hub-architecture-upgrade-plan.md` — the full
design (inherited from `/home/ns/Person/stack/hashikome/pigfarm` design docs)
and the phased plan.

## The one-line model

A **hub** is the tenant root and the only true identity (`hubId`, immutable
UUIDv7). Hubs own repositories. Users are global identities that belong to
hubs via memberships (`owner | admin | member`) and join by invitation.
Usernames, display names, and hub names are mutable attributes — never
authorization keys, route keys, or foreign keys.

## The target shape

Pigfarm's monorepo is inherited too: Bun workspaces with `apps/api` (the
existing NestJS backend, Prisma stays inside), `apps/web` (Next.js — the full
product surface, design coined via an impeccable pass first), and
`apps/extension` (MV3 capture companion for major browsers), plus
`packages/types` and `packages/config`. Clients consume API contracts only —
never persistence, never a second domain engine. See "Workspace And Client
Surfaces" + Track W in the plan doc.

## Where to start

1. Resolve the "Open Decisions" list at the end of the plan doc with the user
   (personal-hub UX, member write access, pagination, error envelope,
   workspace-move timing, extension capture UX).
2. Phase A (error envelope + request IDs + config validation) is independent
   and safe to do first. Track W1 (mechanical move to `apps/api` workspaces)
   is also independent — decide ordering with the user (open decision 6).
3. Phase B reshapes `prisma/migrations/0_init` (nothing is deployed — squash,
   don't stack; see `ref/migration-plan.md` for the established pattern) and
   swaps `repositories.owner_id` → `hub_id`.
4. `apps/web` only starts after Phases B–C (build against hub routes), and
   after the impeccable design/product pass produces the NSLinkHub
   equivalents of pigfarm's web-product-experience / web-interface-system /
   web-design-tokens docs.

## Verification setup that already exists

- `docker compose up -d` (PG 18 + Redis 7), `.env` defaults work.
- `bun run build`, `bun run lint`, `bun test src`, `bun test test` (e2e needs
  the containers), route regression tests in `test/routes.e2e.spec.ts`.
- Smoke scripts from the stack migration live in the previous session's
  scratchpad; rewrite the auth+CRUD smoke against hub routes as Phase C lands.

## Known coupling to remove (tracked in the plan)

- `GET /api/v2/users/:username/repositories/:slug` routes on a mutable
  username — replaced by `GET /hubs/:hubId/repositories/:slug` in Phase C.
- `ownerId === userId` checks across services — replaced by the hub policy
  service in Phase C.
