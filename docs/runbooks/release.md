# Release preparation and operator handoff

Status (2026-10-05): API artifacts passed local verification (67 repository tests plus the
image/migration/restore/outage/startup/shutdown rehearsal); both Swarm files
passed configuration validation. See the
[completed local milestone](../exec-plans/completed/deliver-release-foundations.md). The
user explicitly deferred live infrastructure. No GHCR publication, Swarm
deployment, Dokploy promotion, Sentry project, or Alloy rollout is claimed.
The API image is not an approval to expose the current product publicly:
auth delivery, browser CSRF, profile credential mutation,
and account-deletion/retention work remain in the adoption gates.

## Repeatable local checks

From the repository root, with Docker available:

```bash
bun run infra:up
bun run verify
docker build -f apps/api/Dockerfile -t release-check .
bun run verify:release-image -- release-check
```

The image rehearsal creates uniquely named containers, a private bridge
network, a database volume, and synthetic secret files. It publishes no ports
and cleans up only those resources. It applies every migration to an empty
PostgreSQL 18 database using the same image that serves traffic; boots the
compiled API as the `bun` user on a read-only filesystem; checks `_FILE`
inputs, health/readiness, Redis and PostgreSQL outages, bounded shutdown and
production config refusal; then dumps/restores a synthetic publication and
its audit record. It never resets the development database, initializes
Swarm, sends mail, or sends remote telemetry. Local Sentry-envelope capture
is covered by API unit tests. This restore is local, not off-host proof.

`docker-stack.local.yml` is the separate Swarm rehearsal artifact. Validate
its dialect with `API_IMAGE` and `LOCAL_SECRETS_DIR` set using
`docker stack config -c docker-stack.local.yml`. On an explicitly selected
disposable Swarm host, create synthetic `postgres_password`, `database_url`
and `auth_secret` files (database URL uses host `postgres`, database
`rehearsal`). Deploy with `API_REPLICAS=0`, run the migration as a one-shot
service on `<stack>_local` using secret `<stack>_database_url`, check its exit
code, then redeploy with `API_REPLICAS=1`. Probe through the attachable overlay
network; no host ports are exposed. Remove that stack and its owned volumes
afterward. A passing bridge-network rehearsal or `stack config` does not
prove Swarm scheduling, ingress, secrets distribution, or rolling updates.

## Image and release workflow

