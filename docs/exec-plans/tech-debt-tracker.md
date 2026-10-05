# Technical Debt Tracker

Record accepted compromises with an impact and a condition for revisiting the
decision. Implementation order and acceptance gates for foundation work are in
`docs/design-docs/adoption-decisions.md` (2026-10-05 comparison). Decisions there
are not claims that the work below has shipped.

| Area | Debt | Impact | Revisit When |
| --- | --- | --- | --- |
| Export typography | PDF/Word renderers use library-default styling (Helvetica, default docx heading styles); no user-visible styling options | Exports are readable but plain; no branding or theme choices | Users ask for styled exports |
| Import parsers | CSV parsing is naive (comma split, no quoting/escaping); the bookmarks parser is a regex MVP that flattens folder structure; the universal-CSV column format is not yet documented for users | Malformed or complex files import incorrectly; bookmark structure is lost; users must guess the CSV layout | Imports get real-world usage (document the CSV format with the W3 import UI) |
| Async reliability | BullMQ/Redis are in the stack but unused (exports went synchronous); when email delivery lands there is no transactional outbox or separate worker process yet | A crash between DB write and enqueue could strand an email job once that path exists | Build with the email-delivery slice; direction in `docs/design-docs/transactional-email.md` (email is the first mandatory outbox consumer) |
| Audit and retention | Collection/share/link/transfer/handle actions and audit reads now commit hub-scoped records; auth-security outcomes, deletion policy and long-term audit retention remain | Existing profile DELETE can orphan retained audit identifiers; no purge policy yet | Gate 3 auth/deletion contract before public exposure |
| Email delivery | No email infrastructure; verification and share notifications are a logged no-op intent | Verification and share notices cannot reach users out-of-band | Direction set (`docs/design-docs/transactional-email.md`: Resend + React Email + outbox worker); build with the W3 code-first account journey; do not wait for nsauth |
| Queue test isolation | E2E databases are disposable and cleaned per run; Redis currently only receives readiness pings | Future relays/workers must never claim development work | Add per-run queue namespaces with the first queue consumer (runner concurrent success/failure/SIGTERM cleanup is now verified) |
| Observability rollout | API LogTape/Sentry boundary and local capture are implemented; browser/worker instrumentation and live Sentry/Alloy shipping are unverified | No claim of centralized operational visibility yet; sanitized stack frames omit source filenames | Live infrastructure milestone plus browser/worker slices; review source-map privacy before richer traces |
| Deployment rollout | API image, Swarm files, verification/image workflows and local restore rehearsal exist; Swarm/Dokploy/TLS/off-host restore have not run | Local image proof is not live rollout acceptance | Separate operator milestone before exposure; runbook in docs/runbooks/release.md |
| Auth abuse limits | Shared per-source PostgreSQL endpoint budgets exist; account/challenge issuance and verification budgets do not | NAT users share capacity; distributed credential attacks need purpose-specific limits | Gate 3 auth delivery and live ingress capacity/connection-limit review |
| Generated client in build | `apps/api/src/generated/prisma` compiles inside the app build (`nest build` walks it) | Slower builds | Only if build times hurt |
| Type-aware lint coverage | Biome replaced `typescript-eslint`; type-aware rules (`no-floating-promises`, `no-unsafe-*`) have no Biome equivalent | Async-safety lint classes (e.g. unhandled promises) are no longer caught at lint time; type *errors* are still caught by `tsc --noEmit` in `verify` | Revisit if a floating-promise/async bug ships, or if Biome gains type-aware rules |
| Browser mutation safety | Cookie writes, multipart imports, auth origins, and revocation-sensitive browser caches are not exercised by a web client | Same-origin routing alone does not prove CSRF or session/cache correctness | Before first W3 cookie mutation; real browser origin, expiry, revocation, and download checks |
| Runtime configuration | API config is separate from auth/Prisma startup; packages/config contains only TypeScript settings | Web/worker additions could duplicate validation or expose server config | First second runtime in W3/worker work; typed server/browser entry points and boundary check |

Additional pre-release finding: `UsersService.updateMe` writes email and
credential passwords directly, outside better-auth, without the planned
verification/revocation flow. Correct this with gate 3; do not expose these
fields in W3 account forms until the auth-owned implementation is verified.

Contract checks now cover W3 reads and safe error envelopes. Keep expanding
HTTP/mapper coverage per slice; DTOs/Swagger/shared types remain handwritten.
Local Markdown links are enforced; the guide pin still checks committed trees
only, so sweep it during review and pin after the reviewed commit exists.
