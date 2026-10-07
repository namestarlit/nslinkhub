# Auth-delivery integration

Decision: 2026-10-05. Dependency pinned by `bun.lock`: better-auth **1.6.23**.
The user approved email codes as the only signup/sign-in method and both
email-change proofs; the earlier password-fallback decision is superseded. Optional TOTP/recovery codes follow separately;
collection invitations remain sharing work, without hub memberships.

## Ownership and transaction boundary

`create-auth.ts` composes better-auth; `delivery-auth.ts` supplies its Prisma
adapter and personal-hub hook with the request's transaction client. The library
mints, hashes and consumes OTPs, writes credentials, creates sessions and
revokes them. No parallel proof store or custom OTP comparison exists.

Every mutating auth request takes PostgreSQL transaction advisory lock
`74201931`. This initially serializes auth writes across replicas, including
code session creation, resend and handover. Reads and domain writes remain
concurrent. This is a deliberate small-installation throughput tradeoff: measure
lock wait before replacing it with carefully ordered account/challenge locks.
Transaction acquisition is bounded to 5 seconds and execution to 15 seconds.
No provider request occurs inside an auth transaction.

The OTP delivery callback renders an approved template and persists an
AES-256-GCM-encrypted outbox payload in that same transaction. Its key is
domain-separated from the auth secret. An outer failure flag and expected
callback count detect better-auth's swallowed callback errors, so a failed
persistence operation cannot report success. HTTP 5xx rolls back; invalid proof
responses commit attempt consumption. Responses are returned only after commit.

The original seven native compatibility tests remain negative evidence for the
unwrapped library. `auth-delivery.e2e.spec.ts` proves the production wrapper,
including separate-process consumption and rollback after final handover work.
Native magic-link behavior is historical evidence, no longer a product blocker.

The pinned library's `change-email-otp-${old}-${new}` identifier is ambiguous:
distinct address pairs can share it. Before invoking handover endpoints,
`handover-proofs.ts` binds the request-local, fully initialized internal adapter
to purpose-specific HMAC identifiers over a JSON tuple of immutable user ID,
initiating session ID, current address and target address. Creation, lookup,
atomic consumption, updates and deletion all delegate to better-auth under
that namespace; proof generation, hashing, comparison and attempt accounting
remain library-owned. Outbox challenge keys use the same identifiers. Sign-in
proofs keep their existing namespace. No lookup falls back to legacy handover
identifiers; pre-fix in-progress handovers must restart.

Restarting handover deletes both prior scoped proofs through better-auth and
erases their pending email payloads in the same transaction as intent replacement.
This also prevents returning to an earlier account/session/address tuple from
reviving its code. Regression coverage reproduces the colliding address pairs,
checks independent delivery and completion, rejects legacy rows, and proves
restart invalidation and the native wrong-attempt limit.

## Public HTTP contract

All paths below are under `/api/v1/auth`, use JSON POST and return no-store
responses. Eight-digit codes expire after five minutes and allow three wrong
attempts. Resend rotates proof. Shared PostgreSQL budgets allow five issues and
15 verification attempts per identity per ten minutes; the existing source
budget also applies (30 auth requests/minute). Budget keys are purpose-bound
HMACs, never raw addresses. Delivery failures return 503; budget rejection 429;
invalid proof 400 or exhausted proof 403. Cookie requests require the configured
origin; cross-site requests are rejected independently of library test defaults.

The composition root explicitly disables better-auth's native HTTP rate limiter
in every environment. Its production-only, in-memory OTP default (three requests
per minute per IP/path) conflicts with the shared budgets above. `configureApp`
mounts the PostgreSQL source budget before every auth route; `delivery-auth`
enforces identity budgets, while better-auth retains the three-wrong-attempt
limit for each proof. A fresh `NODE_ENV=production` child process exercises the
configured HTTP stack, including distinct-address issuance, resends, actual
sign-in, the identity verification ceiling and the source ceiling despite
spoofed forwarding headers.

| Path | Body | Success |
| --- | --- | --- |
| `/code/send` | `{ email }` | `{ success: true }`; same shape for new/existing/suppressed addresses |
| `/code/verify` | `{ email, code, name? }` | better-auth token/user response and session cookie/bearer header |
| `/email-change/start` | `{ newEmail }` | current-address confirmation queued; names the target address |
| `/email-change/confirm-current` | `{ code }` | new-address verification queued after current proof |
| `/email-change/confirm-new` | `{ code }` | address applied, all sessions revoked; client clears identity/cache and signs in again |

