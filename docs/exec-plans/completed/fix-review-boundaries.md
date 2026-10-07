# Repair reviewed request and transaction boundaries

## Purpose / Big Picture

Preserve partial imports, keep slow uploads outside the shared authority lock,
keep sign-in journeys valid during throttling, make every readable reply reachable,
and enforce outbound deadlines and visitor-specific DELETE budgets. The user
also requested a collection heading that folds its description while reading,
keeping tags visible.

## Progress

- [x] (2026-10-07) Confirmed six findings against the working tree.
- [x] (2026-10-07) Implemented all six fixes, regression coverage, and contract docs.
- [x] (2026-10-07) Focused unit checks and all eight import/comment e2e tests pass.
- [x] (2026-10-07) API build/typecheck, 170 API tests, 11 web tests, lint/format,
  boundaries and docs pass. Web build/typecheck and both browser regressions
  pass against an isolated source copy.
- [x] (2026-10-07) Added the requested collection heading fold.
- [x] (2026-10-07) Fold browser checks pass for collapse-before-scroll ordering,
  keyboard/Home, title styling, metadata, independent side scrolling, reduced
  motion, mobile resizing and no-JS fallback.

## Surprises & Discoveries

The working tree contains a large uncommitted product milestone. These repairs
must preserve that work and require no schema migration.

Sandbox Prisma generation stalled; verification runs with local process/socket
access. Web type generation found a stale generated route for the already removed
status page; only that generated file was removed. The production-auth fixture
hit its shutdown timeout with pooled fetch sockets; its owned listener now closes
connections before Nest shutdown, matching the browser fixture cleanup.

The original working directory has a Next.js build lock held by a pre-existing
long-running build. Left it untouched and built an isolated copy under
`/tmp/nslinkhub-review-validation`; no secrets/env files were copied. Browser
checks use disposable databases and synthetic verification settings.

The first fold waited for the description height plus 24px of resource travel,
which was too late for the requested sequence. Replaced that threshold with an
initial scroll handoff and verified the actual local collection at 1440px wide,
including a tall viewport where its links fit after folding. Updated browser
regression, isolated web build/typecheck and focused Biome checks pass.

## Decision Log

- Retain the authority transaction/session recheck; parse uploads before it and
  use per-row savepoints instead of removing transaction protection.
- Ease the description closed over 220ms before links move, retaining tags.
  Carry continued input into the links after the transition. Reversing direction
  can interrupt the transition; returning to the top restores the description.
  Respect reduced motion. Keep the folded state when a short list fits its
  expanded viewport. Small viewports keep natural scrolling and no-JS keeps
  the full introduction.
- Give reply pages their own continuation while keeping readable accepted
  answers first. Keep shared contracts and the native web reader in sync.

## Outcomes & Retrospective

All six reviewed defects and the follow-up heading fold are implemented and
covered. Verification: 170 API tests, 11 web tests and three focused browser
regressions pass, with API/web builds and type checks. The original full gate
reaches the web build but cannot acquire the existing build lock; its remaining
web validation passed in the isolated source copy. No commits or pushes were made.

## Context And Orientation

PrismaService routes mutation queries through AsyncLocalStorage into the global
AuthorityInterceptor transaction. Imports catch row errors. The web encrypts
sign-in state into a cookie. Comments currently paginate questions but truncate
replies. Title fetching pins public DNS addresses but uses an inactivity timeout.

## Plan Of Work

Patch the authority/import boundary, flow timing, reply service/controller/types
and web reader, title fetch cancellation, and signed DELETE attribution. Add
regressions at their existing test boundaries and update security/product docs.

## Concrete Steps

From repository root run `bun run verify`. Use the existing isolated e2e runner
for PostgreSQL tests; no development database reset. Run focused unit tests first.

## Validation And Acceptance

A database-invalid import row does not undo valid neighbours. An unfinished
upload cannot hold the authority lock; sessions are rechecked after parsing.
A 60-second resend throttle preserves the flow. Replies on other threads and
late accepted answers remain visible and continuation reaches all replies.
Slow DNS/drip responses end within one wall-clock budget and sockets close.
Signed DELETE requests use each visitor's budget, invalid proofs fall back.

## Idempotence And Recovery

No migrations or remote changes. Repeat tests safely through isolated fixtures.
Do not reset or replace unrelated working-tree changes. Do not push.

## Artifacts And Notes

Review findings supplied in the conversation, 2026-10-07. Local evidence:
`/tmp/nslinkhub-review-verify-final.log`, `/tmp/nslinkhub-review-browser.log`,
`/tmp/nslinkhub-fold-build.log`, `/tmp/nslinkhub-fold-browser.log`. Browser
regressions live in `apps/api/test/browser/reading.browser.ts`; the targeted
runner uses the existing isolated database and verification-env helpers.

## Interfaces And Dependencies

Bun, NestJS interceptors, Prisma/PostgreSQL savepoints, Node HTTP AbortSignal,
Next.js server forms and @nslinkhub/types remain the existing boundaries.
