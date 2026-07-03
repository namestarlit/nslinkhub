# Technical Debt Tracker

Record accepted compromises with an impact and a condition for revisiting the
decision.

| Area | Debt | Impact | Revisit When |
| --- | --- | --- | --- |
| PDF export | The exports worker stores an output-reference placeholder instead of generating a PDF | PDF export is queue-plumbed but produces no document | Export feature gets prioritized |
| Import parsers | CSV parsing is naive (comma split, no quoting/escaping); bookmarks/WhatsApp parsers are regex MVPs | Malformed or complex files import incorrectly rather than failing clearly | Imports get real-world usage |
| Async reliability | Export jobs enqueue directly to BullMQ; no transactional outbox, no separate worker process | A crash between DB write and enqueue can strand a job; workers share the API process | Outbox/worker item in the hub plan Phase E |
| Audit | No audit records exist for sensitive actions | Membership, publication, and share changes leave no product-visible trail | Hub plan Phase E |
| Email delivery | No email infrastructure; Phase D invitations will start with a logged no-op intent | Invitations/verification cannot reach users out-of-band | Phase D hardening or nsauth work |
| E2E test isolation | E2E tests run against the local dev database (`compose.yml` services), not an isolated test DB | Test data accumulates in the dev DB; parallel runs could interfere | Test suite grows or CI lands |
| Observability | No structured logging pipeline, metrics, or tracing beyond Nest defaults | Production behavior will not be centrally searchable | Before first production release |
| Deployment artifacts | Direction is documented (`docs/design-docs/infra-deployment.md`) but Dockerfiles, `docker.stack.*.yml`, CI workflows, and health/readiness endpoints beyond `/health` do not exist | Nothing is deployable yet | Deployment nears (after Track W) |
| Rate limiting | No rate limiting or abuse protection on any endpoint | Auth and capture endpoints are unprotected against abuse | Before first public exposure |
| Export retention | Completed/failed export jobs and their artifacts are never cleaned up | `export_jobs` grows unbounded | Exports get real usage or storage pressure appears |
| Generated client in build | `src/generated/prisma` compiles inside the app build (`nest build` walks it) | Slower builds; moves into `apps/api` unchanged at W1 | Only if build times hurt |
