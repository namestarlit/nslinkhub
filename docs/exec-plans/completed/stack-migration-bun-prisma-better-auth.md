# Migration Plan: Bun + Prisma + better-auth

Status tracking for the stack migration. Update the checkboxes as phases land.

**Goals**

1. Bun as package manager **and** runtime (dev + prod scripts).
2. Replace TypeORM with Prisma.
3. Replace hand-rolled JWT/Passport auth with self-hosted better-auth.

**Environment facts (at planning time, 2026-07-02)**

- Bun 1.3.14 and Node v22 installed.
- Postgres/Redis are NOT running locally; Docker is available — Phase 0 adds a
  compose file so every later phase can be verified against real services.
- Existing DB schema source of truth: `src/database/migrations/0001_sprint1_schema.sql`
  and `0002_export_jobs.sql` (raw SQL, includes uuid-v7 helper, hierarchy trigger,
  `set_updated_at` triggers, CHECK constraints).
- Only `entries.service.ts` (reorder transaction) and `repositories.service.ts`
  use transactions/query-builder; all other TypeORM usage is simple repo calls.

---

## Phase 0 — Dev infrastructure & baseline

- [x] Add `docker-compose.yml` with Postgres 18 + Redis 7 (ports 5432/6379),
      matching README `.env` defaults; add `.env` (gitignored) if missing.
      (Note: PG18 image needs the volume mounted at `/var/lib/postgresql`,
      not `/var/lib/postgresql/data`.)
- [x] Start services, apply the two SQL migrations, confirm the current app
      boots and tests pass **before** changing anything (baseline).

**Exit criteria:** `npm run build` + tests green, server boots against dockerized PG/Redis.

**Baseline known defects found during Phase 0 smoke (2026-07-02):** entities use
TypeORM `@PrimaryColumn` (not `@PrimaryGeneratedColumn`), so DB-generated uuids
are never read back after insert. Consequences: `POST /repositories` responds
without `id`; `POST .../entries/external` 500s whenever the URL creates a new
`links` row (CHECK violation on null `link_id`); `POST .../export/pdf` returns
no `jobId` and the queued job can't find its DB row. These are NOT to be fixed
in TypeORM — Phase 2 (Prisma) fixes the whole class; the Phase 2 smoke must
show these three flows working.

Additional baseline defect (routing, unrelated to the migration):
`GET /api/v2/repositories/:id/entries` **and** `GET .../:id/children` were
shadowed by the catch-all `GET /api/v2/repositories/:owner/:slug`, so both
always 404'd with "Repository not found". **Fixed (2026-07-03)** by moving the
owner/slug lookup to `GET /api/v2/users/:username/repositories/:slug`
(`repository-lookup.controller.ts`) — an unambiguous path instead of relying
on route-registration order. Regression e2e tests in `test/routes.e2e.spec.ts`
(app setup shared with `main.ts` via `src/app.setup.ts` so e2e runs the real
better-auth + body-parser stack). The separate background session spawned for
this bug is superseded and its result can be discarded.

## Phase 1 — Bun as package manager + runtime

- [x] `bun install`; `bun.lock` created, `package-lock.json` deleted.
- [x] Rewrite scripts — **amended during implementation:** running TS source
      directly (`bun src/main.ts`) fails at boot with a TDZ error: Bun
      transpiles per-file to ESM, and `emitDecoratorMetadata` emits eager
      references into the circular TypeORM entity imports (works under tsc's
      whole-program CJS output only). Rather than churn entity files that
      Phase 2 deletes, Bun runs the built CJS output for now:
  - `start` / `start:prod` → `bun dist/main.js` ✔
  - `start:dev` stays `nest start --watch` (Node) until Phase 2 removes the
    entities, then flips to `bun --watch src/main.ts`.
  - Jest kept for now (green via `bun run test`); test-runner migration is Phase 4.
