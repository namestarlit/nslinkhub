# Technical Debt Tracker

Record accepted compromises with an impact and a condition for revisiting the
decision.

| Area | Debt | Impact | Revisit When |
| --- | --- | --- | --- |
| Export typography | PDF/Word renderers use library-default styling (Helvetica, default docx heading styles); no user-visible styling options | Exports are readable but plain; no branding or theme choices | Users ask for styled exports |
| Import parsers | CSV parsing is naive (comma split, no quoting/escaping); the bookmarks parser is a regex MVP that flattens folder structure; the universal-CSV column format is not yet documented for users | Malformed or complex files import incorrectly; bookmark structure is lost; users must guess the CSV layout | Imports get real-world usage (document the CSV format with the W3 import UI) |
| Async reliability | BullMQ/Redis are in the stack but unused (exports went synchronous); when email delivery lands there is no transactional outbox or separate worker process yet | A crash between DB write and enqueue could strand an email job once that path exists | Build with the email-delivery slice; direction in `docs/design-docs/transactional-email.md` (email is the first mandatory outbox consumer) |
| Audit | No audit records exist for sensitive actions | Publication, share, and transfer changes leave no product-visible trail | Hub plan Phase E |
| Email delivery | No email infrastructure; verification and share notifications are a logged no-op intent | Verification and share notices cannot reach users out-of-band | Direction set (`docs/design-docs/transactional-email.md`: Resend + React Email + outbox worker); build with the auth-delivery slice or nsauth work |
| E2E test isolation | E2E tests run against the local dev database (`compose.yml` services), not an isolated test DB | Test data accumulates in the dev DB; parallel runs could interfere. Bit once (2026-07-08): a fixed-name fixture exhausted the derived-handle suffix space after ~24 runs and broke sign-ups; remedy is the runbook DB reset | Test suite grows or CI lands |
| Observability | No structured logging pipeline, metrics, or tracing beyond Nest defaults (default `Logger`, not JSON) | Production behavior will not be centrally searchable | Before first production release; direction in `docs/design-docs/observability.md` (Pino JSON + Sentry/OTel/Grafana) |
| Deployment artifacts | Direction is documented (`docs/design-docs/infra-deployment.md`) but Dockerfiles, `docker.stack.*.yml`, CI workflows, and health/readiness endpoints beyond `/health` do not exist | Nothing is deployable yet | Deployment nears (after Track W) |
| Rate limiting | No rate limiting or abuse protection on any endpoint | Auth and capture endpoints are unprotected against abuse | Before first public exposure |
| Generated client in build | `apps/api/src/generated/prisma` compiles inside the app build (`nest build` walks it) | Slower builds | Only if build times hurt |
| Type-aware lint coverage | Biome replaced `typescript-eslint`; type-aware rules (`no-floating-promises`, `no-unsafe-*`) have no Biome equivalent | Async-safety lint classes (e.g. unhandled promises) are no longer caught at lint time; type *errors* are still caught by `tsc --noEmit` in `verify` | Revisit if a floating-promise/async bug ships, or if Biome gains type-aware rules |
