# Infrastructure & Deployment Direction (ns series)

Direction document, recorded 2026-07-03. Not scheduled work — like the
identity direction (`docs/design-docs/identity-sso.md`), this records the shared
platform the ns series deploys onto so each product builds toward it instead
of inventing its own operations story.

The deployment model is shared across the ns series and recorded here as
NSLinkHub's own: the ns series is personal work under the namestarlit brand and
runs on its **own** VPS and Dokploy instance — completely separate
infrastructure from anything the author's company operates.

## Direction

All ns products (nslinkhub, nsworklog, later nsauth, future ns*) deploy to a
single namestarlit VPS managed by **self-hosted Dokploy**:

- **GitHub Actions owns verification and builds.** It runs the repository's
  verify workflow, builds immutable production images from the reviewed
  commit, tags them with the full git commit SHA (human-readable tags may be
  added, never replacing the SHA tag), pushes them to **GHCR**, and triggers
  Dokploy only after every required image exists.
- **Dokploy owns running them.** It pulls the prebuilt images and runs each
  product's repository-owned topology, and manages domains, TLS, Traefik
  routing, deployment history, logs, and shared services.
  **No source builds on the VPS** — Dokploy must never clone and compile a
  product on the production host.
- **Swarm stack mode, not standalone compose.** Dokploy runs on Docker Swarm
  underneath, and its Compose service type offers an explicit **Stack** mode
  (`docker stack deploy`); ns products use it. Production topology files are
  written in the swarm dialect from day one: no `build:` (unavailable in
  stack mode — which mechanically enforces the prebuilt-image rule), no
  reliance on `depends_on` (ignored by swarm; migration-before-serve ordering
  is an explicit release step anyway), `deploy.restart_policy` and
  `deploy.resources` instead of top-level `restart:`/limits, **named volumes
  only** (relative-path bind mounts don't persist reliably), and
  `--with-registry-auth` on deploys since GHCR images are private. Swarm's
  native secrets (`/run/secrets/<name>`) are exactly the `_FILE` convention.
- **Topology files per product, one purpose each** (stack files are
  environment-suffixed `docker-stack.<env>.yml`):
  - `compose.yml` — local development only (the modern Compose default
    filename). Full compose dialect is fine here: localhost-bound published
    ports, healthchecks, whatever makes `docker compose up -d` pleasant.
  - `docker-stack.prod.yml` — the production topology, consumed by Dokploy's
    Stack mode. Never contains `build:`.
  - `docker-stack.local.yml` — a required artifact, not a contingency: the
    local single-node-swarm simulation of the production topology
    (`docker swarm init` + `docker stack deploy`), the established practice
    in other namestarlit projects. It is how stack-dialect behavior
    (secrets, `deploy.*` policies, ordering without `depends_on`) is
    rehearsed before anything reaches the VPS.
  - `docker-stack.stag.yml` only if a dedicated staging environment ever
    materializes — see the environment strategy below.
- **No dedicated staging environment.** Pre-release verification is
  **Dokploy preview deployments** (per-branch/PR previews on the same VPS)
  plus the `docker-stack.local.yml` simulation. A permanent staging
  environment is added only if previews prove insufficient.
- **Each product repository owns its own runtime definition**: Dockerfiles,
  both topology files above, health/readiness checks, environment and
  secret-file contracts, migration commands, and release ordering. Dokploy
  values are deployment inputs; durable runtime decisions stay documented in
  source control.
- **A private ns infrastructure repository (working name: nsinfra) owns the
  shared operational layer**: VPS provisioning, host hardening, firewall and
  SSH policy, pinned Dokploy installation/upgrades/backup/recovery, DNS and
  TLS policy, registry integration, shared backup destinations with
  restore-drill automation, and shared observability/uptime services. It
  references versioned product artifacts but owns no product code.

## Initial Topology

```txt
GitHub Actions (per product repo)
  -> verify and build
  -> push immutable SHA-tagged images to GHCR
  -> update release inputs and trigger Dokploy

namestarlit VPS
  -> Dokploy management services and deployment queue
  -> Dokploy-managed Traefik
       -> nslinkhub web + api
       -> nsworklog
       -> nsauth (when it exists)
  -> product workers (e.g. the nslinkhub email worker, when email ships)
  -> PostgreSQL 18 (one instance, one database per product)
  -> dedicated queue Redis per product that needs one
  -> shared services (uptime/observability) as nsinfra adds them
```

Defaults, revisitable when load or isolation needs justify it: one PostgreSQL
instance with per-product databases; a dedicated queue Redis per product that
runs queues (AOF persistence, `noeviction`, never reused as a cache). The VPS
is one failure domain: apply explicit resource limits, monitor disk and
memory pressure, keep builds off-host, and keep required backups **off-host**
with tested restores.

### Origins: web and API share one origin (no CORS)

Each product's web and API are served from **one public origin**, path-routed
by Traefik: `/api/*` goes to the API container, everything else to the web
container. In local development the web dev server proxies `/api/*` to the API
process (Next.js rewrites; API listens on 4000, web on 3000). Consequences,
relied on by the app code:

- No CORS configuration exists anywhere — same-origin end to end. This is
  deliberate and complete, not missing: the security rationale (browser
  Same-Origin Policy at full default strength, CSRF nuance, the rule for
  future "simple"-shaped endpoints) is recorded in `docs/SECURITY.md`
  § Origins, CORS, and CSRF. Adding a second origin later means adding CORS
  + better-auth `trustedOrigins` deliberately, not flipping a wildcard.
- better-auth cookies are host-only, first-party, and need no cross-site
  attributes; `BETTER_AUTH_URL` is the public origin in production and the
  API's own origin (`http://localhost:4000`) in development.
- File responses (exports) and headers like `X-Request-Id` are readable by
  the web app without exposed-header lists.

## Conventions (apply to every ns product)

- Production images are immutable and pinned by SHA tag and digest.
- Secrets reach services through deployment-secret `_FILE` inputs; secret
  values are never logged and never baked into images.
- Health and readiness endpoints are part of each product's API contract.
- Migrations run as an explicit release step owned by the product repo
  (`prisma migrate deploy` for nslinkhub), ordered before the new app
  version serves traffic.
- Dokploy project/environment names stay configurable — operational naming is
  not a durable contract (the naming-boundaries rule).
- GitHub environments and required approvals gate production deploys when the
  release risk warrants them; workflows get only the GHCR and Dokploy
  permissions they need.

## What This Means For NSLinkHub Now

Nothing blocks the hub upgrade. The pieces the plan already produces line up
with this direction:

1. Track W's workspace split (`apps/api`, `apps/web`) is exactly the image
   boundary: one API image (also runnable as a worker process later), one web
   image.
2. The `_FILE` secret contract is **implemented** for `DATABASE_URL` and
   `BETTER_AUTH_SECRET` (`apps/api/src/config/secret.ts`: `<NAME>_FILE` wins
   over `<NAME>`, trimmed file content, loud failure on an unreadable path).
   **Zero-config dev, required prod**: development needs no configuration —
   in-code localhost defaults match `compose.yml` — but nothing is ignored
   when provided. Resolution order: exported env var → `apps/api/.env`
   (optional, loaded at startup) → in-code default; so overriding, say, the
   port is one `.env` line, never a code change. `_FILE` inputs are the
   *deployed* contract (previews/staging/production). Validation
   enforces the boundary: with `NODE_ENV=production` the app refuses to boot
   when `DATABASE_URL`/`BETTER_AUTH_SECRET` are absent or the auth secret is
   the public dev default. Redis credentials join through the same
   `readSecret` when the email worker wires BullMQ (`REDIS_URL` /
   `REDIS_URL_FILE` already feed the readiness check). Health endpoints are
   **implemented**: `GET /api/v1/health` (liveness, dependency-free) and
   `GET /api/v1/status` (readiness: postgres + queue Redis →
   ready/degraded/unavailable; 503 only when postgres is down, so
   orchestration gates on the authoritative store while a Redis-only outage
   reads as degraded). When deployment nears, the repo still adds:
   Dockerfiles per app and the production compose topology.
3. The existing `compose.yml` remains a **local development** file; the
   production topology is a separate repository-owned
   `docker-stack.prod.yml` consumed by Dokploy.
4. nsauth, when built, deploys to the same platform — which is what makes the
   "Continue with namestarlit" flow operationally cheap for every future ns
   product.
