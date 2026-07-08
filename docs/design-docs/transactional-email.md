# Transactional Email

## Direction

Use Resend as the initial transactional-email provider. It fits the
namestarlit-VPS deployment model because the application only needs an HTTPS
API, signed webhooks, and restricted deployment secret files — no outbound SMTP
infrastructure to operate. Keep provider-specific code behind an application
adapter so switching providers does not change domain workflows.

Initial messages:

- email verification;
- password reset;
- collection-share notification (a collection was shared directly with an
  account);
- pending collection share to an unregistered email (Phase E — activated on
  sign-up);
- account-security notification;
- high-priority operational alert when explicitly configured.

Do not use the transactional channel for marketing.

## Authentication Boundary

better-auth owns credentials, sessions, and verification primitives (see
`AGENTS.md`). The product does **not** re-implement verification, OTP, or reset
flows. better-auth **mints** the verification token, reset token, or OTP and
decides the flow; the application-owned outbox + Resend adapter only **deliver**
the message better-auth asked for.

Concretely, better-auth's `sendVerificationEmail` / `sendResetPassword` (and any
OTP send hook, if enabled) callbacks receive the opaque token or URL from
better-auth and enqueue an application email-outbox intent. They never call the
Resend SDK directly and never construct their own tokens. When the ns-series
identity provider (nsauth) exists, verification and reset delivery may move
behind the SSO boundary (`docs/design-docs/identity-sso.md`); this adapter is
the seam that makes that migration a delivery-path change, not a workflow
change.

## Application Boundary

Expose a provider-neutral interface owned by the API:

```ts
interface TransactionalEmailProvider {
  send(message: TransactionalEmailMessage): Promise<SendEmailResult>;
}
```

Business modules (hubs, collections, auth hooks) enqueue an email intent. They
do not call the Resend SDK directly. Application-owned React Email templates and
rendering live in a backend-owned `packages/email`. The email worker loads
authoritative intent state from PostgreSQL, selects an approved typed template,
renders both HTML and plain text, and passes the rendered message to the
provider adapter.

Providers do not own templates. Do not pass React components directly to the
Resend adapter or upload the authoritative templates into Resend. This keeps
template review, tests, retention behavior, and a future provider migration
inside the application boundary.

Template inputs:

- contain only the minimum values needed to render the approved message;
- never include recipient addresses because delivery metadata owns recipients;
- use opaque, expiring application URLs rather than raw record IDs (hubId,
  collectionId, and share IDs are immutable UUIDv7 values and must
  not leak into provider-visible URLs or tags);
- avoid names and hub details unless a reviewed message requires them;
- remain typed and discriminated so unsupported message kinds fail before
  provider delivery.

Implement this boundary alongside authentication delivery, not as late
production polish. Email verification and share notifications are not usable until
the provider-neutral outbox path, worker delivery, and an
environment-appropriate sender exist.

Use:

- a deterministic in-memory or restricted local-capture sender for automated
  tests and local development;
- the Resend adapter for deployed environments.

The local/test sender must not print verification links, reset links, OTPs,
recipient addresses, or rendered email bodies to ordinary application logs.
Expose captured messages only through test assertions or a deliberately
restricted local-development inspection path. (This is the replacement for the
current logged no-op intent recorded in the tech-debt tracker.)

## Delivery Workflow

Use a PostgreSQL outbox so API requests do not depend on synchronous email
delivery:

1. complete the business transaction (e.g. create the share row);
2. append an email-outbox record in the same database transaction where
   appropriate;
3. let the outbox relay publish a minimal BullMQ email job;
4. let the email worker fetch authoritative delivery state from PostgreSQL;
5. render the approved React Email template into HTML and plain text;
6. send the rendered message through the environment-selected provider with an
   idempotency key;
7. record the provider message ID and send result;
8. process signed Resend webhooks idempotently;
9. update delivery, bounce, complaint, delay, failure, and suppression status.

This is the outbox + worker split tracked in Phase E
(`docs/SYSTEM_DESIGN.md`); email is the first — and currently
only — consumer that makes it mandatory (exports are synchronous and never
queue). Run delivery in a separate worker process
built from the API image. Scale the worker independently or split specialized
workers only when measured load or failure isolation justifies it.

