# Technical Debt Tracker

Record accepted compromises with an impact and a condition for revisiting the
decision. Implementation order and acceptance gates for foundation work are in
`docs/design-docs/adoption-decisions.md` (2026-10-05 comparison). Decisions there
are not claims that the work below has shipped.

| Area | Debt | Impact | Revisit When |
| --- | --- | --- | --- |
| Export typography | PDF/Word renderers use library-default styling (Helvetica, default docx heading styles); no user-visible styling options | Exports are readable but plain; no branding or theme choices | Users ask for styled exports |
| Import parsers | CSV parsing is naive (comma split, no quoting/escaping); the bookmarks parser is a regex MVP that flattens folder structure; the universal-CSV column format is not yet documented for users | Malformed or complex files import incorrectly; bookmark structure is lost; users must guess the CSV layout | Imports get real-world usage (document the CSV format with the W3 import UI) |
| Audit and retention | Account deletion is disabled; auth audit retains 90 days, delivery metadata 30 days; account deletion/ownership policy remains | Self-service deletion cannot be re-enabled safely until proof and retention are designed | Gate 3 auth/deletion contract before public exposure |
| Email rollout | Code delivery is locally implemented; live Resend domain/webhook validation and web forms remain. Share notifications remain sharing work | Local evidence does not prove live delivery | Deployment preparation and W3 account/sharing journeys |
| Observability rollout | API LogTape/Sentry boundary and local capture are implemented; browser/worker instrumentation and live Sentry/Alloy shipping are unverified | No claim of centralized operational visibility yet; sanitized stack frames omit source filenames | Live infrastructure milestone plus browser/worker slices; review source-map privacy before richer traces |
| Deployment rollout | API image, Swarm files and local restore rehearsal exist. Fresh image acceptance for the latest auth fixes is deferred; previous builds stalled during dependency installation. Manual release workflow gates publication on application verification and image rehearsal. Swarm/Dokploy/TLS/off-host restore have not run | Earlier image proof does not cover the latest source; deployment is unverified, but W3 can proceed | Deployment preparation before exposure: rebuild/rehearse API and worker, then complete operator gates in docs/runbooks/release.md |
| Auth throughput and budgets | Auth mutations use a shared transaction advisory lock; source and identity budgets are fixed | Simple cross-process correctness bounds throughput; NAT users share source capacity | Measure lock wait and real traffic before scoped-lock or adaptive-budget work |
| Link title fill | Titles for untitled links are fetched in-process after the save commits and when a collection is opened (best effort, no queue; attempt memory is per process) | A restart or slow site leaves the URL as the title until the collection is next opened | A durable job queue lands |
| Link title storage | Resolved titles are written into `titleOverride` with a version bump, fetched again after the preview already fetched them | Spurious 409s for API clients holding a version; duplicate outbound fetches | Richer link metadata slice: own `pageTitle` column + lookup status, after-commit hook or outbox job, shared short-lived cache |
| Read-path queries | Each referenced collection in a list runs its own access check; comments load replies per question (up to 100 each) and mutations re-read what they hold | ~5 queries per reference, ~40 per comment page, extra queries under the write lock | Measured traffic, or the comments/notifications slice: bulk policy resolve, windowed reply query, smaller reply preview |
| Write-lock opt-outs | Four ways to skip the global authority lock (method list, two metadata keys, a path regex) | A new POST under `/operations` or `/invitations` silently runs unlocked | Next authority change: one `@Authority(mode)` metadata value set per controller |
| Forms route | One `/forms/[action]` handler with a growing action chain and per-action status-to-notice mappings | Inconsistent notices for the same status | Next new form action: action table or per-action route files, one notice helper |
| Capture drafts in cookies | Drafts (2 links + tags) live in one encrypted cookie; oversized tags are dropped | Rare silent tag loss on very long input | Server-side draft store (Redis) if users hit it |
| Keyboard-only focus rings | `FocusMode` hides rings after a pointer press until Tab/arrows/F6 (requested) | Screen-reader virtual cursors don't fire those keys, so rings stay hidden after a click | Accessibility review with assistive-technology testing |
| Tag suggestions | Per-link tags are typed by hand on Save a link | No suggestions from page metadata yet | Richer link metadata slice (author, description, site name) |
| Generated client in build | `apps/api/src/generated/prisma` compiles inside the app build (`nest build` walks it) | Slower builds | Only if build times hurt |
| Type-aware lint coverage | Biome replaced `typescript-eslint`; type-aware rules (`no-floating-promises`, `no-unsafe-*`) have no Biome equivalent | Async-safety lint classes (e.g. unhandled promises) are no longer caught at lint time; type *errors* are still caught by `tsc --noEmit` in `verify` | Revisit if a floating-promise/async bug ships, or if Biome gains type-aware rules |
| Browser mutation journeys | Shared cookie-Origin enforcement and reading cache/revocation checks now have browser proof; account/editing/import/export forms remain unbuilt | Each new form still needs workflow-specific conflict, validation, expiry and download acceptance | With each complete W3 vertical slice |
| Runtime configuration | API/worker keep existing server validation; web has separate server/browser exports and import/bundle checks | Shared server settings are not yet consolidated across API and web | Only when a real cross-runtime setting warrants consolidation |
| Optional account MFA | TOTP and recovery codes are an approved separate follow-up to core email delivery | No second-factor enrollment or recovery-code protection yet | Separate milestone after core delivery; verify all login paths, enrollment and recovery with better-auth |

The profile credential-write bypass is closed; password authentication is
removed by user decision. Email codes are the only current sign-in path. The user approved codes-only auth,
with optional TOTP/recovery codes deferred. The transaction-scoped integration
supplies target/session binding, all-session revocation and durable intent
missing from the native plugins. See
[the integration contract](../design-docs/auth-delivery-integration.md).

Contract checks now cover W3 reads and safe error envelopes. Keep expanding
HTTP/mapper coverage per slice; DTOs/Swagger/shared types remain handwritten.
Local Markdown links are enforced; the guide pin still checks committed trees
only, so sweep it during review and pin after the reviewed commit exists.

## Explore discovery follow-up (2026-10-06)

User direction: add a usable search entry and tag filters after the current
first-link/list milestone. Popular tags may help people browse; define how they
are derived and exclude private content before presenting them. Date-range
filtering is undecided and needs a concrete discovery use case. Desktop Previous/Next
has no visible numeric range between the controls; accessible page feedback remains.
Do not ship placeholder search/filter controls before their query path works.
