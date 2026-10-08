# Define service operations before further W3 implementation

## Purpose / Big Picture

Define the missing service-administration scope so the next implementation
can deliver useful operator workflows without giving operators unrestricted
access to personal hubs. This milestone produces a reviewable product/security
contract and delivery sequence, not running admin pages or database changes.

## Progress

- [x] (2026-10-06) Inspected current product/system/security decisions, user
  schema, self-service API, auth wrapper, collection policy and audit boundaries.
- [x] (2026-10-06) Defined operator permissions, grant/recovery lifecycle,
  suspension, public-content holds, privacy, atomic audit and retention.
- [x] (2026-10-06) Reconciled repository maps, product acceptance, security,
  reliability, IAM/adoption direction and onboarding sequence.
- [x] (2026-10-06) Documentation links, guide pin and diff checks passed.
  Full verification passed all 118 tests, API/web builds and typechecks in an
  isolated copy; reviewed the diff for claims of implemented operator behavior.
- [x] (2026-10-06) User accepted the scope and requested its implementation.
  Closed this design plan; implementation continues in
  `docs/exec-plans/completed/deliver-service-operations.md`. Commit/guide repinning
  remain part of the reviewed milestone workflow.

## Surprises & Discoveries

- `User` has no platform role, and the users controller only serves the caller's
  profile. The no-admin language previously conflated private-content bypass
  with service administration; the latter had no product contract or code.
- `resolveSessionUser` currently trusts a better-auth session without an
  account-availability check. Raw auth HTTP routes also bypass product guards.
  Suspension must close both paths and pending-code/session races.
- `CollectionPolicyService` grants owner/share/link/publication access, while
  discovery/list paths also make direct queries. A moderation hold cannot be
  implemented by hiding a page or modifying the public explore query alone.
- Auth mutations already share a transaction-scoped advisory lock. Existing
  hub audit and 90-day auth audit are distinct; neither is an operator audit.
- The sandbox verification attempt failed to bind a local telemetry listener.
  The full gate then passed with local listener access in an isolated temporary
  copy, using the existing disposable DB/queue runners. The original checkout
  had a live dev server, so production compilation there was intentionally avoided.
- A pre-existing change in `apps/web/next-env.d.ts` selects Next dev-generated
  type paths. It is unrelated to this documentation milestone and must be kept.

## Decision Log

- Decision: Define one product-owned `service_operator` capability separate
  from collection roles; grants/recovery use an audited deployment command.
  Rationale: A small operational surface does not require a role hierarchy,
  another IAM service or a private-content bypass.
  Date/Author: 2026-10-06 / Codex, following the user's scope request.
- Decision: Preserve content/settings and use explicit account restrictions
  and collection holds, with deliberate restoration and atomic audit.
  Rationale: Operators need reversible service enforcement, not ownership or
  credential changes. Holds must cover direct/share-link routes as well as
  public discovery to avoid trivial distribution bypasses.
  Date/Author: 2026-10-06 / Codex.
- Decision: Treat this as a documentation milestone; next deliver the complete
  operator journey including reusable web sign-in/session support.
  Rationale: The user accepted defining scope before extending W3. Screens,
  migrations and permission code require the resulting contract first.
  Date/Author: 2026-10-06 / Codex.

## Outcomes & Retrospective

Scope definition and verification are complete; the user approved proceeding with implementation. The
focused contract is
`docs/design-docs/service-operations.md`. Runtime operator capabilities remain
absent. No grant, restriction, migration, commit or publication is part of this
scope-definition task. The required full gate passed in a temporary copy so
the active development server and pre-existing generated-file edit were not
disturbed. Final docs checks ran in the real checkout. No browser rerun was
needed for documentation-only changes; operator runtime acceptance is future
implementation work.

## Context And Orientation

