# Redesign the service operations area

## Purpose / Big Picture

Operators should find people and content the way they know them (an email, a
hub handle, a collection link), act from listings without page hunting, and
read the audit as a filterable table. Each area gets its own tab so one long
list never pushes another task down the page. (User review, 2026-10-07.)

## Progress

- [x] (2026-10-07) Brief agreed; plan written.
- [x] (2026-10-07) API: account search `q`, held-collection listing, collection
  lookup by link, audit `q` + action list and hub handles; lookup endpoint and
  actor/target filters removed.
- [x] (2026-10-07) Web: accessible tab bar; tables with quick actions;
  collection review by link; one-row audit filters; no confirmation checkboxes;
  `/ops/operators` → `/ops/team`.
- [x] (2026-10-07) Tests, docs, changelog; verify and browser (42/42) green.

## Surprises & Discoveries

- Search by GET would put an email in page URLs (the earlier design avoided
  that on purpose). Searches post through `/forms/ops-search`, which seals the
  text into a short-lived encrypted `s` URL value; actions, dates and paging
  stay readable.
- A select inside its label takes the options' text into its accessible name;
  the audit dropdown is labelled with `aria-label` instead.

## Decision Log

- Search by email or hub handle only (an id means you already have the record).
- Collections are found by link (`/c/<id>` or `/@handle/slug`, with or
  without the site origin); the held list shows hub handle, reason and since —
  no titles, so operators never read content that may since have gone private.
- Quick actions keep the required reason; the confirmation checkbox is dropped
  everywhere (a reason plus a clearly labelled button is the deliberate step).
- Invitation "Cancel" is shown as "Revoke"; "Resend" stays (delivery refresh).
- Audit: one search box (email, handle or id; matches actor or target) and an
  action dropdown from a fixed list, plus dates and Clear filters, in one row.

## Outcomes & Retrospective

Delivered as planned, plus a "Confirm it's you" step-up for sensitive actions
(the action is kept and finished after a fresh code; Send code or Cancel before
any email) and code inputs that accept pasted spaces or dashes. Next: one
reusable verification flow for every email-code situation.

## Context And Orientation

API: `apps/api/src/modules/operations/{operations,administration}.{controller,service,dto}.ts`.
Web: `apps/web/src/app/ops/**`, `components/operator-ui.tsx`,
`components/invitation-form.tsx`, `app/forms/[action]/route.ts`.
Contract doc: `docs/design-docs/service-operations.md`.

## Plan Of Work

API first (types in `packages/types/src/operations.ts`), then the web pages,
then e2e and browser journeys.

## Concrete Steps

`bun run verify`; `bun run test:browser` in the isolated checkout.

## Validation And Acceptance

Tabs show the current page (visually and with `aria-current`). An account is
found by email or `@handle` and suspended from its table row with a reason. A
collection is opened for review from its pasted link. Held collections are
listed and released from the row. Invitations are resent or revoked from their
row. The audit filters by a typed email/handle/id and an action, in one row.

## Idempotence And Recovery

No migration. Every operation keeps its idempotent `operationId`.

## Artifacts And Notes

None yet.

## Interfaces And Dependencies

`GET /api/v1/operations/accounts?q=`, `GET /api/v1/operations/collections`
(held), `GET /api/v1/operations/collections/resolve?link=`,
`GET /api/v1/operations/audit?q=&action=&from=&to=`; `operatorAuditActions`
in `@nslinkhub/types`. Removed: `POST /accounts/lookup`, audit `actor`/`target`.
