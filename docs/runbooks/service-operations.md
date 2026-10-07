# Service operations

Service admins and operators use ordinary email-code sign-in and separate
product grants. The contract is [service operations](../design-docs/service-operations.md).
Apply all migrations before starting the API and email worker.

## First admin

1. Configure `BOOTSTRAP_ADMIN_EMAIL` in the API environment (locally, its ignored
   `.env`). Set it to the intended admin's email. Configure the email provider,
   sender and public `BETTER_AUTH_URL` for reachable invitation links.
2. Start the application (`bun run dev` locally). API startup atomically records
   one admin invitation and queues its email. The email worker delivers it.
   No user or role is created by startup; restarting does not repeatedly send it.
3. The recipient uses the **Review invitation** button in the email and accepts.
   Only new recipients enter a name; consent creates their account and hub.
   Everyone then enters a fresh email code, including recipients already signed
   in. The role activates only after verification, then `/ops` opens. Existing
   names stay unchanged. A wrong-account session must sign out first.
4. Open **Operators and invitations** to invite others. They follow the same
   email-entry journey. Invites expire after seven days. Sending one creates only
   the invitation and delivery records; abandoned invitations create no accounts.

Acceptance uses the private token in the emailed link, not the account's status
listing. The link creates no session and GET consumes nothing. Without JavaScript,
paste the email link into the invitation entry form. Existing recipient accounts
are also pinned to immutable user IDs. Changing the configured bootstrap address
does not create another admin. The transition from old ID-only links sends one
replacement email for a still-pending tokenless initial-admin invitation.

## Invite and manage operators

Only admins can open `/ops/operators` to invite, resend or cancel operator
invitations and inspect queued/sent/failed/suppressed delivery state. Resending
extends expiry by seven days and invalidates the old token and form version. Multiple
operators are supported. There is no command to directly grant operator access.

Open an operator's account to **Remove operator access**. Their account stays
active; removal takes effect on the next privileged request. Restoring access
requires a fresh invitation and acceptance. Operators cannot administer another
operator or admin account. Admin suspension is unavailable through these tools.
Routine admin/operator mutations require email-code verification within five minutes;
reauthentication returns to the page for another deliberate submission.

Verified email handover removes both service roles, ends sessions, and cancels
pending incoming/authored invitations. Account suspension also invalidates these
workflows. Reactivation never restores service authority.

## Emergency admin recovery

If the initial invitation expired, was declined, or no active admin remains,
use a trusted interactive deployment terminal to issue a replacement invitation:

```bash
bun run --filter @nslinkhub/api admin:recover person@example.com
```

In a compiled deployment workspace use `admin:recover:prod`. Run with the normal
database/mail secret inputs. Retype the email to confirm. Bun filters pipe package streams, so the command
uses the controlling terminal for this prompt; unattended input is rejected. The command refuses
while an active admin exists, cancels older pending bootstrap invitations and
records the deployment authority. It never grants a role directly: the recipient
must complete the same verified acceptance flow. Each deliberate recovery
invocation issues a new invitation; inspect delivery before repeating it after
an uncertain result. Never delete bootstrap records to force a startup resend.

## Everyday operations

Open `/ops` and use exact email, user UUID or hub handle lookup. Account pages
show identity, availability, active session count and operational authority.
They do not enumerate private collections. Each action shows its effect and
requires a reason and confirmation. No mutation is submitted automatically.

- **Suspend account:** ends sessions, invalidates outstanding proofs and removes
  operator authority; hides the owned hub/content from others. Records and
  sharing settings remain. You cannot suspend yourself.
- **Reactivate account:** allows fresh sign-in. Existing publication/sharing may
  return except where separate collection holds remain; old sessions/proofs
  and operator grants stay revoked.
- **End all sessions:** forces fresh sign-in without changing account availability.
  Using it on yourself signs you out too.
- **Hold distribution:** enter a public collection's immutable ID on `/ops`.
  Inspect it with normal reader access, then hold its distribution to all
  non-owners, including shares, links and sections. The active owner can read
  and correct it. No private preview is retained for the operator.
- **Release hold:** restores only access permitted by current publication,
  sharing, account state and any independent collection hold. It never republishes
  a collection. Review those consequences before confirming.

Owner correction remains available through the existing content API; personal
editing screens are a later W3 milestone. Owners see a restriction notice and
the configured support link on their collection page. The hold's active record
remains independent of the audit history.

## Failures and review

A stale state returns 409. Reload, review current state and deliberately submit
a new action. A repeated operation ID with the identical payload returns its
original result; a changed payload conflicts. After a timeout the action may
have committed: inspect current state/audit before deciding to resubmit.
Expired recent authentication leads to sign-in and back to the target page;
it never replays the operation. An expired/revoked session cannot use `/ops`.

Use `/ops/audit` to filter by actor ID, target user/collection/invitation ID, action or UTC
date range. Pagination keeps a snapshot cutoff while audit reads themselves
are recorded. Lookups never store their searched email/handle in this history.
The audit records bounded reasons and immutable IDs, not free-text allegations,
credentials or content. Service operators cannot edit/delete audit entries.

The API maintenance task removes at most 1,000 operator events older than 365
days per minute. It never deletes current restrictions or grants. Invitation metadata expires in
bounded batches 30 days after invitation expiry; grants and the bootstrap record
remain independent of that cleanup. Auth history
retains its existing 90-day policy; hub audit is separate. Monitor database
health and maintenance failure signals using the existing observability runbook.
Audit persistence failure rolls back the protected action.

## Configuration and acceptance

For Resend, `EMAIL_FROM_ADDRESS` includes the sender display name as well as
the configured mailbox, for example `nslinkhub <no-reply@your-domain.example>`.
The subject and body come from the nslinkhub templates; the sender name comes
from this setting. Keep deployment/local sender configuration consistent.

API and web must share `BETTER_AUTH_URL` as the exact public HTTP(S) origin,
plus the independent `WEB_SOURCE_SECRET`. Never trust arbitrary forwarding
headers: configure only actual ingress addresses in the API/web proxy settings.
The web entry point overwrites read/form attribution; forms verify the browser
Origin before forwarding bounded JSON. The API independently checks Origin,
session, current grant and recent verification. Operator APIs do not accept
bearer authentication as a substitute for a cookie session.

Run `bun run verify`, `bun run test:browser` and (when entrypoints change)
`bun run test:dev` sequentially, using the existing disposable capture fixtures.
Never grant or suspend a real user for a test, reset developer data, or stop
shared services to simulate failure. Build in an isolated copy while a dev
server is using the working checkout. Local acceptance does not prove live
sender/domain, provider-webhook or deployment acceptance.