`.github/workflows/verify.yml` runs the complete real-service verification
gate and the image rehearsal. No required integration suite skips because
services are absent. `.github/workflows/release.yml` is manually dispatched
on `main`, depends on verification, and publishes the API image to GHCR with
a full commit SHA tag and build provenance/SBOM. Its summary supplies
`API_IMAGE=<registry>/<repository>/api:<sha>@sha256:<digest>`. There is no
deployment webhook yet. The reviewed #4 artifact plus UID-portability fix (`cb00a75`) passed
[hosted verification](https://github.com/namestarlit/nslinkhub/actions/runs/37335644020).
GHCR publication and live rollout remain unexecuted.

The Dockerfile pins Bun 1.3.14 by digest, installs the frozen lockfile and
compiles in the build stage. The runtime retains the pinned Prisma CLI so
the migration uses the identical artifact, at the cost of a larger image.
No install, generation, or compilation happens at application startup.
`tsconfig.runtime.json` resolves `src/*` imports into compiled `dist/src/*`.
Environment files, generated clients, keys and disposable reference context
are excluded from the build input.

## Platform inputs before a live rehearsal

The operator supplies non-secret references for:

- The namestarlit Dokploy project in **Stack** mode and its actual Traefik
  provider/version, HTTPS entrypoint, certificate resolver and ingress CIDRs.
  The prepared labels use the Traefik Swarm provider. Validate them against
  the installed platform before promotion.
- `PUBLIC_HOST`, `INGRESS_NETWORK`, `BACKEND_NETWORK`, `HTTPS_ENTRYPOINT`,
  `TLS_RESOLVER`, `TRUSTED_PROXY_CIDRS`, `API_IMAGE`, and full `RELEASE_SHA`.
  Allow only the actual proxy addresses; never trust all forwarded headers.
- External Swarm secret names `DATABASE_URL_SECRET`, `AUTH_SECRET`,
  `REDIS_URL_SECRET`, `SENTRY_DSN_SECRET`. Their contents stay out of Git/chat.
  The stack exposes them only through `/run/secrets/*` and `_FILE` inputs.
- A PostgreSQL 18 product database and dedicated Redis with AOF and
  `noeviction`, reachable only over the private backend network. The product
  stack contains the API; the platform owns these shared-service lifecycles.
- A Sentry API project with reviewed access/retention, and shared Alloy
  stdout/dependency-metric collection. The API defaults to a 10% trace sample;
  `SENTRY_TRACES_SAMPLE_RATE` can override it. Request and error logs remain
  allowlisted even without a DSN.
- An encrypted off-host backup destination, restore destination, retention
  policy, and a named operator responsible for running the restore drill.

Validate the fully supplied topology with `docker stack config`; never print
resolved secret contents. Keep the public status contract for now:
`/api/v1/health` is dependency-free; `/api/v1/status` reveals dependency state
and is 503 only for PostgreSQL failure. API liveness is the container health
check; ingress uses readiness. Review this dependency-detail exposure before
public routing. Restrict development API documentation at the edge as needed.

## Migration-before-serve and rollback

Take and verify a recoverable backup before a release migration. For the
initial deploy keep API replicas at zero until migrations succeed; for an
upgrade keep the previous compatible image serving. Set `MIGRATION_SERVICE`
to a unique operator-owned name. On the selected Swarm manager:

```bash
docker service create --name "$MIGRATION_SERVICE" \
  --network "$BACKEND_NETWORK" \
  --secret "source=$DATABASE_URL_SECRET,target=database_url" \
  --env DATABASE_URL_FILE=/run/secrets/database_url \
  --restart-condition none --with-registry-auth \
  --entrypoint bun "$API_IMAGE" \
  node_modules/prisma/build/index.js migrate deploy
docker service ps --no-trunc "$MIGRATION_SERVICE"
```

Inspect the task's `Status.State` and `Status.ContainerStatus.ExitCode` using
`docker inspect` on its task ID. **Require completed with exit code 0** before
promotion; a submitted task is not a completed migration. Preserve sanitized
logs and remove the one-shot service. Then let Dokploy deploy the reviewed
`docker-stack.prod.yml` with registry authentication. Never run migration
automatically in every API replica.

The release-foundations migration adds `audit_records` and `request_budgets`
plus indexes/CHECK constraints only. It preserves UUID generation, hierarchy
and timestamp triggers, and partial unique indexes. The old image can run
with these additional tables. Roll back the image on application failure;
do not drop audit data or automatically reverse SQL. Prisma migration failure
requires inspection and the existing [migration runbook](migrations.md).
Changes to existing columns in future releases require a separate compatibility
and rollback review.

## Outstanding live acceptance

Before public exposure, actually run the disposable Swarm rehearsal, GHCR
pull and secret distribution, migration-before-traffic and rolling rollback,
TLS/health routing, and off-host backup restore. Verify the restored identities,
collection content/sharing, audit trail and SQL-only invariants. Record image
digest, migration set, dates, outcome and operator in repository-local evidence
without secret values. Validate resource limits against measured load.

Follow one deliberate synthetic sanitized API failure by request ID through
Sentry issue/trace/log and Alloy/Loki; confirm dependency metrics and alert
delivery, telemetry-outage behavior, and operator access/retention. Audit data
currently has no automatic purge; choose the account-deletion and audit
retention policy before that endpoint is publicly available. Auth events,
worker/browser spans, authenticated-address challenge budgets and sender proof
arrive with their own slices. See [adoption decisions](../design-docs/adoption-decisions.md).
