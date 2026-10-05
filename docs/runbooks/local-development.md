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

Local Compose runs PostgreSQL and Redis only. The API and email worker run
directly on the host; W3 will add a local Next.js development server. No
application Docker image is needed for this loop. `bun run verify` includes
application compilation to catch build errors, but does not build images.
Image builds and runtime rehearsals belong to
[deployment preparation](release.md).

`.env` is optional locally: without it, the code falls back to the standard
local defaults (`postgresql://postgres:postgres@127.0.0.1:5436/nslinkhub`,
Redis on 127.0.0.1:6383, dev better-auth secret). Set `BETTER_AUTH_SECRET` to
a real value for anything beyond local development.

## Everyday Commands

Root scripts follow the `<service>:<action>` convention (`infra:*`, `api:*`,
`email:*`, `types:*`; `web:*` joins with W3). Bare `dev` is the daily
orchestrator: it brings up infrastructure and the API (per-service dev scripts
chain `infra:up`, which is idempotent). Run the email worker separately as
described below.

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


## Email delivery

Authentication is email-code-only, with no password signup or fallback. The API commits encrypted
mail to PostgreSQL; run `bun run --cwd apps/api email:worker` separately to relay
and deliver it. Apply migrations before starting the API or worker. Local
infrastructure still comes from `bun run infra:up`.

`EMAIL_PROVIDER=capture` (default) uses bounded in-memory capture with no log or
HTTP exposure. Automated tests inject and inspect that sender. For development
with Resend, set `EMAIL_PROVIDER=resend`, `RESEND_API_KEY` (or `_FILE`) and
`EMAIL_FROM_ADDRESS` in the ignored API `.env`; this sends real mail when the
worker runs. Tests always override this to capture. Set `EMAIL_SUPPORT_URL` to
the HTTPS recovery/support route and `QUEUE_NAMESPACE` to an environment-unique
name; both are required in production. `RESEND_WEBHOOK_SECRET` (or `_FILE`)
enables signed delivery callbacks at `/api/v1/webhooks/resend`; without it the
endpoint fails closed with 503. Do not enable open/click tracking.

Set `EMAIL_SUPPRESSION_SECRET` (or `_FILE`) to an independent random secret of
at least 32 characters. Production requires it; development has a stable local
default. Keep the same value on API/worker replicas and across auth-secret
rotation and database restore. Never rotate it without an operator-reviewed
suppression rekey/import, since suppression rows do not store raw addresses.

The worker uses the same database, auth secret and Redis configuration as the
API. Production runs `bun run --cwd apps/api email:worker:prod` from the API
image. Do not share queue namespaces between deployments or test runs. Pending
codes expire after five minutes; delivery stops after expiry. Run the worker
for cleanup even during provider/Redis outages. Retention and endpoint contracts
are in [auth delivery](../design-docs/auth-delivery-integration.md).
