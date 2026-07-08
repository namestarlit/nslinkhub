# Local Development

## Prerequisites

- Bun 1.3+
- Docker (for PostgreSQL 18 + Redis 7)

## First Run

```bash
bun install                                # also runs `prisma generate` (postinstall)
docker compose up -d                       # PostgreSQL 18 + Redis 7 (compose.yml, local dev only)
(cd apps/api && bunx prisma migrate deploy)
bun run start:dev                          # delegates into apps/api; :4000 (3000 is the web app's)
```

The repository is a Bun workspace; the backend is `apps/api`. Root scripts
delegate, so day-to-day commands run from the root. Prisma CLI commands run
from `apps/api` (that is where `prisma.config.ts` lives). The app reads
`.env` from `apps/api/.env`.

`.env` is optional locally: without it, the code falls back to the standard
local defaults (`postgresql://postgres:postgres@127.0.0.1:5432/nslinkhub`,
Redis on 127.0.0.1:6379, dev better-auth secret). Set `BETTER_AUTH_SECRET` to
a real value for anything beyond local development.

## Everyday Commands

```bash
bun run start:dev        # watch mode
bun run build            # nest build → dist/
bun run start:prod       # bun dist/main.js
bun run check            # biome format + lint, with autofix (workspace-wide)
bun run lint             # biome lint (no writes)
bun test src             # unit tests
bun test test            # e2e (requires docker compose services)
bun run verify           # boundaries + format + lint + build + typecheck + tests
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
  `docker.stack.<env>.yml` (see `docs/design-docs/infra-deployment.md`).