Do not place recipient addresses, subject lines, template variables, or
rendered content in Redis job payloads. Queue only the email-outbox ID or
another purpose-limited opaque reference.

## Templates And Rendering

`packages/email` is backend-owned and provider-neutral. It initially includes:

- email verification;
- password reset;
- collection-share notification.

Each render returns an application-owned subject, HTML body, and plain-text
body. Keep subjects free of personal or sensitive data. Use conservative
email-client-compatible layout and inline styles; the web Tailwind theme (Track
W3) is not an email rendering contract.

Every approved template:

- accepts an explicit supported locale and renders matching language metadata,
  subject, preview, body copy, actions, and expiry units;
- includes a configured HTTPS support route for unexpected-message recovery;
- includes viewport metadata and conservative narrow-client adaptations;
- validates HTTPS action and support URLs, expiry bounds, product-name bounds,
  and purpose-specific values before rendering.

Import only the focused React Email components and renderer used at runtime. Do
not depend on the preview/CLI package from production rendering code.

Tests must prove that each approved template renders both formats, includes its
required opaque action or code and support route, uses localized language
metadata and copy, handles singular expiry units, retains meaningful-text WCAG
AA contrast, and does not emit missing placeholder values. Delivery integration
tests remain responsible for proving that sensitive content stays out of
ordinary logs, Redis payloads, and external telemetry
(`docs/design-docs/observability.md`).

## Idempotency

Every send must have an application-owned idempotency key. Do not include raw
user, hub, collection, or share IDs in provider-visible idempotency keys.
Use a random outbox-message ID or a purpose-limited opaque reference.

Resend retains idempotency keys for a limited window. Keep the durable
deduplication state in PostgreSQL so retries remain safe beyond the provider
window.

## Domain And Deliverability

Use a dedicated sending subdomain such as:

```txt
notify.example.com
```

Configure and verify SPF, DKIM, and DMARC (starting with a monitoring policy and
tightening after validation), plus a monitored reply-to or support address.
Using a subdomain isolates transactional sending reputation from other domain
mail.

Production sending-domain verification and DNS rollout can finish during
deployment preparation, but the Resend adapter and queued delivery path ship
with the auth-delivery slice.

## Webhooks

Expose an API webhook endpoint such as:

```txt
POST /webhooks/resend
```

Requirements:

- verify the Resend webhook signature against the raw request body (respect the
  better-auth-before-body-parser ordering in `app.setup.ts` — the webhook route
  needs the raw body, like the auth handler);
- reject invalid signatures;
- process webhook deliveries idempotently because providers retry;
- retain only fields required for delivery state and support;
- avoid logging webhook payloads;
- alert on sustained webhook failures.

Subscribe initially to `email.sent`, `email.delivered`, `email.delivery_delayed`,
`email.bounced`, `email.complained`, `email.failed`, and `email.suppressed`.

Disable open and click tracking unless there is a concrete product requirement.
They add privacy considerations and are not needed for authentication or
share-notification emails.

## Privacy

Email delivery necessarily sends recipient addresses and rendered message
content to Resend. Treat Resend as a processor of personal data and review its
data-processing agreement before production.

Minimize provider-visible data:

- use templates with the smallest necessary variable set;
- do not put personal or sensitive data in subjects;
- link users back to the authenticated application for sensitive details;
- do not include raw IDs in tags, idempotency keys, or URLs;
- do not emit recipient addresses, subjects, template variables, or webhook
  payloads into external telemetry.

Store only the minimum delivery metadata required by the application. Define a
retention policy before production.

## Secrets

Store `RESEND_API_KEY`, `RESEND_WEBHOOK_SECRET`, and sending-domain
configuration. Provide credentials to the API or email worker through the
deployment's restricted `_FILE` secret contract
(`docs/design-docs/infra-deployment.md`). Do not bake them into images, source
control, or external telemetry.

## Alternatives

Re-evaluate the provider when delivery volume or pricing materially changes,
regional data-handling requirements change, support or deliverability does not
meet requirements, or the product needs advanced inbound mail, marketing
automation, or dedicated IP controls. Likely alternatives are Postmark for a
strongly transactional focus and Amazon SES when cost optimization justifies the
additional operational overhead.
