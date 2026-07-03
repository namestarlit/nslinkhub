# Architecture

## Purpose

NSLinkHub organizes links into curated, shareable collections. Hubs are the
tenant root; users belong to hubs through memberships; collections contain
resources and are shared per-collection (Drive model) or published to the
product-wide explore surface. See `PRODUCT.md` for the product definition and
`docs/design-docs/hub-architecture.md` for the authoritative target design.

The codebase is mid-transition: the current code still uses the
repository/entry vocabulary and user-ownership; the hub design lands in the
locked order W1 → A → B → C → D → W2 → W3 → W4.

## System Shape

A Bun-managed TypeScript codebase. The backend is a NestJS modular monolith
backed by PostgreSQL 18 (Prisma 7 with the pg driver adapter) and BullMQ on
Redis for queued exports. Auth is self-hosted better-auth (DB sessions,
bearer + username plugins, argon2id via `Bun.password`) mounted as raw
middleware ahead of body parsing. A Next.js web app and an MV3 browser
extension are planned client surfaces. The repository is a Bun workspace:
the backend lives at `apps/api`; `apps/web`, `apps/extension`, and further
`packages/*` join it in later tracks.
Production deployment targets the shared namestarlit VPS via Dokploy Stack
mode with prebuilt GHCR images.

```txt
apps/
  api/
    src/
      modules/     domain modules (controllers, services, DTOs)
      common/      guards, decorators, enums, utils, interfaces
      auth/        better-auth instance/config
      database/    PrismaModule / PrismaService
      generated/   Prisma client (gitignored; regenerated on install)
      app.setup.ts shared HTTP stack (auth mount, parsers, validation)
    prisma/        schema, migrations (prisma.config.ts beside them)
    test/          e2e specs (run the production HTTP stack)
packages/
  config/          shared TypeScript base configuration
compose.yml        local dev services (root; serves the whole workspace)
docs/              product/design docs, exec plans, runbooks
ref/               disposable, git-ignored implementation context
```

## Codemap

| Area | Owns |
| --- | --- |
| `auth` (`apps/api/src/auth`) | better-auth instance; handler mounted in `app.setup.ts` |
| `common/guards` | `AuthGuard`/`OptionalAuthGuard` via `resolveSessionUser` |
| `users` | profile read/update/delete |
| `repositories`* | collection CRUD, visibility/share-link, nesting, lookup |
| `entries`* | resource CRUD, reorder with version checks |
| `tags` | normalized tags on collections* and resources* |
| `imports` | CSV / bookmarks-HTML / WhatsApp-TXT ingestion |
| `exports` | markdown export; queued PDF jobs (BullMQ + `export_jobs`) |
| `health` | liveness endpoints |

\* renamed to collections/resources during Phase B of the hub work.

## Dependency Rules

- Controllers depend on services; services depend on `PrismaService` and
  policy helpers. Modules do not reach into another module's persistence.
- better-auth types stay behind `resolveSessionUser`; everything downstream
  consumes `AuthUser`.
- Prisma schema, migrations, generated client, and `PrismaService` are
  backend-private. Future clients consume API contracts only.
- The better-auth handler mounts before body parsers (`app.setup.ts`);
  global middleware must respect that ordering.

## Data Flow

1. Request hits a controller under `/api/v1`.
2. Global `ValidationPipe` validates/transforms DTOs
   (whitelist + forbidNonWhitelisted).
3. Guards resolve the session (`resolveSessionUser`) and attach `AuthUser`.
4. Services enforce access and business rules, reading/writing through
   Prisma.
5. Responses use the `{ data, meta? }` envelope; errors will use the stable
   error envelope (hub work, Phase A).

Async export flow: service writes an `export_jobs` row, enqueues a BullMQ
job; the processor updates status (`queued → running → completed|failed`);
clients poll the job endpoint.

## Cross-Cutting Concerns

Authentication, authorization policy, validation, request identity, and (in
target state) auditing and the transactional outbox cross module boundaries;
their shared infrastructure belongs under `src/common` or another explicit
shared boundary.

## Invariants

The non-negotiable invariants live in `AGENTS.md` and are not duplicated
here. Security and reliability rules are detailed in `docs/SECURITY.md` and
`docs/RELIABILITY.md`.

## Further Reading

- `PRODUCT.md`
- `docs/CORE_BELIEFS.md`
- `docs/SECURITY.md`
- `docs/RELIABILITY.md`
- `docs/design-docs/index.md`
- `docs/design-docs/hub-architecture.md`
- `docs/design-docs/identity-sso.md`
- `docs/design-docs/infra-deployment.md`
- `docs/runbooks/local-development.md`
- `docs/runbooks/verification.md`
- `docs/runbooks/migrations.md`
- `docs/runbooks/reference-context.md`
- `docs/exec-plans/tech-debt-tracker.md`