- [x] Verified under Bun runtime (`bun dist/main.js`): boots, register/login
      (argon2 native module works), repo CRUD + share-link + markdown export
      smoke matches Node baseline exactly (including the known baseline
      defects), BullMQ worker processed an export job (ioredis under Bun OK).

**Exit criteria:** met, with the dev-watch caveat above (closed in Phase 2).

## Phase 2 — TypeORM → Prisma  ✅ done

- [x] Hand-wrote `prisma/schema.prisma` (Prisma 7.8: `prisma-client` generator
      to `src/generated/prisma` with `moduleFormat = "cjs"`; connection URL
      lives in `prisma.config.ts`, not the schema; runtime uses the
      `@prisma/adapter-pg` driver adapter). Explicit
      `onDelete`/`onUpdate: NoAction` on every relation to match the DDL —
      verified with `prisma migrate diff` = **no difference** against the
      live DB.
- [x] Baseline migration `prisma/migrations/0_init/` (both SQL files, BEGIN/
      COMMIT stripped); `migrate resolve --applied 0_init` on the dev DB;
      `migrate deploy` verified on a fresh scratch database.
- [x] Global `PrismaModule` + `PrismaService` (extends generated client,
      builds URL from `DATABASE_URL` or the `DB_*` vars).
- [x] All services rewritten (auth, users, repositories, entries, tags,
      imports, exports + processor); `buildMarkdown` deduplicated into
      `export-markdown.util.ts`. Version semantics preserved: `+1` on update
      paths that previously used `save()`, no bump in reorder (matches
      TypeORM `manager.update`). `version` handled as `BigInt` →
      `Number()` at the existing response mappers.
- [x] Deleted entity classes, `data-source.ts`, `typeorm` + `@nestjs/typeorm`.
      Generated client is gitignored; `postinstall: prisma generate`.
- [x] `bun src/main.ts` now boots (entities gone) — dev scripts flipped to
      `bun --watch src/main.ts`; Phase 1 caveat closed.
- [x] Verified: build + lint + unit tests green; smoke ALL PASS including the
      three baseline id-readback defects now fixed (entry create with new
      link, tag attach with new tag, export `jobId` + job status polling);
      deep smoke ALL PASS (reorder + temp-offset transaction, stale-version
      409s, CSV import with error rows, unlisted share-token flow, ETag/
      version bumps).

