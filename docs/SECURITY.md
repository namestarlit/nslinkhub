# Security

## Tenant Isolation

- The hub is the tenant boundary. Every hub-owned query carries `hubId`;
  collection-scoped lookups resolve the collection first and carry its hub.
- Route IDs never prove access. Possession of a UUID grants nothing.
- Data-access methods make unscoped queries hard to express; tenant scoping
  is verified by integration tests, not convention alone.

## Authorization

- The API is the source of truth. UI hiding is never a security rule.
- Hub roles (`owner | admin | member`) are enforced in backend guards and
  policy services. The last-owner rule is enforced server-side.
- Collection access resolves through one policy service, first match wins:
  published → anyone reads; hub membership → per hub role; direct share →
  per share role; active link + valid token → read; otherwise → not found.
- `editor` shares are content-only: no publication, no share management, no
  deletion, no wider hub access.
- Prefer `404` over `403` for resources the caller cannot know exist.

## Tokens And Secrets

- UUIDv7 identifiers are not secrets. Anything secret-bearing (share links,
  invitation tokens, verification challenges) uses separate random,
  expiring, purpose-bound values, stored hashed, submitted in POST bodies —
  never in path parameters, telemetry, or logs.
- Share-link rotation and disabling take effect immediately, including for
  link-derived shared/ access.
- Application secrets reach services through deployment-secret `_FILE`
  inputs; never logged, never baked into images, never committed.

## Authentication Boundary

- Self-hosted better-auth owns credentials (argon2id via `Bun.password`),
  sessions, and verification primitives. The product owns identity,
  membership, authorization, and workflows.
- Session resolution goes through `resolveSessionUser`
  (`src/common/guards/auth.guard.ts`); services consume `AuthUser`, never
  better-auth types.
- Sign-up onboarding is app-owned and auth-path-agnostic so SSO
  (`docs/design-docs/identity-sso.md`) can be added without weakening any
  invariant.
- Account linking (SSO or otherwise) is explicit: verified-email match or an
  authenticated linking step — never silent takeover.

## Boundary Validation

- External input is validated at HTTP and upload boundaries (global
  `ValidationPipe` with whitelist + forbidNonWhitelisted; file size/type
  checks on imports).
- Import parsers must fail per-row with clear errors rather than corrupting
  state.

## Auditability (target state)

- Sensitive actions — hub lifecycle, invitations, membership and role
  changes, ownership transfer, publication changes, share-link rotation —
  produce tenant-scoped audit records in PostgreSQL (hub design doc,
  deferred list).

## Personal Data

- Store the minimum: email, display name, optional bio/image.
- Logs and any future telemetry are PII-free; request IDs are
  server-generated and never echo caller input.