The existing backend supports individual users and one hub per user, with
reader/editor sharing. W3 public reading and status are reviewed and committed;
web sign-in and personal management remain outstanding. `PRODUCT.md` and
`docs/SYSTEM_DESIGN.md` define the product. `docs/SECURITY.md` and
`docs/RELIABILITY.md` own cross-cutting rules. `AGENTS.md`/`ARCHITECTURE.md`
map them; adoption/IAM docs constrain borrowed platform machinery.

Relevant implementation anchors for the subsequent milestone:
`apps/api/prisma/schema.prisma`, `apps/api/src/auth/delivery-auth.ts`,
`apps/api/src/auth/create-auth.ts`, `apps/api/src/common/guards/auth.guard.ts`,
`apps/api/src/common/audit.ts`, `apps/api/src/modules/hubs/collection-policy.service.ts`,
`apps/api/src/modules/collections/`, `apps/api/src/modules/exports/`,
`apps/api/test/browser/reading.browser.ts`, `apps/web/src/app/`, and
`packages/types/src/`. The current web has no operator pages.

## Plan Of Work

Write the focused service-operations contract first. Define every allowed
operation and its privacy boundary, grant/revoke/recovery authority, account
and collection state transitions, composition with existing sharing, concurrency,
audit and retention. Distinguish proposed persistence from existing code.
Reconcile concise pointers and acceptance rules in the canonical documents,
then update the guide, changelog and disposable handoff. Validate the complete
documentation diff before presenting it for review.

## Concrete Steps

From repository root, run `bun run check:docs`, `bun run check:guide-pin`,
`git diff --check`, and `bun run verify`. The full gate requires local
PostgreSQL/Redis and loopback listeners; use existing isolated fixtures, never
reset developer data. Do not run a web build alongside a dev server in the same
checkout. No browser rerun is required for a documentation-only change.
Preserve the pre-existing generated-file edit if builds rewrite it.

After a later reviewed milestone commit, sweep the guide and pin to that
commit in the required guide-only follow-up. A current successful pin check
compares committed trees; it does not replace that post-commit step.

## Validation And Acceptance

- A reader can identify the five capabilities and the separate deployment
  authority, without interpreting operator status as collection access.
- Suspension/reactivation, session revocation and hold/release behavior cover
  existing auth, list, shared/saved, direct/link, section and export surfaces.
- Grant bootstrap, removal, last-operator recovery and verified email handover
  have explicit outcomes; no implicit email/domain/SSO privilege escalation.
- Reasons, audit atomicity/access/retention and concurrency/retry behavior are
  specified; completed local code is not misrepresented as operator support.
- The next complete journey and required runtime/browser acceptance are
  concrete enough to become an implementation ExecPlan after scope review.
- Documentation links, guide pin and full verification pass, or an exact
  environmental limitation is recorded without claiming runtime success.

## Idempotence And Recovery

Only Markdown documents are edited. No schema is generated, operational
account changed or service reset. Repeating doc checks is safe. Runtime tests
use their existing disposable fixtures. Keep the unrelated Next-generated
change intact. Do not push without explicit authorization.

## Artifacts And Notes

Service-status baseline: `202f30c`; guide follow-up: `625c0a9`. The walkthrough
remains pinned to `202f30c` until a reviewed documentation commit exists.
The disposable `ref/w3-web-app-handoff.md` points to this design milestone;
it is not the only copy of a decision. Successful full-gate log:
`/tmp/service-operations-verify-isolated.log` (118 pass, 0 fail, builds/types
passed). Initial sandbox limitation: `/tmp/service-operations-verify.log`.
The temporary verification copy was removed after completion; logs remain.
Documentation links resolve across 34 current Markdown documents. The guide
pin check passes for the committed baseline; post-commit repinning remains.

## Interfaces And Dependencies

Keep better-auth credentials/proofs behind app-owned integration; downstream
services consume `AuthUser`. Operator and account restrictions belong to the
product, not IAM claims. Web remains an HTTP-only client. Preserve immutable
UUIDv7 identity, hub scoping for content, cookie Origin enforcement, no-store
private reads, safe envelopes, existing audit policies and additive migrations.
No external service, package or frontend-design change is adopted here.