**Bug fixed inline:** `PATCH .../entries/reorder` was unreachable at baseline —
declared after `@Patch(':entryId')`, so the reorder endpoint always 400'd in
the wrong handler. Moved `reorder` above the `:entryId` routes in
`entries.controller.ts` (couldn't verify the rewritten reorder logic otherwise).
The `GET :owner/:slug` shadowing bug was later fixed here too — see the
Phase 0 defect note above.

## Phase 3 — JWT/Passport → better-auth (self-hosted)

Breaking API change: `POST /api/v2/auth/{register,login,refresh,logout}` are
replaced by better-auth's endpoints mounted at `/api/v2/auth/*` (basePath).
Access for API clients continues via `Authorization: Bearer` using the
**bearer plugin**; browser clients get cookie sessions for free.

Phase complete. Implementation notes: better-auth 1.6.23; config lives in
`src/auth/auth.ts` (standalone singleton with its own Prisma client so it can
be mounted before the Nest container exists); handler mounted via
`expressApp.all('/api/v2/auth/{*any}', toNodeHandler(auth))` with Nest's global
body parser disabled and JSON/urlencoded re-added after the mount. Guards are
`AuthGuard`/`OptionalAuthGuard` in `src/common/guards`, calling
`auth.api.getSession` and mapping to the existing `AuthUser` shape — no
controller/service signature changes. Old `users.password_hash` values were
moved into `accounts.password` by `prisma/migrations/1_better_auth/` and a
pre-migration argon2 user verified working through `Bun.password`. Verified:
sign-up/sign-in (email + username), bearer token on protected routes, 401
without/after sign-out, both smoke suites ALL PASS, fresh-DB `migrate deploy`.

- [x] Install `better-auth`; create `src/auth.ts` config:
  - Prisma adapter (from Phase 2 client).
  - `emailAndPassword` with custom `password: { hash, verify }` backed by
    `Bun.password` (argon2id) so existing argon2 PHC hashes keep verifying.
  - `username` plugin (login by username or email), `admin`-style `role` via
    `user.additionalFields` (`role`, `bio`) to preserve `UserRole`.
  - `bearer` plugin for token-based API clients.
  - `advanced.database.generateId: false` → keep DB uuid-v7 defaults.
- [x] Schema: run `bunx @better-auth/cli generate`, merge `session`, `account`,
      `verification` models + new `user` fields (`name`, `email_verified`,
      `image`) into `schema.prisma`; write a Prisma migration that also
      migrates data: copy `users.password_hash` into `account` rows
      (provider `credential`), backfill `name` from `username`, then drop
      `users.password_hash`.
- [x] Mount the handler: Express middleware in `main.ts` routing
      `/api/v2/auth/*` to `auth.handler` **before** Nest's router.
- [x] Replace guards/decorator:
  - `JwtAuthGuard` → `AuthGuard` calling `auth.api.getSession({ headers })`,
    populating `request.user` as the existing `AuthUser` shape
    (`userId`, `username`, `role`) so **no controller/service changes needed**.
  - `OptionalJwtAuthGuard` → same, non-throwing.
- [x] Delete `auth.controller/service/jwt.strategy`, remove `@nestjs/jwt`,
      `@nestjs/passport`, `passport`, `passport-jwt`, `argon2` deps; drop
      `JWT_*` env vars, add `BETTER_AUTH_SECRET`, `BETTER_AUTH_URL`.
- [x] Update Swagger (bearer auth stays; document new auth endpoints or link
      to better-auth's reference).

**Exit criteria:** sign-up/sign-in via better-auth endpoints; a pre-migration
user (argon2 hash) can still log in; bearer token works on protected routes;
optional-auth routes still serve public/share-token access.

## Phase 4 — bun:test + cleanup  ✅ done

- [x] Migrate Jest specs to `bun:test` (near drop-in) — `test*` scripts become
      `bun test`; port the e2e supertest config; remove `jest`, `ts-jest`,
      `ts-node`, `tsconfig-paths` if nothing else needs them.
- [x] Remove dead code/deps, run lint + format.
- [x] Update `README.md`, `ARCHITECTURE.md`, `PROJECT_STATE.md`: new stack
      (Bun/Prisma/better-auth), new env vars, new run/migrate commands,
      auth breaking-change note for clients.

**Exit criteria:** `bun install && bun run build && bun test` green from a
clean checkout; docs match reality.

---

## Decisions locked in

| Topic | Decision |
|---|---|
| Auth transport for API clients | better-auth **bearer plugin** (Authorization header keeps working) |
| Existing password hashes | Preserved — custom `Bun.password` argon2id hash/verify |
| ID generation | DB-side uuid-v7 default kept (`generateId: false`) |
| `updated_at` | DB triggers stay authoritative; no Prisma `@updatedAt` |
| Old `/auth/refresh` token-pair flow | Removed — sessions auto-refresh; clients re-auth via better-auth endpoints |
| Migration history | Existing SQL folded into Prisma baseline migration |
| Legacy compatibility | **Removed post-migration (2026-07-03)** — the app was never deployed, so: the two migrations were squashed into a single `0_init` (final schema, no `password_hash` data shuffle), `src/database/migrations/` deleted, the `DB_*` env fallback dropped (`DATABASE_URL` with a local-dev default), and `.env` JWT vars removed. argon2id via `Bun.password` is kept as a deliberate choice over better-auth's default scrypt, not as compat. Dev DB was recreated from the squashed baseline; build/lint/tests/smokes all green. |
