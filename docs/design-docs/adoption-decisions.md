# Foundation adoption decisions before W3

Decision date: 2026-10-05. This document owns the adoption sequence and gates;
focused designs own the resulting contracts. **Decided does not mean built.**
The comparison itself was documentation-only; current implementation status
is recorded below. Product scope remains unchanged.

**Execution order updated 2026-10-05:** the user selected public-release
foundations first (#4), then contracts (#1), W3 design (#2), and auth delivery
(#3) before web implementation/browser acceptance (#2). The gate numbers below
retain their meaning as acceptance groups, not chronological order. The local
release foundation is recorded in
`docs/exec-plans/completed/deliver-release-foundations.md`. Live rollout remains
a separate operator acceptance step; the email worker now has local acceptance,
while browser acceptance awaits `apps/web`.

## Local #4 implementation status (2026-10-05)

Implemented API LogTape/Sentry privacy/correlation, transactional hub-scoped
collection audit, shared source request budgets, a compiled API image, local
and production Swarm files, verification/image-release workflows and the
[release runbook](../runbooks/release.md). Isolated e2e databases and CI were
pulled forward from #1 to verify #4 safely. Gate #3 subsequently added email
jobs with isolated per-run queue namespaces and cleanup.

By user direction, live infrastructure comes later. Swarm scheduling, GHCR publication, Dokploy/TLS, off-host restore and shared Alloy/
Sentry operation are outstanding proof, not implied by local tests. Browser
instrumentation and worker metrics/tracing remain outstanding. Gate 4 as a public-release
gate remains open. The local foundation milestone is complete, and the
reviewed #4 artifact plus CI portability fix passed hosted verification
(`cb00a75`; evidence in the release runbook).

Review discovered pre-existing profile credential writes and account deletion
outside better-auth. Gate #3's boundary milestone removed those paths;
password authentication has now been removed by explicit user decision.
Verified email handover revokes sessions; a policy for re-enabling deletion
remains a pre-release requirement.

## Local #1 implementation status (2026-10-05)

The shared discriminated error catalog, trusted application exceptions, safe
framework/DTO mapping and explicit wire mappers are implemented. HTTP tests
cover W3 reads, serialization/nullability, sharing privacy, hidden-resource
404s, actionable conflicts and malicious error inputs. Verification includes
local Markdown links and concurrent disposable-database success/failure/SIGTERM
cleanup. Gate #3 extends that isolation to email queue namespaces. See
[the completed foundation-contracts plan](../exec-plans/completed/finish-foundation-contracts.md).

The reviewed milestone and isolation-check correction are committed as
`fb32eb9`, with guide pin `bf111f1`, and pushed after the full verification gate.

The auth wrapper added in #3 owns its public code/email-change protocol;
browser cookie/CSRF/cache acceptance remains in #2. The sequencing update below
owns the next implementation step.

**User sequencing update (2026-10-05):** after the reviewed W3 design milestone
(`6d27cbe`, guide pin `a8802c5`), proceed with #3 auth delivery before the web
scaffold. Gate #2's implementation/browser checks remain outstanding. The
initial [auth integration evidence](auth-delivery-integration.md) records the
pinned library gaps and the implemented transaction-scoped integration. The
user approved email-code-only authentication, removing password fallback; TOTP and
recovery codes follow separately. Delivery is implemented and tested locally,
including auth audit, encrypted outbox, worker recovery, independent suppression
keys and signed receipt reconciliation after code expiry. The
[auth-delivery plan](../exec-plans/active/prove-auth-delivery-boundary.md)
records verification and review corrections. Review and land this milestone
before web scaffolding; live acceptance and web account screens remain outstanding.

## Gate #2 design status (2026-10-05)

The three W3 design documents now define the
[experience](web-product-experience.md), [interface](web-interface-system.md)
and [tokens](web-design-tokens.md). They cover public reading first, actual
API fields, unavailable states, cookie/cache/CSRF boundaries and later account
flows. The design milestone does not claim that the web app or its browser
acceptance exists. Scaffolding and the first read journeys follow the selected
auth work; gate #2 remains open until its implementation checks pass.

## Baseline and evidence

Compared NSLinkHub `25df1ab` with the clean Pigfarm checkout at
`f0bab0ab8a9d5ec4b09c8804ab95c7ee6a9a0e9c` (2026-10-03), read through
`../../hashikome/pigfarm`. Source paths in the evidence inventory below are
relative to that pinned reference repository. It is evidence, not an ongoing
dependency: these decisions remain understandable without that checkout.
Reference tests were inspected, not executed; their presence is not a claim
that Pigfarm's current deployment has been verified here.

NSLinkHub already has the individual-hub backend, shared wire types, client
import boundaries, Bun/Biome, `_FILE` secrets, request IDs, dependency readiness,
three email templates, a freshness-pinned walkthrough, and verified pushes.
`apps/web` and `apps/extension` do not exist. At the comparison baseline there was no email sender, outbox, worker,
structured telemetry, release pipeline, or deployment artifact.

Two reference claims need qualification:

- Pigfarm's ADR-0005 accepts Zod as the schema source, but its API manifest
  still uses class-validator and class-transformer, and the inspected source
  has no `createZodDto` / `ZodResponse` implementation. Treat that as a design
  proposal to evaluate, not a proven migration to copy.
- Pigfarm implements LogTape/Sentry request context and email workers, but its
  observability plan still leaves worker metrics and shared Alloy rollout
  unfinished. Its checkout has verification CI, not Dockerfiles or production
  stack files. Do not describe its operational rollout as complete.
- Its current API mounts `browserCors`, and its browser client permits an
  explicit API origin. Adopt its centralized client/session handling, not that
  cross-origin configuration: NSLinkHub retains one public origin. Its browser
  smoke fixture also replaces a stored sign-in code; our auth-delivery gate must
  additionally prove the real local-capture path, not just fixture-assisted UI.

## Comparison and decisions

Evidence IDs resolve to concrete source paths below. Gap descriptions in this
table refer to the pinned comparison baseline; implementation status above owns
the current state. Timing refers to the acceptance gates in the next section.

| Area | Reference evidence and local gap | Decision and timing |
| --- | --- | --- |
| Repository workflow | R1; walkthrough, pin, pre-push verification already adopted | Keep existing workflow. Add local Markdown-link checking with foundation verification; do not import Pigfarm's whole documentation taxonomy. |
| Test isolation | R2 creates a disposable database; local e2e uses the development database | Adopt per-run database and queue isolation in gate 1, before adding auth/outbox tests. Never reset the developer database as a test prerequisite. |
| Verification tiers and CI | R2 separates fast verification from required infrastructure tests; NSLinkHub has only the full local gate | Add CI with explicit required infrastructure coverage. Keep current `bun run verify` semantics until both tiers are available; missing services must not silently turn the required gate green. |
| Typed errors | R3 has a discriminated error catalog; local `ApiError.code` is arbitrary text and the filter forwards arbitrary HttpException messages/details | Adopt a local error catalog and safe exception mapping in gate 1. Preserve the existing envelope and hidden-resource 404 semantics; do not copy Pigfarm's codes or remove `details`. |
| Contract drift | R3 proposes Zod; local DTOs, mappers, Swagger, and `packages/types` can drift | Keep class-validator/Nest compilation. Add wire-contract checks for W3 reads in gate 1 and expand per slice. Defer a Zod/OpenAPI-generator migration until drift evidence warrants its own plan. |
| Configuration | R4 has typed runtime entry points and a config boundary check; local `packages/config` only contains TypeScript configuration | Adopt runtime-specific typed config when the web or worker creates the second runtime (gate 2). Preserve local defaults, `_FILE` precedence, and server-only secrets. No wholesale env-var rename or dependency upgrade. |
| Auth composition | R5 injects configuration, persistence, and delivery into a factory; local auth creates a separate Prisma client at module load | Adopt explicit auth dependencies with the auth-delivery slice, maintaining raw-handler ordering, `resolveSessionUser`, and app-owned onboarding. Avoid copying Pigfarm's large authority/plugin graph. |
| Sign-in product | R5 is closed-registration, code-only, no passwords or sign-in links; local product requires self-service sign-up and email codes only (password removal approved 2026-10-05) | Retain NSLinkHub's product contract. Adopt tested challenge expiry, replay prevention, enumeration resistance, and issue/verify budgets through better-auth's boundary in gate 3. |
| Email change and sessions | R5 uses purpose/session-bound proof and factor-specific revocation; local double-verification exists only as a design/templates | Implement current-address confirmation, new-address verification, then revoke **all** sessions in gate 3. Do not copy Pigfarm's keep-current-session factor-change policy. |
| Async delivery | R6 has transactional outbox, queue adapter, worker, leases, terminal failures, and maintenance; local BullMQ is unused | Adopt the small provider/queue seams and failure tests in gate 3. Email is the first consumer; synchronous exports stay synchronous. No general domain-event framework yet. |
| Email credential retention | R6 removes credential-bearing render inputs after terminal outcomes and sweeps abandoned intents | Adopt explicit retention and cleanup with delivery. A hashed auth challenge does not protect a plaintext copy in an email intent. Include provider-success/DB-failure recovery and do not promise exactly-once external sends. |
| Telemetry | R7 implements LogTape + Sentry; local direction still says Pino + separate OTel pipeline | Replace the direction with LogTape, Sentry-owned application traces/errors, and shared Alloy collection of stdout/dependency metrics. Prove compatibility locally before installing it; land by gate 4. |
| Readiness/status | R7 separates public aggregate status from internal dependency probes; local public `/status` returns dependency details | Keep current routes and wire shape for W3. Render a friendly aggregate state in the web. Revisit public/internal probe separation at deployment with an explicit contract change, not a silent copy of reference names or snake_case fields. |
| Browser/API boundary | R8 centralizes HTTP/session handling; local web client is absent | Adopt one same-origin browser client, bounded server reads, explicit cookie forwarding to the trusted API only, and session-expiry handling in gate 2. No browser bearer storage or client-side authorization. |
| Rendering/cache | R8 uses static presentation and uncached authenticated data; local caching decisions are absent | Adopt the boundary, not an untested framework option: no shared cache for profile, shares, saved content, tokens, or access decisions. Start collection/explore reads uncached too; publication removal must take effect. Evaluate framework-specific cache settings in W3. |
| Browser safety | R5/R8 exercise real auth journeys; local imports accept multipart and cookie writes are not browser-tested | Gate 2 must prove CSRF protection for every cookie-authenticated mutation, including multipart imports and bodyless actions; same-origin routing alone is insufficient. Prove auth base URL, origin trust, cookies, redirects, and downloads through the web origin. |
| Interface and browser verification | R8 has real journeys, state coverage, keyboard/responsive checks; local three web designs remain planned | Adopt journey-based delivery and browser acceptance per W3 slice. Design NSLinkHub's own collection experience; do not copy the farm dashboard, role navigation, fonts, or tokens. |
| Localization/theme | R8 has `/en` and `/sw` routes and persisted theme; NSLinkHub has fixed durable URL shapes and no locale requirement | Defer locale-prefixed routes and theme implementation choices to an explicit product need/W3 design. Preserve `/c/<id>`, `/@handle`, and `/@handle/<slug>`. Keep user-facing copy separate from error codes. |
| Deployment | R9 has CI and infrastructure direction, with no app images/stack artifacts in the inspected checkout | Retain namestarlit VPS, Dokploy Stack, GHCR SHA-pinned images and +4 local ports. Build and prove NSLinkHub artifacts at gate 4; do not import Hashikome topology or credentials. |
| Audit and retention | R5/R9 distinguish internal audit and workflow retention; local audit is absent | Add auth-delivery security outcomes with gate 3; complete hub-scoped publication/share/transfer audit before public release. Correct the already-exposed profile DELETE route through a decided account-deletion/retention contract before public release; no generic purge engine now. |
| Product-specific machinery | R5/R8/R9 include organizations, platform authority, invitations, Google linking, MFA, mobile credentials and farm workflows | Do not adopt these as W3 prerequisites. No admin bypass, memberships, invitations, organization switcher, mobile/offline layer, commercial machinery, or alternative identity provider by implication. nsauth stays the decided future SSO direction. |

## Delivery order and acceptance gates

### Gate 0 — decisions before W3 design

This comparison, the reconciled focused docs, and the debt tracker are the
deliverable. The user reviews this documentation milestone before commits.
W3 design can then produce the three planned `web-*` documents. No app
scaffolding belongs in this comparison. Impeccable applies to subsequent
interface work under repository guidance, not to adopting farm-product screens.

### Gate 1 — foundation before web implementation

Completed and committed in `docs/exec-plans/completed/finish-foundation-contracts.md`,
available for `apps/web` to consume. The auth-delivery worker now uses isolated
queue namespaces in its tests.

Acceptance:

- Two test runs use distinct disposable databases and queue namespaces;
  success, failure, and interruption clean up only owned test resources.
  Production configuration is refused. Migrations run against the test DB.
- Response checks cover profile, permalink/handle reads, shares, shared/saved
  lists, readiness, and errors, including ISO-string timestamps and nullability.
  Backend mappers have compile-time checks against shared types where practical;
  HTTP tests verify the actual serialized contract.
- Stable error codes cover actionable validation and conflicts; arbitrary
  thrown values, SQL/secret-bearing errors, and 5xx HttpException payloads
  cannot leak. Validation details carry field/rule identifiers, not submitted
  values. Unknown codes get a safe web fallback; unavailable collections remain
  indistinguishable from nonexistent ones.
- CI runs required real-service integration tests without skipping. The local
  full verification gate remains available, with results clearly distinguishing
  fast checks from infrastructure and browser checks. Explicit suite discovery
  excludes compiled `dist` copies so source tests are not counted twice.
  Documentation links resolve.

### Gate 2 — W3 shell and first read-only journeys

After the three design documents exist, scaffold the web and runtime config
boundary, then implement explore, hub/permalink reads and status/error states.
Account forms must not advertise undeliverable codes or unwired email changes.

Acceptance: web builds from a clean checkout, secrets stay out of its browser
bundle, all API requests go through the agreed boundary, and private content
does not persist across users or revocation. Exercise expiry, anonymous 404,
link rotation, unpublish, 409 reload/retry, unavailable API, and bounded request
timeouts. Prove browser-origin auth and mutation CSRF protection before cookie
writes, including import/upload flows. Browser tests cover keyboard access,
focus, narrow screens, empty/loading/error states, and real file downloads as
those journeys land. Do not manufacture navigation for unimplemented features.

### Gate 3 — auth delivery before the code-first account journey ships

First remove direct profile email/password persistence from the product service
and route credential changes through better-auth with verified proof/session
revocation. Decide and enforce the existing profile DELETE endpoint’s retention
contract before public exposure. Then implement one vertical slice: better-auth
integration, durable email delivery,
local capture sender, rate limits, security audit, sign-in and account-email
change, and their web states. Password authentication is not part of the
product. Do not postpone delivery until after all of W3.

The pinned better-auth spike exposed native transaction and handover gaps.
The user approved replacing direct authentication links with codes only on
2026-10-05, then explicitly removed password authentication after review. The integration now scopes library proof,
credential writes, session changes and durable delivery to the same database
transaction. Preserve replay/resend/expiry/concurrency protection and cross-device
sign-in. Optional TOTP/recovery codes follow separately. See
[the integration contract](auth-delivery-integration.md) for the implementation
and failure evidence. Web states and browser acceptance still belong to gate #2.

Delivery acceptance includes atomic business-intent persistence (and a proven
recovery path wherever a library callback cannot share its transaction), Redis
outage/restart, worker crash/lease recovery, duplicate and malformed jobs,
provider timeout, provider-success/DB-recording failure, retry exhaustion,
credential cleanup, graceful shutdown, and signed webhook replay handling.
Use local capture for automated tests, no ordinary logs of messages/codes, and
no real recipients for outage tests. Confirm all-session revocation after email
change and enforce abuse limits on both code issuance and verification.

### Gate 4 — public release

Before first public exposure, prove deployment images and migrations, off-host
restore, production secrets and sender configuration, endpoint abuse limits,
sensitive collection-action audit, and LogTape/Sentry privacy/correlation.
Verify shared Alloy shipping and dependency monitoring as a separate operator
rollout; application instrumentation alone is not that evidence. Public status
shape and internal probe exposure receive an explicit review here. W4 extension
and deferred product features retain their own plans.

## Evidence inventory

These paths identify the inspected reference snapshot, not files to import.

- **R1 — workflow:** `tooling/check-docs.ts`, `tooling/check-guide-pin.ts`,
  `tooling/prepare-guide-pin.ts`, `tooling/git-hooks/pre-push`.
- **R2 — verification:** `tooling/verify.ts`, `tooling/integration-tests.ts`,
  `.github/workflows/verify.yml`.
- **R3 — contracts:** `packages/types/src/errors.ts`,
  `docs/engineering-decisions/0004-typed-api-error-catalog.md`,
  `docs/engineering-decisions/0005-zod-schema-source.md`, `apps/api/package.json`.
- **R4 — config:** `packages/config/src/application.ts`,
  `packages/config/src/web-browser.ts`, `packages/config/tests/index.test.ts`,
  `tooling/check-config-boundary.ts`.
- **R5 — auth:** `apps/api/src/auth/create-auth.ts`,
  `apps/api/src/auth/otp-address-budget.ts`, `apps/api/src/auth/otp-hmac.ts`,
  `apps/api/src/auth/auth-otp.test.ts`,
  `docs/engineering-decisions/0008-passwordless-authentication.md`,
  `docs/engineering-decisions/0011-optional-organization-second-factor.md`.
- **R6 — delivery:** `apps/api/src/queue/queue-port.ts`,
  `apps/api/src/queue/outbox-relay.service.ts`,
  `apps/api/src/queue/bullmq/bun-redis-connection.test.ts`,
  `apps/api/src/email/email-delivery.consumer.ts`,
  `apps/api/src/email/email-delivery.consumer.test.ts`,
  `apps/api/src/email/email-outbox-maintenance.service.ts`,
  `apps/api/src/worker.ts`, `docs/designs/transactional-email.md`.
- **R7 — observability:** `apps/api/src/instrumentation.ts`,
  `apps/api/src/common/logging/logtape-nest-logger.ts`,
  `apps/api/src/common/observability/request-context.ts`,
  `apps/api/src/common/http/wide-event.middleware.ts`,
  `apps/api/src/status/status-response.test.ts`,
  `docs/exec-plans/active/adopt-sentry-tracing-and-infrastructure-observability.md`.
- **R8 — web:** `apps/web/next.config.ts`, `apps/web/src/lib/api-client.ts`,
  `apps/api/src/main.ts`,
  `apps/web/src/lib/server-api-timeout.ts`,
  `apps/web/src/components/workspace-session-guard.tsx`,
  `docs/designs/frontend-foundation.md`,
  `docs/designs/web-rendering-and-caching.md`, `tooling/browser-smoke.ts`,
  `tooling/check-web-boundaries.ts`, `tooling/check-web-experience.ts`.
- **R9 — operations:** `.github/workflows/verify.yml`,
  `docs/infrastructure/deployment.md`, `docs/infrastructure/alloy.md`,
  `docs/designs/data-retention-and-purge.md`.

Local evidence: `apps/api/src/auth/auth.ts`, `apps/api/src/app.setup.ts`,
`apps/api/src/common/filters/all-exceptions.filter.ts`,
`apps/api/src/modules/health/`, `apps/api/src/config/`,
`packages/types/src/envelope.ts`, `packages/email/src/`, `package.json`,
`tooling/check-guide-pin.ts`, and the current design/debt documents.
