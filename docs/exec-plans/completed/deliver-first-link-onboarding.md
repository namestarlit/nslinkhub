# Deliver first-link onboarding

## Purpose / Big Picture

A visitor can choose “Save your first link”, paste a URL, verify email if signed
out, and reach the saved resource in a private collection. Account entry keeps the familiar “Sign in” label while the same email-code flow
serves both new and returning accounts. Sending a code
creates no account or content. Profile customization is optional. Existing owners
choose a destination or create a private collection; publication is never implicit.

## Progress

- [x] (2026-10-06) Read handoff, repository contracts and current auth/content boundaries.
- [x] (2026-10-06) Implement atomic API capture, scoped retry receipts and concurrent first-save handling.
- [x] (2026-10-06) Implement encrypted draft persistence, unified email entry and native capture forms.
- [x] (2026-10-06) Deliver own-hub listing, add-another and optional collection rename.
- [x] (2026-10-06) Verify API/security cases and production browser journeys, update durable docs/changelog.
- [x] (2026-10-06) Prepare completed milestone for user review; changes remain uncommitted.

## Surprises & Discoveries

The working tree already contains uncommitted service operations, invitations,
profile, avatar and landing milestones. Preserve all of them. The original dev
server owns its .next output; run production acceptance in an isolated copy.
Product writes already join a serialized authority transaction and recheck the
session under its advisory lock. This provides the concurrency boundary for capture.
The installed Impeccable skill lives in the home skill directory, not .agents;
its context script and product register were read from that installed location.

## Decision Log

- User direction (2026-10-06, landing refinement): Use the existing system-font,
  charcoal/blue identity. Pair the capture introduction and discovery CTA in the
  left column with a compact example spanning the right; stack on mobile. Keep
  “Discover the links someone kept” directly below its heading. Move browsing
  guidance to Explore and remove the public/no-account-needed note. Brand voice:
  readable, collected, personal; the reference is the existing product collection
  surface and user-provided neutral DiceBear palette, not a new font/color system.


- User direction (2026-10-06): Sign in remains the header/link/page-title label.
  Unified email entry is account behavior, not a navigation rename.
- User direction (2026-10-06): Desktop collection lists show only full rows that
  fit the available frame, with Previous/Next; mobile scrolls. Show title,
  two-line description and hub/updated metadata. Remove repeated row/example
  separators, retain header/footer and the landing discovery section divider.
- Finding (2026-10-06): The local Explore page's first 20 records all had null
  descriptions. Verify populated descriptions in disposable browser fixtures;
  do not invent text or mutate existing records to disguise missing content.


- Decision (2026-10-06): Use native POST forms and existing theme/control vocabulary.
  Rationale: the entire activation journey must work without JavaScript.
- Decision (2026-10-06): Keep each draft in an independently named AES-GCM encrypted,
  HttpOnly, SameSite=Lax cookie for 30 minutes, up to three concurrent drafts.
  Normalize URLs to ASCII and cap serialized plaintext at 2700 bytes, encrypted
  cookie at 3800 bytes. No draft URLs/auth material in query strings or browser
  storage. Opaque UUID draft IDs may occur in routes/return paths.
- Decision (2026-10-06): Store a nullable immutable first-capture collection ID on
  the hub and per-user operation receipts. Revalidate ownership/private state
  before implicit reuse. A first-save intent predates the first collection
  creation (startedAt), allowing concurrent initial tabs while requiring a new
  destination choice for returning owners. Never identify a destination by its title or slug.
  General existing-account capture requires an explicit destination choice.
- Decision (2026-10-06): Ordinary email verification may execute the retained
  first-save intent using the newly issued session. Invitation verification must
  never do this. Save failure retains both the session and the original draft.

## Outcomes & Retrospective

Implemented and verified the first-link journey, private atomic creation, retained
retry drafts, returning-account destination selection, add-another and rename.
Applied the user's landing, copy and collection-browsing refinements. No commit or
push has been made; user review remains the next repository workflow step.
Imports, extension, metadata fetching, publication, sharing management and mandatory
profile/handle setup are outside this milestone. Search/tag discovery is recorded
as future work in the debt tracker.

Validation: `bun run verify` passed in the isolated acceptance checkout, followed
by `bun run test:browser`: 30 passed, 0 failed, 350 assertions. The browser suite
covers JS/no-JS capture, retained session/draft after save failure, expired-session
reverification, duplicate submissions and returning-account choices. API tests
cover concurrent initial captures, receipt replay, invalid URLs and atomic rollback.
The migration was generated/reviewed additively and applied to local development;
Prisma schema comparison reported no difference. Visual review covered light/dark,
390px mobile and 1280/1996px desktop. The landing fits 1280×720 and 1280×900 without
main overflow; mobile scrolls. Docs links and `git diff --check` passed.

Acceptance fixes were test-fixture isolation issues: use native fetch for concurrent
POST assertions to avoid a Bun/Playwright cookie-parser failure, and create an
independent account for description display after prior tests expire sessions.

## Context And Orientation

Auth entry is apps/web/src/app/sign-in; native commands are app/forms/[action].
lib/form-server.ts owns encrypted auth cookies, Origin validation and bounded HTTP
mutations. API collections/resources services own validation and policy. PrismaService
routes service work into the authority transaction. Shared wire contracts live in
packages/types. The browser harness is apps/api/test/browser/reading.browser.ts.

## Plan Of Work

Add additive persistence for first-capture identity and retry receipts; generate
migration with Prisma in a disposable database and review SQL. Add an app-owned
capture command that calls collection/resource services, chooses safe slug/position,
validates HTTP(S) URLs and checks policy/ownership. Add draft sealing and native
capture routes, preserving email flow separation. Replace account-entry wording,
wire the landing only to working capture, show owned collections at /hub, and add
owner-only rename/add controls using backend capability data. Exercise failure,
concurrency and no-JavaScript paths before review.

## Concrete Steps

From repository root run bun run check:docs, bun run types:typecheck and focused
API/web checks while implementing. Use the isolated acceptance copy for
bun run verify followed sequentially by bun run test:browser. Services use the
existing loopback test PostgreSQL/Redis with disposable databases/captured mail.
Never send real emails or reset developer data.

## Validation And Acceptance

Prove new/returning accounts, no creation on code send, wrong/expired/resend codes,
invitation isolation, draft expiry, duplicate submits/concurrent first saves,
private defaults and explicit destination selection, atomic rollback and retry,
session expiry, malicious URLs/returns, narrow viewport/keyboard/reduced motion
and no-JavaScript. Existing reading/operator/invitation browser cases must pass.

## Idempotence And Recovery

Capture uses a user-scoped request UUID and canonical input fingerprint; reuse
with different input conflicts. A receipt returns only after fresh authorization.
The collection/resource/receipt commit together; auth verification is intentionally
separate so a failed save does not discard the verified session. Drafts expire
and successful saves clear only their own cookie. Existing work is not reset.

## Artifacts And Notes

Disposable source handoff: ref/next-session-first-link-onboarding.md. This plan
contains the durable scope so that reference can later be deleted.

## Interfaces And Dependencies

POST /api/v1/capture accepts operationId, URL, and first/new/explicit collection
destination; authority derives from AuthUser and its hub. Clients use HTTP and
@nslinkhub/types only. Existing collection PATCH retains optimistic version checks.
No added runtime dependency, account-existence endpoint or auth-provider change.
