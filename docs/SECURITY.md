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
  authorization, and workflows.
- Session resolution goes through `resolveSessionUser`
  (`src/common/guards/auth.guard.ts`); services consume `AuthUser`, never
  better-auth types.
- Sign-up onboarding is app-owned and auth-path-agnostic so SSO
  (`docs/design-docs/identity-sso.md`) can be added without weakening any
  invariant.
- Account linking (SSO or otherwise) is explicit: verified-email match or an
  authenticated linking step — never silent takeover.

## Origins, CORS, and CSRF

**There is deliberately no CORS configuration anywhere, and none is missing.**
Recorded so a future security review doesn't read the absence as an oversight:

- CORS is not an access-control mechanism — it is the server *relaxing* the
  browser's Same-Origin Policy so foreign origins may read it. Configuring
  nothing means no relaxation was ever granted: browser scripts on any other
  origin cannot read API responses, enforced by every browser, at full
  default strength. The absence *is* the implementation.
- Nothing needs the relaxation by design: the web app is same-origin with the
  API (one public origin, Traefik path-routes `/api/*`; Next.js rewrites in
  dev — `docs/design-docs/infra-deployment.md` § Origins), and the W4
  extension fetches with `host_permissions` + bearer tokens, outside page
  origin rules.
- CORS could never be the security boundary anyway: non-browser clients
  (curl, servers, apps) do not enforce the Same-Origin Policy. Real access
  control is authentication (sessions/bearer) + `CollectionPolicyService` —
  per the invariant that client-side behavior is never a security rule.
- **CSRF is the adjacent, separate concern**: without CORS a foreign page
  still *sends* "simple" requests (e.g. form-encoded POSTs) with cookies
  attached — it just cannot read the response. Exposure is small by
  construction: API writes take JSON bodies (a JSON `Content-Type` forces a
  preflight, which fails without CORS headers, so the request never leaves
  the browser), and better-auth applies its own origin checks and `SameSite`
  cookie attributes on auth endpoints. **Rule: any future state-changing
  endpoint that accepts a "simple" request shape (form-encoded/multipart
  from browsers — imports are the current multipart surface, guarded by
  bearer/JSON-first clients today) must add explicit CSRF protection at that
  moment.**
- Adding a second public origin later is a deliberate act: CORS with exact
  origins + credentials + exposed headers, together with better-auth
  `trustedOrigins` — never a wildcard.

## Boundary Validation

- External input is validated at HTTP and upload boundaries (global
  `ValidationPipe` with whitelist + forbidNonWhitelisted; file size/type
  checks on imports).
- Import parsers must fail per-row with clear errors rather than corrupting
  state.

## Auditability (target state)

- Sensitive actions — hub lifecycle, share and role changes, ownership
  transfer, publication changes, share-link rotation, account email change —
  produce tenant-scoped audit records in PostgreSQL (hub design doc,
  deferred list).

## Personal Data

- Store the minimum: email, display name, optional bio/image.
- Logs and any future telemetry are PII-free; request IDs are
  server-generated and never echo caller input.
