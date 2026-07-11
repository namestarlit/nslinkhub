# Local Development

## Prerequisites

- Bun 1.3+
- Docker (for PostgreSQL 18 + Redis 7)

## First Run

```bash
bun install                                # also runs `prisma generate` (postinstall)
bun run infra:up                           # local services: PostgreSQL 18 + Redis 7 (docker compose up -d)
(cd apps/api && bunx prisma migrate deploy)
bun run dev                                # everything for daily work (infra:up is idempotent, then API watch; web joins at W3)
```

The repository is a Bun workspace; the backend is `apps/api`. Root scripts
delegate, so day-to-day commands run from the root. Prisma CLI commands run
from `apps/api` (that is where `prisma.config.ts` lives). The app reads
`.env` from `apps/api/.env`.

`.env` is optional locally: without it, the code falls back to the standard
local defaults (`postgresql://postgres:postgres@127.0.0.1:5436/nslinkhub`,
Redis on 127.0.0.1:6383, dev better-auth secret). Set `BETTER_AUTH_SECRET` to
a real value for anything beyond local development.

## Everyday Commands

Root scripts follow the `<service>:<action>` convention (`infra:*`, `api:*`,
`email:*`, `types:*`; `web:*` joins with W3). Bare `dev` is the daily
orchestrator: it brings up everything (per-service dev scripts chain
`infra:up`, which is idempotent, so no ordering to remember).

```bash
bun run dev              # daily: infra up + API watch (web joins at W3)
bun run infra:up         # PostgreSQL 18 + Redis 7 (docker compose up -d)
bun run infra:down       # stop the local services
bun run api:dev          # infra:up + API watch mode
bun run api:build        # nest build → dist/
bun run api:prod         # bun dist/main.js
bun run check            # biome format + lint, with autofix (workspace-wide)
bun run lint             # biome lint (no writes)
bun run api:test         # API unit + e2e (e2e requires the infra services)
bun run email:test       # email template tests
bun run verify           # boundaries + typechecks + format + lint + all tests + build
```

Swagger UI: `http://localhost:4000/api/docs`.

## Resetting Local Data

The dev database is disposable. To rebuild it from the migration baseline:

```bash
docker exec nslinkhub-postgres psql -U postgres \
  -c "DROP DATABASE nslinkhub" -c "CREATE DATABASE nslinkhub"
(cd apps/api && bunx prisma migrate deploy)
```

(Terminate connections first if the drop is refused; stopping the dev server
is usually enough.)

## Notes

- The better-auth handler is mounted before body parsers
  (`src/app.setup.ts`); e2e tests boot through the same `configureApp` so
  local behavior matches tests.
- `compose.yml` is local development only — production topology is
  `docker-stack.<env>.yml` (see `docs/design-docs/infra-deployment.md`).
