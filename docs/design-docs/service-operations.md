# Service operations

> **Direction (2026-10-08):** this console becomes the service scope of one
> workspace, [Manage](manage-workspace.md), which also gives every hub owner
> their own sections (ADR-0014). The authority below is unchanged.

Status: operator and admin/invitation workflows implemented and locally verified
(2026-10-06); reviewed and committed. See
[admin invitations](../exec-plans/completed/deliver-admin-operator-invitations.md).
See the [implementation plan](../exec-plans/completed/deliver-service-operations.md)
and [operator runbook](../runbooks/service-operations.md).
This is the product-owned service-operator contract. It adds account operations
and public-content moderation to the individual hub model; it does not add hub
memberships, private-content access, or a new identity provider. The
[tenancy and access](tenancy-and-access.md) and [product definition](../../PRODUCT.md)
remain authoritative. Implementation must deliver the whole operator journey,
including its sign-in dependency, before advertising an admin surface.

## First milestone

An explicitly authorized operator can find an account, suspend or reactivate
it, revoke its sessions, place or release a hold on a published collection, and
review who performed these operations and why. These are the complete initial
capabilities. Two product capabilities now apply: `service_admin` manages users
and operator invitations/access, while `service_operator` performs account and
moderation work. Neither confers private-content access. There is no configurable
permission builder. Operators cannot restrict another operator or admin account;
admins manage operator accounts. Admin account suspension is unavailable.

| Operation | Information and authority | Boundary |
| --- | --- | --- |
| Find accounts | Paginated account table searchable by email or hub handle fragment (`GET /operations/accounts?q=`); name, email/verification, immutable user/hub IDs, handle, creation date, account status and session count; row quick actions (suspend/reactivate, sign out everywhere) | Email is operational personal data; no bulk export, secrets, private collection titles or browsing history; the search text is not written to the audit |
| Suspend/reactivate | Change account availability with a required reason; suspension revokes all sessions and operator access | No deletion, ownership reassignment or credential editing |
| Revoke sessions | End all cookie and bearer sessions for the target account | Does not suspend it; a fresh sign-in is allowed |
| Hold/release publication | Find a collection from its pasted link (`/c/<id>` or `/@handle/slug`, `GET /operations/collections/resolve?link=`); restrict distribution of a currently public collection; list active holds (`GET /operations/collections`: id, hub handle, reason, since — no titles) and release from the row | Does not confer permission to read or edit its content |
| Review operator audit | Cursor-paginated table filtered by one search (email, hub handle or id; matches actor or target), an action from `operatorAuditActions`, and dates; rows show hub handles where known | No generic database browser or access to other users' hub audit feeds |

Use ordinary public collection reads to inspect reported public material.
Once the owner unpublishes it or a hold hides it, operators retain only the
minimal enforcement record (IDs, status, reason and timestamps). No content
snapshot, private preview, export bypass or impersonation is created. A
collection already readable through an operator's ordinary personal share
remains governed by that share, not their operator capability.

User reporting forms, appeals/case management, bulk actions, arbitrary profile
editing, deleting accounts, taking over accounts, MFA, automated moderation,
identity-provider migration and hosting/email-provider consoles are separate
work. The initial scope does not require Clerk, nsauth or Pigfarm's authority
model. Suspension is per existing user ID; it is not a promise to prevent a
person from registering a different account.

## Admin bootstrap and accepted invitations

