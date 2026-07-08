# Architecture

## Purpose

NSLinkHub organizes links into curated, shareable collections. A hub is one
personal space per user (the tenant root); collections contain resources and
are shared per-collection (Drive model) or published to the product-wide
explore surface. See `PRODUCT.md` for the product definition and
`docs/design-docs/hub-architecture.md` for the authoritative architecture.

The backend model is complete: Hub → Collections → Resources with a single
`CollectionPolicyService` for collection access. Tenancy is the Google-Drive
individual model — **one hub (personal space) per user**, identified by a
mutable handle + a free-form display name (no username, no memberships,
invitations, hub roles, or admin). Collaboration is per-collection sharing:
owner → direct reader/editor → active link → published. Remaining tracks are
the clients (W2 shared types done; W3 web, W4 extension) and Phase E hardening.

## System Shape

A Bun-managed TypeScript codebase. The backend is a NestJS modular monolith
backed by PostgreSQL 18 (Prisma 7 with the pg driver adapter); BullMQ on
Redis is reserved for future email/notification delivery (nothing queues
today). Auth is self-hosted better-auth (DB sessions, bearer
plugin, email + password, argon2id via `Bun.password`) mounted as raw
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
  types/           @nslinkhub/types — shared API wire contracts for clients
tooling/           repository checks (client boundary check)
compose.yml        local dev services (root; serves the whole workspace)
docs/              product/design docs, exec plans, runbooks
ref/               disposable, git-ignored implementation context
```

## Codemap

| Area | Owns |
| --- | --- |
| `auth` (`apps/api/src/auth`) | better-auth instance + personal-hub onboarding hook; handler mounted in `app.setup.ts` |
| `common/guards` | `AuthGuard`/`OptionalAuthGuard` via `resolveSessionUser` |
| `hubs` | one-hub-per-user ownership + handle management (`HubsService`), collection access policy — owner → direct share → link → published, inheriting down the collection tree (`CollectionPolicyService`) |
| `users` | self-service profile at `/profile` (display name, bio, hub handle) |
| `collections` | collection CRUD (two-level nesting), publish/unpublish, link + direct sharing, ownership transfer, saves, `/explore`, public hub pages, `/me/{shared,saved}`, hub-scoped lookup |
| `resources` | resource CRUD (own canonical URL, tags array, nesting via section entries), reorder with version checks |
| `imports` | bookmarks-HTML + universal-CSV ingestion with per-row error reports |
| `exports` | synchronous export (`POST /exports`): markdown/PDF/Word, one document per collection, zipped when several — programmatic renderers, no queue |
| `health` | liveness endpoints |

## Dependency Rules

- Controllers depend on services; services depend on `PrismaService` and
  policy helpers. Modules do not reach into another module's persistence.
- better-auth types stay behind `resolveSessionUser`; everything downstream
  consumes `AuthUser`.
- Prisma schema, migrations, generated client, and `PrismaService` are
  backend-private. Clients consume the API over HTTP and the
  `@nslinkhub/types` wire contract only; `tooling/check-client-boundaries.ts`
  (run by `bun run verify`) fails if a client imports `apps/api` internals or
  Prisma.
- The better-auth handler mounts before body parsers (`app.setup.ts`);
  global middleware must respect that ordering.

## Data Flow

1. Request hits a controller under `/api/v1`.
2. Global `ValidationPipe` validates/transforms DTOs
   (whitelist + forbidNonWhitelisted).
3. Guards resolve the session (`resolveSessionUser`) and attach `AuthUser`.
4. Services enforce access and business rules, reading/writing through
   Prisma.
5. Successes use the `{ data, meta? }` envelope; failures use the stable
   error envelope `{ error: { code, message, requestId, details } }`, and
   every response carries a server-generated `X-Request-Id`. Growth-prone
   lists paginate by opaque cursor (`meta: { limit, nextCursor }`).

File responses (exports) bypass the JSON envelope: the body is the document
itself with `Content-Disposition: attachment`.

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
