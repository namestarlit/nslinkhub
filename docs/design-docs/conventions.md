# API & Persistence Conventions

Small, load-bearing rules that every module follows. Casing is the recurring
one, because three layers meet here.

## Casing

- **JSON field keys → camelCase.** Every request and response key is
  camelCase: `hubId`, `parentCollectionId`, `linkSharingEnabled`,
  `requestId`, `nextCursor`. No snake_case keys in payloads, ever. The whole
  stack is TypeScript (Prisma models, DTOs, response mappers, and both future
  clients), so camelCase keeps payloads transform-free from the database row
  to the client.
- **Machine-token values → `lower_snake`.** Values that a client matches on
  programmatically — not prose — are lowercase snake tokens: error codes
  (`not_found`, `validation_failed`), resource kinds (`external_link`,
  `collection_link`), share roles (`reader`, `editor`), share sources
  (`direct`, `link`), export formats (`markdown`, `pdf`,
  `docx`). This is deliberately distinct from field keys and
  is the common convention (HTTP, OAuth, Stripe error codes).
- **Database columns → snake_case**, mapped to camelCase model fields with
  Prisma `@map`/`@@map` (`hub_id` ↔ `hubId`). PostgreSQL folds unquoted
  identifiers to lowercase, so camelCase columns would force double-quoting
  in every raw SQL statement — and this project has substantial raw SQL
  (migration triggers, functions, CHECK constraints). snake_case columns keep
  that SQL and `psql` clean; the `@map` verbosity in `schema.prisma` is the
  one-time cost that buys it.

The only real mistake is mixing key casing across endpoints. Keys are
camelCase everywhere; hold the line.

## Response envelope

- Success: `{ "data": ..., "meta"?: ... }`.
- Failure: `{ "error": { "code", "message", "requestId", "details" } }`.
- Every response carries a server-generated `X-Request-Id` header.
- Growth-prone lists paginate by opaque cursor: `meta: { limit, nextCursor }`.

See `docs/runbooks/verification.md` and the Phase A exec-plan for the
originating decisions.

## Before Web Contract Consumption

The foundation gate in `adoption-decisions.md` adds a typed error catalog,
safe exception mapping, and checks connecting response mappers and HTTP
serialization to `@nslinkhub/types`. These are planned, not implemented.
Keep the current envelope (including `details`), camelCase keys, ISO-string
timestamps, and existence-hiding `not_found` behavior. Clients branch on
stable codes and own user-facing copy, never parse an exception message.

Retain Nest DTOs/class-validator and Swagger for this gate. A wholesale Zod
or generated-client migration is deferred; the immediate requirement is
mechanically checked wire contracts. Validation errors should expose bounded
field/rule identifiers, never submitted values; arbitrary 5xx messages and
details must not reach clients.
