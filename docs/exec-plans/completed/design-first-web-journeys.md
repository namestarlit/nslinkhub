# Design the first web journeys

## Purpose / Big Picture

Start adoption gate #2 with its complete design milestone: the three W3
documents required before `apps/web` scaffolding. A contributor should be able
to implement the public reading journeys, their failure states and the browser
boundary without inventing product rules. This milestone produces designs;
it does not claim that gate #2's browser acceptance is implemented.

## Progress

- [x] (2026-10-05) Reviewed foundation contracts and the isolation fix committed
  as `fb32eb9`; guide pin `bf111f1`; both pushed after full verification.
- [x] (2026-10-05) Read the product, URL/access, origin, contract and adoption
  decisions; inspected the existing email presentation and API read routes.
- [x] (2026-10-05) Wrote product experience, interface system and canonical
  token documents; every first-slice route maps to an existing API contract.
- [x] (2026-10-05) Applied Impeccable to the draft documents, selected a light
  theme and hue-230 accent, calculated contrast, and reconciled the document
  index, product decisions, adoption status and walkthrough.
- [x] (2026-10-05) Full verification passed (77 tests plus isolation checks);
  design milestone completed and prepared for review.

## Surprises & Discoveries

- The committed email template deliberately uses provisional neutral styling
  until W3 tokens exist. There is no established web theme to migrate.
- The existing development auth URL points to port 4000. Browser scaffolding
  must align auth with the web origin and prove cookie/CSRF behavior; a rewrite
  by itself is not that proof.
- The first read API supplies hub handles but no public owner display-name
  profile, resource totals, cover images or access-capability response. The
  design must work with those contracts instead of inventing fields.

## Decision Log

- Decision: Complete the three-document design milestone before scaffolding.
  Rationale: Product and repository instructions require the design to precede
  web implementation; review should cover a coherent milestone.
  Date/Author: 2026-10-05 / Codex
- Decision: Keep the first public experience focused on reading collections.
  Rationale: Recency discovery, stable links and ordered resources are already
  supported; account delivery and editing have separate acceptance gates.
  Date/Author: 2026-10-05 / Codex
- Decision: Use a pure-white canvas, system sans and restrained blue actions;
  keep recency discovery and show dormant saves as unavailable rows.
  Rationale: The daylight reading scene and existing API fields favor legible
  ordered lists; no recommendation, thumbnail or profile data is invented.
  Token contrast and detailed states are recorded in the three web documents.
  Date/Author: 2026-10-05 / Codex

## Outcomes & Retrospective

The three-document design milestone is complete and ready for review. Gate #1
is committed and pushed. Gate #2's implementation and browser acceptance remain
outstanding: next scaffold `apps/web`, add runtime configuration and HTTP
boundaries, implement the reading journeys, and prove cookies, CSRF, isolation,
revocation and browser states. No web code or live infrastructure changed here.

## Context And Orientation

`PRODUCT.md` and `docs/SYSTEM_DESIGN.md` own product behavior. Gate #2 in
`docs/design-docs/adoption-decisions.md` owns the first web implementation's
acceptance. The three `web-*` documents in `docs/design-docs/index.md`
divide experience, interface patterns and concrete theme values. Shared API
types live in `packages/types`; clients cannot import backend internals.

## Plan Of Work

Draft the three documents from current contracts. Apply the Impeccable product
register after those documents exist, as required by `AGENTS.md`. Set a visual
direction and explicit states, validate token contrast, and record deferred
features without creating placeholder navigation. Update the index, product
decisions, adoption status and walkthrough. Run the repository gate and archive
this plan when the design milestone is complete and ready for review.

## Concrete Steps

Read the current contracts and the Impeccable context/product reference. Write
the three design documents; check the palette's text/action/focus contrast.
Run `bun run check:docs`, `bun run check:guide-pin`, `git diff --check` and
`bun run verify`. Keep the guide pin at the last reviewed commit until this
milestone is itself reviewed and committed.

## Validation And Acceptance

- Every first-slice page maps to existing HTTP contracts; navigation promises
  only implemented journeys.
- Designs specify anonymous, authenticated, empty, loading, unavailable,
  expired and revoked-access behavior with no private-state caching.
- Immutable permalinks, recency-first discovery, inherited access and the
  code-first account flow preserve authoritative product decisions.
- Tokens have concrete values and contrast evidence; component, keyboard,
  mobile and reduced-motion behavior are explicit.
- Browser-origin auth, CSRF, downloads and timeout checks remain explicit
  implementation requirements, not claims of completed verification.

## Idempotence And Recovery

Documentation and local design checks only. No application data, auth state,
live infrastructure or deployment changes. Future implementation uses the
existing disposable verification database lifecycle.

## Artifacts And Notes

Foundation push: `fb32eb9` and `bf111f1`, pre-push gate green (77 tests).
`bun run verify` passed for this design milestone: 77 tests, plus database
isolation and repository checks. Disposable log:
`/tmp/nslinkhub-w3-design-verify.log`. `check:docs`, `check:guide-pin` and
`git diff --check` passed. Text-token contrast bottoms out at 6.14:1 among the
specified text pairs; control borders are at least 3.28:1. The token document
records the calculation method and full ratios. This is design-level contrast
evidence, not a screenshot or browser-accessibility claim.

Design changes remain uncommitted for milestone review. The walkthrough still
pins the reviewed foundation commit `fb32eb9`; after a reviewed design commit,
sweep and advance the pin in its required guide-only follow-up.

## Interfaces And Dependencies

Next.js web, Bun workspace, Tailwind theme tokens and Biome; one public origin;
API-owned authorization; `@nslinkhub/types`; no locale prefixes, browser bearer
storage, Prisma imports or client-owned policy decisions. Auth delivery remains
gate #3 and production rollout remains a separate operator milestone.
