# Security

## Tenant Isolation

- The hub is the tenant boundary. Every hub-owned query carries `hubId`;
  collection-scoped lookups resolve the collection first and carry its hub.
- Route IDs never prove access. Possession of a UUID grants nothing.
- Data-access methods make unscoped queries hard to express; tenant scoping
  is verified by integration tests, not convention alone.

## Authorization

- The API is the source of truth. UI hiding is never a security rule.
- Each user owns one hub. There are no hub memberships, admin roles, or
  administrative access bypasses.
- Collection access resolves through `CollectionPolicyService`: hub owner
  (full access) → direct share (reader/editor) → active link → published;
  grants inherit down the collection ancestor chain. Otherwise return not found.
- `editor` shares are content-only: no publication, no share management, no
  deletion, no wider hub access.
- Prefer `404` over `403` for resources the caller cannot know exist.

## Tokens And Secrets

- UUIDv7 identifiers are not secrets. Share links use separately generated,
  hashed, rotatable tokens. The existing read contract accepts `?s=<token>`;
  scrub query strings from logs/telemetry and prevent referrer leakage on the
  web. Auth verification challenges are expiring and purpose-bound; consuming
  proof requires POST, never a state-changing GET. Do not conflate share-link
  reads with the one-time auth challenge lifecycle.
- Share-link rotation and disabling take effect immediately, including for
  link-derived shared/ access.
- Application secrets reach services through deployment-secret `_FILE`
  inputs; never logged, never baked into images, never committed.

## Authentication Boundary

- Self-hosted better-auth owns verification proofs,
  sessions, and verification primitives. The product owns identity,
  authorization, and workflows.
- Session resolution goes through `resolveSessionUser`
  (`apps/api/src/common/guards/auth.guard.ts`); services consume `AuthUser`, never
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
- **CSRF is a separate concern**: a cross-origin page can send simple requests
  even when it cannot read the response; whether cookies accompany them also
  depends on cookie/site policy. JSON preflight is not sufficient protection
  for every route: imports accept multipart and some commands are bodyless.
  The HTTP boundary now rejects every unsafe request carrying a session cookie
  unless its Origin exactly matches `BETTER_AUTH_URL`, including multipart,
  bodyless actions and bearer-plus-cookie requests. Missing/null/foreign
  origins fail closed; cookie-free bearer clients remain supported. Auth routes
  additionally retain better-auth origin checks. Browser fixtures exercise
  issuance, session reads and origin enforcement through the actual web origin.
  Each future mutation UI still owes its own end-to-end acceptance.
- Adding a second public origin later is a deliberate act: CORS with exact
  origins + credentials + exposed headers, together with better-auth
  `trustedOrigins` — never a wildcard.

## Boundary Validation

- External input is validated at HTTP and upload boundaries (global
  `ValidationPipe` with whitelist + forbidNonWhitelisted; file size/type
  checks on imports).
- Import parsers must fail per-row with clear errors rather than corrupting
  state.
- Product HTTP errors use a shared catalog and an explicit trusted exception
  boundary. Arbitrary framework messages/details are discarded; validation
  exposes only declared DTO field paths and bounded rule identifiers. Unknown
  input field names, submitted values and SQL errors are never reflected in
  error envelopes. Raw better-auth keeps its own protocol; see conventions.

## Auditability

Collection publication (including published creation), deletion, direct-share
changes, link enable/rotation/disable, ownership transfer and hub-handle changes
now write `audit_records` inside the same PostgreSQL transaction as the action.
The audit row has typed action, immutable actor/hub/collection/target-user IDs,
optional role and database timestamp; no email, handle, token or authored text.
Collection management rechecks ownership under a row lock before mutation.

`GET /api/v1/me/audit` resolves the authenticated owner's hub; neither caller
hub IDs nor another hub's pagination cursor can widen access. Each read also
records `audit.read`. Transfers write source/recipient events, and historical
rows stay with their original hub. Audit identifiers deliberately have no
cascading foreign keys: deleting a collection cannot erase its history.

There is no audit purge or public account-deletion retention policy yet.
Account deletion is disabled: the profile DELETE route is removed and
better-auth delete-user stays explicitly disabled. Profile writes no longer
accept email/password. Password authentication is disabled in better-auth and
its public signup, login, enrollment, change and reset routes are unavailable.
Email handover revokes every session; the former owner has no password path
back into the account. Re-enabling deletion requires
verified proof and a reviewed retention policy. See
[auth integration](design-docs/auth-delivery-integration.md).
Auth security outcomes, double-verified email changes and all-session
revocation are transaction-bound. Shared identity budgets complement source
throttles; codes expire after five minutes with three wrong attempts allowed.
Auth audits retain 90 days; collection audit/deletion policy remains separate.

## Abuse protection

Every non-probe request admitted by the browser-origin boundary consumes an atomic PostgreSQL-backed source budget,
shared by replicas: auth 30/minute, imports/exports 10/minute, other writes
60/minute, reads 300/minute. The HTTP boundary runs before better-auth/body
parsing, returns 429 plus Retry-After, and fails closed with a safe 503 when
the budget store fails. Liveness/readiness GETs remain available.

Store only a namespaced HMAC of scope/source using the auth secret, not raw IP
addresses. Rotating the secret resets effective budgets. Trust no forwarded
source by default; `TRUSTED_PROXY_CIDRS` accepts explicit addresses/CIDRs only.
Configure the actual ingress boundary before deployment. These conservative
per-source limits share capacity for users behind NAT and are not a distributed
attack solution. Add account/challenge limits in auth delivery and ingress
connection/body limits during live deployment.

Web server rendering preserves the visitor's source budget through signed
attribution. `apps/web/server.ts` derives the source from its socket, walking
forwarded addresses only through explicit `WEB_TRUSTED_PROXY_CIDRS` hops, and
overwrites any caller-supplied `x-web-read-source`. Server reads forward this
30-second HMAC proof to the API. Only the read budget accepts verified proofs;
invalid/absent proofs use the normal API socket/proxy source. They carry no
authentication or authorization. API and web share an independent
`WEB_SOURCE_SECRET` (at least 32 random characters, `_FILE` in production).
Do not log the proof or expose it in browser data. The web entry point requires
this secret; invoking `next start` directly bypasses this boundary and is unsupported.
Ingress must overwrite incoming forwarding headers and both services must trust
only its actual addresses. Until that topology is configured, no forwarded IP
is trusted. Root `bun run dev` supplies an ephemeral shared secret with no web
proxy trust, so direct local connections work without extra setup.

Expired counters are pruned in bounded batches; audit history is retained
until its separate policy is decided. Both stores are product persistence,
never external telemetry payloads.

## Personal Data

- Store the minimum: email, display name, optional bio/image.
- Logs and API telemetry use a strict allowlist; request IDs are
  server-generated and never echo caller input.
