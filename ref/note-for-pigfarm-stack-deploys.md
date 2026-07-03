# Note for pigfarm: base Dokploy deployments on Stack mode (docker swarm)

From the nslinkhub deployment-direction investigation, 2026-07-03. Portable —
drop into pigfarm's ref/ or fold into
`docs/design-docs/deployment-vps.md` / `docs/runbooks/deployment.md`.

## The finding

Dokploy runs on Docker Swarm underneath (its installer initializes swarm for
its own services), and its Compose service type offers two modes: plain
**Docker Compose** and **Stack** (`docker stack deploy`). Verified against
https://docs.dokploy.com/docs/core/docker-compose.

pigfarm's `deployment-vps.md` currently says "Pigfarm is managed as a Dokploy
Docker Compose service using prebuilt images. Direct `docker stack deploy` is
not the Pigfarm release workflow." The second sentence stays true either way —
Dokploy remains the management plane — but the recommendation is to select
**Stack mode within Dokploy** rather than standalone compose, and to write the
production topology in the swarm dialect from day one.

## Why Stack mode fits pigfarm's own rules

- Stack mode has no `build:` — it *mechanically enforces* the existing
  invariant that production images are prebuilt in CI and never built on the
  VPS.
- Swarm-native secrets mount at `/run/secrets/<name>` — exactly pigfarm's
  deployment-secret `_FILE` convention (`REDIS_QUEUE_URL_FILE`,
  `DATABASE_URL` resolver, better-auth key ring).
- Rolling updates, `deploy.restart_policy`, `deploy.resources`, and replicas
  come native, on the same single-node swarm Dokploy already initialized.

## Swarm-dialect consequences to bake into the topology file

- `depends_on` is ignored by `docker stack deploy` — do not rely on it for
  ordering. (pigfarm already treats migrations and release ordering as
  explicit steps, so this costs nothing.)
- Top-level `restart:` is replaced by `deploy.restart_policy`; resource
  limits live under `deploy.resources`.
- Named volumes only; relative-path bind mounts do not persist reliably
  under stack deployments.
- Private-registry pulls (GHCR) with replicas require `--with-registry-auth`
  on the deploy invocation, or worker nodes fail image pulls.

## Suggested file convention (what nslinkhub adopted)

- `compose.yml` — local development only, full compose dialect (pigfarm
  already does this).
- `docker.stack.yml` — the production topology in the swarm dialect,
  consumed by Dokploy Stack mode; never used locally, never contains
  `build:`.

Keeping the two files separate avoids the trap of one file trying to serve
both dialects and silently degrading in whichever mode wasn't tested.
