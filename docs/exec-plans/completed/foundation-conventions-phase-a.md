# Foundation conventions: error envelope, request IDs, config validation, cursor pagination (Phase A)

This ExecPlan is a living document. Maintain it according to `PLANS.md`.

## Purpose / Big Picture

Phase A of `docs/SYSTEM_DESIGN.md`: the API contracts that
must lock before any client exists. After this change, every failure returns
the stable envelope `{ "error": { code, message, requestId, details } }`
with a server-generated request ID (also on successes as `X-Request-Id`),
startup fails fast on malformed configuration, and the growth-prone lists
(resources/entries, public collections/repositories) paginate by opaque
cursor. Observable: `curl /api/v1/repositories/not-a-uuid/entries` returns
the envelope with a stable code; listing endpoints return
`meta: { limit, nextCursor }` and following `nextCursor` walks the full set.

## Progress

- [x] (2026-07-03) Request-ID middleware (`src/common/middleware/request-id.ts`),
      mounted before the better-auth handler in `configureApp`.
- [x] (2026-07-03) Global catch-all filter
      (`src/common/filters/all-exceptions.filter.ts`) emitting the envelope;
      validation arrays → `validation_failed` + `details.messages`; unknown
      errors → logged server-side, generic `internal_error`.
- [x] (2026-07-03) Startup validation (`src/config/env.validation.ts`) wired
      via `ConfigModule.forRoot({ validate })`; `PORT=abc` fails boot with an
      aggregate message (verified).
- [x] (2026-07-03) Cursor pagination: entries keyset on `position`, public
      listing keyset on `(updatedAt, id)`; `meta { limit, nextCursor }`.
- [x] (2026-07-03) E2E coverage in `test/foundation.e2e.spec.ts` (6 tests);
      `bun run verify` green (build + lint + unit + 11 e2e); both smoke
      suites ALL PASS; live spot checks confirmed.
- [x] (2026-07-03) Docs + CHANGELOG updated; plan moved to `completed/`.

## Surprises & Discoveries

- Observation: `ParseUUIDPipe` failures arrive as string-bodied
  BadRequestExceptions, so they map to `bad_request` rather than
  `validation_failed` (which is reserved for DTO constraint arrays). Kept —
  the distinction is meaningful and both codes are stable.
  Evidence: `GET /repositories/not-a-uuid/entries` →
  `{"error":{"code":"bad_request","message":"Validation failed (uuid is expected)",...}}`.

## Decision Log

- Decision: Stable error codes are status-derived defaults
  (`bad_request`/`validation_failed`, `unauthorized`, `forbidden`,
  `not_found`, `conflict`, `payload_too_large`, `unsupported_media_type`,
  `internal_error`) with an override hook for future domain codes.
  Rationale: today's exceptions are thrown as plain Nest HttpExceptions;
  domain-specific codes arrive naturally with the Phase B/C rework.
  Date/Author: 2026-07-03 / namestarlit
- Decision: `getChildren` keeps page/limit for now.
  Rationale: it filters visibility in memory after the query, which breaks
  keyset math; Phase C replaces that access path entirely (policy service),
  and cursoring it now would be redone.
  Date/Author: 2026-07-03 / namestarlit
- Decision: Cursor pagination drops `total` from paginated meta.
  Rationale: totals require a second count query that keyset pagination
  exists to avoid; no client depends on it yet.
  Date/Author: 2026-07-03 / namestarlit
- Decision: better-auth routes keep better-auth's own error shape.
  Rationale: they are mounted as raw middleware ahead of Nest; wrapping them
  would mean proxying the handler. Request IDs still cover them (middleware
  mounts first).
  Date/Author: 2026-07-03 / namestarlit

## Outcomes & Retrospective

Shipped as planned with no new dependencies. The envelope, request ids, and
cursor meta are now locked contracts for Phase B/C and the future clients;
`getChildren` deliberately remains page/limit until the Phase C access-path
rework (decision log). Nothing in the existing smoke suites or e2e needed
weakening — the envelope preserves `message`, which is what they grep.

## Context And Orientation

Backend at `apps/api` (Bun workspace, W1 complete). Requests flow through
`app.setup.ts` (`configureApp`): better-auth handler on
`/api/v1/auth/{*any}` first, then json/urlencoded parsers, then the global
`ValidationPipe`. Successes use `apiOk` (`src/common/utils/response.util.ts`)
producing `{ data, meta? }`. Errors are currently Nest's default shape
(`{ message, error, statusCode }`). Listing endpoints
(`entries.controller.ts` `getByRepository`, `repositories.controller.ts`
`getPublic`, `getChildren`) use `PaginationQueryDto` (page/limit) and return
`meta { page, limit, total }`. Config is read via `@nestjs/config` with
in-code defaults; nothing validates env shape at startup.

## Plan Of Work

1. `src/common/middleware/request-id.ts`: express-level middleware
   generating `req_<random>` ids, attaching to the request and the
   `X-Request-Id` response header; mounted in `configureApp` before the
   better-auth handler.
2. `src/common/filters/all-exceptions.filter.ts`: `@Catch()` filter mapping
   HttpExceptions (including ValidationPipe's BadRequestException with
   message arrays → `details.messages`) and unknown errors (500, generic
   message, server-side log) to the envelope. Registered globally in
   `configureApp` so e2e exercises it.
3. `src/config/env.validation.ts`: `validateEnv(config)` checking PORT /
   REDIS_PORT are ports, DATABASE_URL is a postgres URL, BETTER_AUTH_SECRET
   has sane length when set; aggregate errors thrown at startup. Wired via
   `ConfigModule.forRoot({ validate })`.
4. Cursor utilities `src/common/utils/cursor.util.ts` (base64url JSON
   encode/decode) + `src/common/dto/cursor-query.dto.ts`
   (`cursor?`, `limit` 1..100 default 20). Entries list: keyset on
   `position asc`. Public repositories: keyset on `(updatedAt, id) desc`.
   `take limit+1` determines `nextCursor`.
5. E2E additions in `test/` covering envelope, request id, and a cursor
   walk; update anything that asserted the old meta/error shapes.

## Concrete Steps

```bash
docker compose up -d
bun run verify
```

Manual spot checks:

```bash
curl -si localhost:3000/api/v1/repositories/not-a-uuid/entries | grep -i x-request-id
curl -s  localhost:3000/api/v1/repositories/not-a-uuid/entries   # error envelope
curl -s 'localhost:3000/api/v1/repositories/public?limit=2'      # meta.nextCursor
```

## Validation And Acceptance

- Every non-2xx from Nest routes is the envelope; codes stable per the
  decision log; `requestId` present and matching the `X-Request-Id` header.
- Malformed env (e.g. `PORT=abc`) fails startup with an aggregate message.
- Cursor walk over entries returns each item exactly once, in order, ending
  with `nextCursor: null`; same for the public listing.
- `bun run verify` green; both smoke suites still pass (they grep message
  substrings, which the envelope preserves).

## Idempotence And Recovery

Pure code change — no schema or data migrations. Recovery is git.

## Artifacts And Notes

(Fill during implementation.)

## Interfaces And Dependencies

- `{ data, meta }` success shape unchanged; `apiOk` untouched.
- New public contracts: error envelope, `X-Request-Id`,
  `meta { limit, nextCursor }` on entries + public listings.
- No new dependencies.
