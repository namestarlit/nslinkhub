# Next session: hub architecture upgrade

Start here, then read `docs/hub-architecture-upgrade-plan.md` — the full
design (inherited from `/home/ns/Person/stack/hashikome/pigfarm` design docs)
and the phased plan.

## The one-line model

**Hub → Collections → Resources.** A **hub** is the tenant root and the only
true identity (`hubId`, immutable UUIDv7). Hubs own **collections** (the
"folders" of NSLinkHub — today's "repositories", renamed) which contain
**resources** (today's "entries"). Users are global identities that belong to
hubs via memberships (`owner | admin | member`) and join by invitation.
Usernames, display names, and hub names are mutable attributes — never
authorization keys, route keys, or foreign keys.

Publication and sharing (see "Publication And Discovery" + "Sharing Model" in
the plan):

- **Publish** = list the collection on NSLinkHub's product-wide **explore**
  surface; anyone can view, account holders can **save** it (social-style
  bookmark → their **saved/** surface, dormant while unpublished).
- **Unpublished** = hub members + explicit shares only (replaces
  public/unlisted/private).
- **Link sharing** = read for anyone with the rotatable link; **direct email
  sharing** = reader/editor for a specific account → recipient's **shared/**
  surface. Hub invitations are only for people who belong in the hub.

## The target shape

Pigfarm's monorepo is inherited too: Bun workspaces with `apps/api` (the
existing NestJS backend, Prisma stays inside), `apps/web` (Next.js — the full
product surface, design coined via an impeccable pass first), and
`apps/extension` (MV3 capture companion for major browsers), plus
`packages/types` and `packages/config`. Clients consume API contracts only —
never persistence, never a second domain engine. See "Workspace And Client
Surfaces" + Track W in the plan doc.

## Where to start

The plan doc is authoritative and every decision in it is settled — no open
questions remain. Implement it as written.

Implementation order is locked: **W1 → A → B → C → D → W2 → W3 → W4** (E
tracked alongside).

1. Start with W1: mechanical move of the backend to `apps/api` under Bun
   workspaces (source, `prisma/`, `prisma.config.ts`, tsconfig, tests move
   together; compose + root scripts delegate). No behavior change; everything
   green from the root before and after.
2. Phase A: error envelope + request IDs + config validation + cursor
   pagination.
3. Phase B reshapes `prisma/migrations/0_init` (nothing is deployed — squash,
   don't stack; see `ref/migration-plan.md` for the established pattern):
   the collection/resource rename, `hub_id` ownership, `published` +
   `link_sharing_enabled` booleans, shares/saves tables, personal hub at
   sign-up.
4. Phase C: hub policy service, access-resolution chain, explore + public hub
   page, sharing + saves endpoints, regression tests per the plan's list.
5. `apps/web` (W3) only starts after Phases B–C, and after the impeccable
   design/product pass produces the NSLinkHub equivalents of pigfarm's
   web-product-experience / web-interface-system / web-design-tokens docs —
   with explore, shared/, and saved/ as first-class surfaces.

## Future constraint to respect while implementing

A central identity service for the ns series is planned (working name:
nsauth; consumer brand: **"Continue with namestarlit"** / namestarlit
account — the ns series is personal work under the namestarlit brand) —
see `docs/identity-sso-direction.md`. Deployment for the whole series is
also centralized — namestarlit VPS + Dokploy, immutable GHCR images built by
GitHub Actions, no builds on the VPS (`docs/infra-deployment-direction.md`);
the current `docker-compose.yml` stays a local-dev file. Concretely for this
upgrade: keep
sign-up onboarding (personal hub creation) in an app-owned service callable
from any auth path (not hard-wired to one better-auth hook), keep
`resolveSessionUser` the single session entry point, and keep the product
userId authoritative so a linked SSO subject is just another mutable user
attribute.

## Verification setup that already exists

- `docker compose up -d` (PG 18 + Redis 7), `.env` defaults work.
- `bun run build`, `bun run lint`, `bun test src`, `bun test test` (e2e needs
  the containers), route regression tests in `test/routes.e2e.spec.ts`.
- Smoke scripts from the stack migration live in the previous session's
  scratchpad; rewrite the auth+CRUD smoke against hub routes as Phase C lands.

## Known coupling to remove (tracked in the plan)

- `GET /api/v1/users/:username/repositories/:slug` routes on a mutable
  username — replaced by `GET /hubs/:hubId/collections/:slug` in Phase C.
- `ownerId === userId` checks across services — replaced by the hub policy
  service in Phase C.
- The `visibility` enum and unlisted CHECK constraints — replaced by
  `published` + link sharing in Phase B.
