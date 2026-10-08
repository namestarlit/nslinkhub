# Design Documents

Focused designs for subjects too detailed, or changing too often, for the root
documents. `PRODUCT.md` says what the product must do, `ARCHITECTURE.md` how the
system is shaped, `DESIGN.md` how it looks; settled rationale is in
[../engineering-decisions/](../engineering-decisions/README.md) and
implementation work in [../exec-plans/active/](../exec-plans/active/).

## Domain and system

- [tenancy-and-access.md](tenancy-and-access.md): the access model (owner →
  direct share → active link → published), service-operation restrictions,
  ownership transfer, publication and discovery.
- [identity-and-handles.md](identity-and-handles.md): hub handles and names,
  the account's name, code-first sign-in, email change and the web
  URL scheme.
- [collections-and-resources.md](collections-and-resources.md): item kinds and
  their API, link titles and public addresses, tags, and the Save a link
  command.
- [discussion.md](discussion.md): comments, replies, answers, moderation and
  pagination.
- [email-verification.md](email-verification.md): the one verification flow and
  interrupted actions.
- [attribution-and-activity.md](attribution-and-activity.md): activity
  entries, creator, contributors, "added by" and the hub audit (designed).
- [manage-workspace.md](manage-workspace.md): Manage — one workspace scoped by
  role (hub owner, operator, admin), blocking (designed).
- [people-and-hubs.md](people-and-hubs.md): people (@username) and their
  optional hub (name, @handle) as separate identities; one namespace,
  subscriptions, hub created on first save (designed; next to build).
- [notifications.md](notifications.md): one inbox for every kind, scoped by
  role, with per-kind and per-hub settings (designed).
- [hub-home-and-following.md](hub-home-and-following.md): the public hub page,
  your home (My collections, Shared with me, Saved, Following) and following
  (designed).
- [bulk-import.md](bulk-import.md): bulk import through reviewed drafts —
  statuses, fixing rows, folders as sections or separate collections, limits
  (designed; being built).
- [exports.md](exports.md): synchronous Markdown/PDF/Word exports and reference
  expansion.
- [service-operations.md](service-operations.md): operator authority, account
  restrictions, public-content holds, invitations, recovery and audit.
- [conventions.md](conventions.md): API and persistence casing and the response
  envelope.

## Web

- [web-product-experience.md](web-product-experience.md): journeys, copy
  direction, unavailable and dormant states.
- [web-interface-system.md](web-interface-system.md): principles, layouts,
  components, states, accessibility and browser/API boundaries. Theme values
  live in the root [DESIGN.md](../../DESIGN.md).

## Platform and delivery

- [auth-delivery-integration.md](auth-delivery-integration.md): better-auth
  delivery and verified email change, with compatibility evidence.
- [transactional-email.md](transactional-email.md): Resend adapter, React Email
  templates, PostgreSQL outbox and BullMQ worker, signed webhooks.
- [observability.md](observability.md): LogTape/Sentry boundary, telemetry and
  PII rules.
- [infra-deployment.md](infra-deployment.md): namestarlit VPS, Dokploy Stack
  mode, GHCR images and topology files.
- [identity-sso.md](identity-sso.md): ns-series IAM direction ("Continue with
  namestarlit").
- [adoption-decisions.md](adoption-decisions.md): the 2026-10 foundation
  comparison and delivery gates.

## Proposals under review

- [monetization.md](monetization.md): what people might pay for, a tier sketch
  and an early valuation take. Nothing decided.