Email-change steps require the initiating session. The workflow intent binds
immutable user/session IDs, current and target addresses, phase and ten-minute
expiry. Starting again replaces that intent. Generic sign-in codes cannot
confirm it. Occupied-target issuance keeps a generic success response without
sending mail to that account. GET never consumes authentication proof. Native
OTP, verification, magic-link and password-reset HTTP paths are unavailable so
they cannot bypass the delivery or workflow boundary. The explicit native
allowlist preserves sign-out, session revocation and non-credential user updates.
Password signup/sign-in/enrollment/change/reset are unavailable, and better-auth
email/password authentication is disabled. No password migration or compatibility
workflow is needed: the product has not been deployed. The vendor adapter's
account schema stays intact but no password credential is created by code signup.
Mailbox verification and the library's unproven-account protection stay enabled.

The optional `name` on code verification is a trimmed, nonempty display name
(up to 255 characters), used only at first account creation. Existing users'
profiles are unchanged by sign-in. `PATCH /profile` accepts the account's full
name (`displayName`), plus its owned hub's name (`hubName`), handle and description
(`hubDescription`). It does not edit credentials.
Account deletion is disabled until verified deletion and ownership/retention
rules are designed. Handover preserves the immutable user and hub identity.

## Delivery and privacy

PostgreSQL owns delivery truth. BullMQ jobs contain only `{ id }`, with an
`email-v1` name and a configured namespace. The separate API-image worker
periodically republishes eligible intents, so Redis loss does not lose mail.
An atomic database claim, random fencing token and 30-second lease prevent
concurrent sends. Provider requests time out after five seconds; retries use
one immutable rendered payload and opaque idempotency key. Five failures are
terminal. A failure recording success leaves the lease for recovery with the
same key; no new message is created. Resend's deduplication window is
[24 hours](https://resend.com/changelog/idempotency-keys/); code delivery stops
at five-minute expiry, and exactly-once external delivery is not claimed.

Credentials are encrypted at rest in pending delivery rows, erased on terminal
outcomes or superseding issuance, and swept after expiry once a live claim ends.
Rotating the auth secret also makes outstanding encrypted mail unreadable; it
fails closed and users request fresh codes. Delivery/webhook metadata lasts
30 days, auth audit 90 days. Expired workflow intents and proof/budget rows are
swept. Suppression HMACs remain until operator review; no raw recipient is kept
in suppression or delivery metadata. Recipient HMACs use a separate stable
`EMAIL_SUPPRESSION_SECRET` (at least 32 characters; `_FILE` supported), required
in production. Keep it unchanged during auth-secret rotation and restore it with
database backups. Changing it requires an operator-reviewed rekey/import of
suppression records; never silently discard existing suppressions. In-flight mail can arrive after resend,
but only the latest proof remains valid. Capture is memory-only, bounded to
100 messages, available to injected tests and never logged or exposed over HTTP.

The raw-body `/api/v1/webhooks/resend` route verifies Svix signatures and a
five-minute timestamp window before parsing events. Event IDs deduplicate;
complaint/suppression/bounce outcomes cannot regress when events arrive out of
order. Resend requests carry a `delivery_id` tag containing only the opaque
outbox UUID, independent of user/hub identities. Signed events echo it in
[`data.tags`](https://github.com/resend/resend-openapi/blob/main/resend.yaml).
This correlates a receipt even after code expiry erased the encrypted payload,
within the 30-day metadata retention window. Receipt recording and suppression
commit together. A signed early receipt stops pending retries and fences the
worker; expired/cancelled rows retain their terminal state. Conflicting provider
IDs, unattempted deliveries and unknown references are never acknowledged as
handled. Events without tags fall back to a known provider ID; unknown IDs
return 503 for retry. Supported events are sent, delivered, delivery_delayed, failed,
bounced, suppressed and complained. Only minimal outcome metadata survives.

## Local and deployment status

Resend provider/key/sender settings were copied, at user request, into ignored
mode-0600 `apps/api/.env`; they are excluded from Docker. No values belong in
docs, logs or telemetry. No source webhook secret was available. Local tests
force capture and isolated queue namespaces. No real email was sent and no live
provider/domain/webhook acceptance is claimed.

See [transactional email](transactional-email.md) for the architectural policy,
[local development](../runbooks/local-development.md) for worker setup, and
[verification](../runbooks/verification.md) for the test lifecycle. Web forms and
browser acceptance remain gate #2 work; do not mark the entire W3 journey done
based on API tests.
