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

## Where to start

1. Resolve the "Open Decisions" list at the end of the plan doc with the user
   (personal-hub UX, member write access, pagination, error envelope).
2. Phase A (error envelope + request IDs + config validation) is independent
   and safe to do first.
3. Phase B reshapes `prisma/migrations/0_init` (nothing is deployed — squash,
   don't stack; see `ref/migration-plan.md` for the established pattern) and
   swaps `repositories.owner_id` → `hub_id`.

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
