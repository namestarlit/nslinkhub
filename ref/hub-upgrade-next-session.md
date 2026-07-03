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

Sharing is Drive-style and per-repository (see "Sharing Model" in the plan):
publish/unpublish replaces public/unlisted/private; link sharing = read for
anyone with the link; direct email sharing = reader/editor for a specific
account, appearing under the recipient's user-level **shared/** surface.
Hub invitations are only for people who belong in the hub.

## The target shape

Pigfarm's monorepo is inherited too: Bun workspaces with `apps/api` (the
existing NestJS backend, Prisma stays inside), `apps/web` (Next.js — the full
product surface, design coined via an impeccable pass first), and
`apps/extension` (MV3 capture companion for major browsers), plus
`packages/types` and `packages/config`. Clients consume API contracts only —
never persistence, never a second domain engine. See "Workspace And Client
Surfaces" + Track W in the plan doc.

## Where to start

All open decisions are RESOLVED with the user (see "Resolved Decisions" in the
plan doc): personal hub auto-created as a normal hub; members get full content
write; minimal public hub page in Phase C; cursor pagination in Phase A;
pigfarm error envelope for failures alongside `{ data, meta }` successes;
extension ships popup + context menu + shortcut.

Implementation order is locked: **W1 → A → B → C → D → W2 → W3 → W4** (E
tracked alongside).

1. Start with W1: mechanical move of the backend to `apps/api` under Bun
   workspaces (source, `prisma/`, `prisma.config.ts`, tsconfig, tests move
   together; compose + root scripts delegate). No behavior change; everything
   green from the root before and after.
2. Phase A: error envelope + request IDs + config validation + cursor
   pagination for entries/repositories.
3. Phase B reshapes `prisma/migrations/0_init` (nothing is deployed — squash,
   don't stack; see `ref/migration-plan.md` for the established pattern),
   swaps `repositories.owner_id` → `hub_id`, and auto-creates the personal
   hub at sign-up.
4. `apps/web` (W3) only starts after Phases B–C (build against hub routes),
   and after the impeccable design/product pass produces the NSLinkHub
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
