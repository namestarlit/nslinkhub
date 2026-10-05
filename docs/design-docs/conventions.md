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

## Typed errors and safe details

`packages/types/src/errors.ts` owns the product API's error catalog, status and
safe fallback text. `ApiError.error` is a discriminated union: narrowing its
`code` narrows `details`. Clients branch on codes and own user-facing copy;
`apiErrorDefinition(unknownCode)` provides a safe fallback for newer servers.
Never render arbitrary remote exception text as trusted content.

Application services throw the backend-only `appError(code, details?)`.
`AllExceptionsFilter` recognizes that instance; ordinary Nest/framework
exceptions are mapped by HTTP status, and their messages, codes, objects and
stacks are discarded. A payload that merely claims `dependencies_unavailable`
or `validation_failed` receives no privileged treatment. Unexpected failures
are sanitized and captured once by the telemetry boundary. Hidden and absent
collections both return the identical safe `not_found` shape (apart from the
request ID). SQL errors never expose driver messages or database metadata.

Useful actionable codes include:

| Code | Meaning for a client |
| --- | --- |
| `validation_failed` | Highlight declared fields using `details.issues` |
| `invalid_cursor` | Discard the cursor and reload the first page |
| `version_conflict` | Reload current state before retrying the edit |
| `slug_conflict`, `handle_unavailable`, `email_conflict` | Choose another value |
| `handle_invalid`, `handle_reserved` | Correct the requested handle |
| `duplicate_resource`, `position_conflict` | Resolve the existing resource/order |
| `invalid_reorder`, `invalid_nesting`, `invalid_transfer` | Correct the operation |
| `transfer_requires_editor` | Grant the recipient editor access first |
| `collection_not_published` | Saving requires publication |
| `too_many_requests` | Respect Retry-After before another attempt |
| `service_unavailable`, `dependencies_unavailable` | Show a retryable unavailable state |

Other failures use safe generic status codes such as `bad_request`,
`unauthorized`, `forbidden`, `not_found`, `conflict`, and `internal_error`.
The catalog is authoritative; do not duplicate message-to-code parsing.

Validation now returns `details: { issues: [{ field, rule }] }`, replacing
`details.messages`. Field paths come only from class-validator DTO metadata;
`*` denotes an array item and `$` an unspecified/unknown field. A submitted
unknown property name is never reflected. Rules are a bounded union, not
constraint messages. At most 32 distinct issues and eight nested levels are
reported; neither submitted values nor validation targets leave the server.
UUID/JSON parser failures use a safe generic `bad_request`.

The only other nonempty details variant is readiness:
`dependencies_unavailable` includes the existing `{ dependencies: { postgres,
redis_queue } }` shape, with only `ready`/`unavailable` values. `redis_queue`
is a preserved pre-existing wire-key exception to the general casing rule.
All remaining codes carry `{}`.

The raw `/api/v1/auth/*` handler retains better-auth's own response protocol;
it runs ahead of Nest's filter. The shared endpoint budget can still reject a
request before that handler using the product error envelope. The W3 auth
adapter must normalize these protocols deliberately, without changing raw
handler/body-parser ordering.

## Wire-contract verification

Profile, collection, resource, share, shared/saved, hub-page, audit and status
mappers compile against `@nslinkhub/types`. Dates become ISO strings explicitly
at the serialization boundary. Persisted role/source/kind strings are validated
against their wire unions rather than hidden behind type assertions. Responses
are selected field-by-field; adding a database column cannot silently expose it.

`apps/api/test/wire-contracts.e2e.spec.ts` checks actual JSON keys, nullability,
timestamp strings, omitted optional resource URLs, pagination and ETags through
`configureApp`. Its expected shapes are themselves checked against shared types.
It covers private/missing 404 equivalence, direct-versus-link-share email
privacy, dormant saves, readiness states and malicious validation/error inputs.
Expand these checks as new slices ship. Nest DTOs and Swagger stay in place;
a Zod or generated-client migration still requires its own evidence and plan.