Grants are keyed by immutable user IDs and are site-wide, separate from the per-collection roles ([roles and labels](tenancy-and-access.md#roles-and-labels)).
Only an active admin with a cookie session verified within five minutes may
invite operators, resend/cancel invitations or revoke operator access. There
is no direct operator grant command or HTTP action. Multiple operators may
serve concurrently; removing the last operator is allowed because admin
management remains available. An operator cannot appoint another operator.

At startup, an explicitly configured `BOOTSTRAP_ADMIN_EMAIL` records one admin
invitation, encrypted delivery and audit. It creates **no user, hub or grant**.
The email contains a random 256-bit token in the fragment of
`/invitations/accept#token=...`; only its digest is stored on the invitation.
GET and preview consume nothing. Repeat startup neither duplicates mail nor
restores revoked authority. The initial migration from ID-only links refreshes
only a still-pending, tokenless bootstrap invitation once.

Both roles use the same email-entry journey, adapted from Pigfarm ADR-0012:

- A new recipient enters their name and explicitly accepts. In one transaction,
  better-auth's adapter creates the unverified account, the app-owned onboarding
  hook creates its hub, and consent plus email-code delivery are recorded.
- Existing recipients accept without entering a name. Existing names are never
  overwritten. A different signed-in account must sign out first.
- Every recipient, including a matching signed-in account, verifies a fresh email
  OTP. Consent puts the invitation in `verifying`; no role exists yet. Successful
  verification atomically creates the role, session and audit, completes the
  invitation, and redirects to `/ops`. Email OTP is the only current method;
  TOTP is deferred to a later phase.

Issuance, preview, expiry, cancellation, decline and abandonment before consent
create no accounts. A forwarded token can record consent and create an unverified
account, but cannot establish a session or role: the code goes only to the invited
address. Codes are purpose-bound to the invitation and its version; ordinary
login codes cannot activate invitations, and invitation codes cannot log in
through the ordinary endpoint. Account invitation listings show status and direct
recipients back to their email; ID-only acceptance is removed.
With JavaScript disabled, recipients paste the emailed link into the native entry
form. With JavaScript, its fragment is exchanged for an encrypted HttpOnly flow
cookie and removed from browser history; raw tokens never enter HTTP URLs/logs.

Tokens expire after seven days. Resend rotates the token and form version; cancel
invalidates acceptance and outstanding codes. Preview, consent, resend and verification
are exact-Origin POSTs, including
anonymous requests, and reject bearer headers. Source/identity budgets apply.
Consent and final verification recheck token, state, expiry, UUID/email binding and active
inviter authority under the shared lock. Bootstrap also requires the current
unclaimed singleton and zero active admins. Consent checks the form version.
Account/hub/consent/mail/audit commit together; proof/session/grant/audit commit
together on verification. A failed enqueue or audit rolls back its transaction. Idempotent retries neither
send another code nor restore a revoked role. Token consent is audited with an
`invitee` actor kind, distinct from authenticated operator actions.

Admins see delivery states without message contents or credentials. Routine admin
and operator mutations still require cookie verification within five minutes.
When verification is too old, the operator confirms it's them (Send code or
Cancel; Cancel returns to the page), and after the code the waiting action runs
once with its original operation id, so it cannot double-apply. Grants are checked
on every operation; neither is embedded as durable session authority. Invitation
metadata can be pruned 30 days after expiry independently of grants and bootstrap.

Suspension or verified email handover revokes role grants, sessions and pending
incoming/authored invitations atomically. Reactivation never restores authority.
Admin accounts cannot be suspended from these tools; operators cannot revoke
another operator/admin's sessions. Admins can revoke operator roles; operators
cannot remove admins. A last admin may still change their verified email, which
removes their authority and requires explicit recovery.

If no active admin remains, a trusted interactive deployment `admin:recover`
command may issue a new admin invitation. It confirms the selected address,
invalidates previous pending bootstrap mail, and records deployment authority.
It never directly grants any role; the recipient must accept from the email
and verify a fresh email OTP, even if already signed in. Recovery is refused while an active admin
exists. There is no hidden web recovery endpoint or perpetual seed password.

## Account suspension and recovery

Account availability is app-owned state, `active` or `suspended`. Suspension:

- Denies new authenticated sessions and every existing cookie/bearer session,
  including raw better-auth session reads and mutation endpoints, product
  guards, pending code verification and email handover. Normal anonymous
  public browsing remains possible; this is not an IP block.
- Revokes sessions, operator grants and outstanding authentication/handover
  proofs. Pending mail is cancelled where possible; mail already sent cannot
  authenticate after suspension or regain validity on reactivation.
- Hides the suspended owner's hub and collections from all non-owners,
  including public discovery, handle/slug/ID reads, direct shares, link tokens,
  resources, sections and exports. The suspended owner has no authenticated
  access either. Collections they merely created and later transferred to
  someone else's hub are unaffected; current ownership determines scope.
- Rejects new direct shares and ownership transfers to a suspended account,
  using the same safe target-unavailable outcome as an ineligible/missing
  account. Existing grants remain stored but confer no suspended access.
- Preserves records, publication choices, shares, saves and ownership. Saved
  rows become dormant using the existing safe saved-list contract; shared
  lists suppress unavailable entries. No private content is returned.

Code issuance responses must not reveal whether an email is registered or
suspended. Only a caller who supplies valid proof may receive an account-status
explanation and the configured support destination. Invalid or expired proof
uses the ordinary failure. Public content remains indistinguishable from
missing content (404), without exposing the suspension reason.

Reactivation is explicit and reasoned. It allows fresh sign-in and restores
existing distribution settings, except where collection holds still apply.
The operator must be told that existing publication/share links may become
available again. It does not resurrect sessions, proofs, operator grants or
cancelled mail. No new mass notification workflow is implied.

## Collection distribution holds

A hold is separate from the owner's `published` setting. It is keyed by
immutable collection ID and applies only to that collection. Referencing it
cannot grant access or bypass the hold. Renaming or old links cannot bypass it.

- Apply a new hold only to material currently readable through publication,
  checked under the mutation lock. A stale report for now-private content
  cannot authorize inspection or a new hold. Repeating an existing hold is
  idempotent even though the content is now hidden.
- Non-owners lose reads/writes to the held collection, including direct shares
  and exports. Public lists filter before pagination; reference resources show
  a neutral unavailable entry without target titles or previews.
- Active owners can read and correct content, unpublish, disable/revoke sharing,
  remove saves or delete their collection. They see the bounded hold reason and
  support destination. They cannot publish, enable/grant sharing or transfer
  until release. Managing a reference never changes a destination's hold.
- Releasing a hold restores only access allowed by current owner settings and
  account state. It never publishes a private collection or changes another
  collection's hold. Existing public/share access may return; unpublishing,
  deleting or suspending the owner does not erase enforcement history.

Holds are independent across referenced collections. Account suspension and holds
compose: releasing either does not bypass the other. Copying content into a new
collection is a separate moderation case; automated fingerprinting is deferred.

## Persistence and enforcement

Additive persistence follows existing camelCase/snake_case conventions:

- Account availability and a version for optimistic concurrency, keyed by
  user ID; current suspension reason/time stored without a content payload.
- Separate unique admin/operator grants and a singleton bootstrap invitation
  record; protected service invitations track recipient binding, expiry, version,
  consent state and delivery reference.
- A unique `OperatorGrant` per user, with grant time and authority reference;
  grant/revoke history lives in the operator audit.
- `CollectionHold` keyed by collection ID with active state, bounded reason,
  actor/time and version; no copy of the collection's authored text.
- Append-only `OperatorAudit` with UUIDv7 ID, database timestamp, actor kind
  and optional actor user ID, target IDs, action, reason code, before/after
  state, request ID and operation ID. Audit IDs must survive target deletion.

These models do not add a role field to `User` or embed permissions in sessions.
A dedicated backend operations module owns these workflows. `resolveSessionUser`
and the app-owned auth wrapper enforce account availability; the collection
policy evaluates availability restrictions before ordinary access grants.
Every list and resource/export path must use equivalent availability rules,
including direct database queries that do not currently call the policy.
Operational account lookup is an explicit cross-user metadata query, never a
general exception to hub scoping for content queries.

Use the existing auth transaction/advisory lock when coordinating suspension,
session creation, revocation and email handover. Recheck actor authority and
target state inside mutation transactions; lock account/collection
rows in a consistent order with the domain services. A concurrent transfer,
publication, resource-reference or share mutation must not escape a newly applied hold or
suspension. Reads begun after a restriction commits must deny access; already
returned/downloaded content cannot be recalled. Authenticated mutation races
must be serialized so a revoked actor cannot commit a later privileged action.
The implementation plan must name and test the shared lock order.

Mutations take an expected version and an operation ID scoped to actor/action/
target. After current authorization, same-ID retries return the recorded
outcome; reusing an ID with a
different payload or using stale state fails safely (409). A deliberate new
session-revocation command removes sessions created since an earlier command.
Operation IDs remain deduplicated for the audit retention window; older
submissions require refreshed state and a new operation ID. UI actions never
retry automatically. Restrictions and their audit records
commit together; audit-store failure rolls back the action. Invitation and role transitions
follow the same rules. Domain collection changes keep their existing audit.

## Audit, reasons and retention

Reasons for mutations come from a bounded catalog: `spam`, `harmful_content`,
`account_compromise`, `owner_request`, `mistake_corrected`, `review_completed`
and `access_administration`, constrained to appropriate actions. There is no
free-text allegation or arbitrary JSON payload. Product copy for owners uses
safe explanations; raw reasons are never exposed to public readers.

Audit successful state changes, no-op commands, account lookup/detail access,
operator-audit reads and denied operator actions from authenticated callers.
Record targets as immutable IDs; a lookup with no match records only the
operation and outcome, not the searched email/handle. Never record tokens,
codes, email addresses, content, raw request bodies or session identifiers.
Unauthenticated probing remains subject to ordinary request budgets; it must
not create an unlimited operator-audit write stream. Audit reads include a
snapshot cutoff so recording a read does not destabilize pagination.

Operator events retain 365 days, then expire in bounded database cleanup.
Current grants/restrictions remain authoritative independently of that history;
cleanup must never lift a suspension or hold. Auth audit keeps its existing
90-day policy; hub audit remains separate. No delete/edit audit API or user
export of operator history ships. Routine application paths append only;
retention cleanup is the sole application deletion path. This is an operational
retention decision, not a claim of legal compliance or tamper-proof storage.

## Delivery and acceptance

The implemented journey begins with **startup admin invitation → explicit
acceptance and session verification → admin-owned operator invitations → explicit acceptance**. The
operating journey is **operator sign-in → account search →
account/session action or public-content hold → audit → recovery**. It includes
the reusable email-code sign-in/session journey; do not ship a separate admin
login protocol or a dashboard of inactive controls. The web uses `/ops` and
`/api/v1/operations/*` for the API, with immutable target IDs. The web area is
four tabs — Accounts (`/ops`), Collections, Team (admin only, `/ops/team`) and
Audit — with listings as minimal tables and row actions that return to the same
listing. A required reason plus a clearly labelled button is the deliberate
step (no confirmation checkbox). All operator responses are private and
no-store; search text stays out of page URLs and logs: the web posts it and
carries it only as a short-lived encrypted `s` value. Route existence must not leak
user metadata to ordinary users. Add these literal routes ahead
of the dynamic handle route. Detailed screen contracts and Impeccable work
belong to implementation, under the existing web design documents.

The implementation ExecPlan covers:

1. Additive migration review, wire contracts, bootstrap/recovery invitations and
   product-owned operations/audit services; no real grant during development.
2. Shared auth and collection availability enforcement, concurrency locks,
   expiry/retention cleanup and safe public/list/export behavior.
3. Real email-code sign-in, safe local return paths, session expiry/sign-out,
   operator actions with recent authentication, visible consequences and
   conflict/retry recovery; ordinary users get no operator navigation.
4. Production browser proof and an operator runbook; reconcile status docs,
   then review the complete milestone before committing.

Acceptance must prove active user versus operator versus suspended/revoked
operator, cookie and bearer boundaries, cross-hub privacy, no implicit grants,
email handover/re-invitation, admin protection and invitation races, pending-code/session races, audit
rollback, stale/replayed actions, and restriction races with transfer/reference creation.
Exercise ID/pretty/reference/resource/export routes, public/shared/saved lists,
independent child holds, owner corrections, reactivation and explicit release.
Use isolated synthetic users, disposable DB/queues and capture email. Check
no-JavaScript sign-in/recovery, keyboard, narrow screens, freshness/history and
CSRF through the actual web origin. Run `bun run verify` and
`bun run test:browser` sequentially; run `bun run test:dev` if entrypoints change.

Live sender/provider validation remains a public-release prerequisite. Existing
MFA/SSO deferrals are unchanged. Operators authenticate with the decided local
email-code flow; no identity-provider claim automatically authorizes service
operations. Nothing in this document claims deployed operator access today.


Invitation notifications are informational messages directing recipients to the
emailed Review invitation button. Notification IDs never authorize acceptance.
Legacy status routes remain readable but do not send people through another
link-entry page. The manual emailed-link field is shown only without JavaScript,
as an accessible fallback for fragment handling; normal email links open review
automatically. Invite codes are deferred.
