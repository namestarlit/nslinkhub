# Refine public entry and navigation

## Purpose / Big Picture

Give visitors a proper introduction at `/`, discovery at `/explore`, and a
consistent neutral theme inspired by the user's DiceBear reference. Keep the
wordmark isolated on the left and group Explore with account controls on the
right. Signed-in wordmarks still open the person's own hub.

## Progress

- [x] (2026-10-06) Agree direction and inspect the existing reading/auth shell.
- [x] (2026-10-06) Implement landing, discovery routing, navigation and neutral palette.
- [x] (2026-10-06) Verify production browser flows, responsive layout, contrast and full gate.
- [x] (2026-10-06) Prepare the complete verified milestone for review.
- [ ] User review, then commit/push.

## Decision Log

- 2026-10-06: Follow the supplied screenshot's layout: navigation right of the
  wordmark and left of account controls. Preserve the existing system font and
  blue accent; use neutral charcoal surfaces instead of green-tinted dark ones.
- 2026-10-06: Keep the landing illustration clearly labelled as an example.
  Personal collection management is a later web milestone; do not advertise an
  interactive editor or add dead create controls.
- 2026-10-06: System appearance remains the default, including signed-out users.

## Context And Orientation

The Next web root currently reads the API explore feed. `layout.tsx` supplies
session navigation and theme; `globals.css` contains semantic tokens. API reads
and authorization remain unchanged. The example landing shelf is static content.

## Plan Of Work

Move the existing reader into `app/explore/page.tsx`, replace root with a product
introduction, and update discovery links. Group navigation on the right. Adjust
neutral tokens and their canonical design documentation together. Extend browser
acceptance to exercise the entry routes in both themes and without JavaScript.

## Concrete Steps

Run `bun run verify` then `bun run test:browser` in the isolated acceptance copy.
Inspect desktop and phone landing screenshots alongside account/profile checks.

## Validation And Acceptance

Landing CTAs navigate to real pages; Explore remains cursor-paginated and keeps
all reader failure/privacy behavior. Wordmark destinations, titles, system theme,
keyboard access, contrast and small-screen layout remain correct. No horizontal
overflow at phone widths or enlarged text. Anonymous landing has no feed request.

## Idempotence And Recovery

No database migration, dependency or email is needed. Source changes are reversible;
verification uses disposable fixtures and does not alter the running user's data.

## Interfaces And Dependencies

Existing Next server components, React request-scoped session caching and semantic
CSS roles. No new API contract. Discovery remains `GET /api/v1/explore`.

## Surprises & Discoveries

The reader tests used root as discovery; update their default route to `/explore`
and add explicit coverage of the new root landing page.

## Artifacts And Notes

`bun run verify` passed on 2026-10-06 in the isolated acceptance copy
(`/tmp/landing-verify.log`). Desktop dark/light and phone screenshots were
inspected: neutral surfaces, readable hierarchy, separated navigation and no
clipping. Browser checks cover 320/390/768/1280px, 200% text and no JavaScript.

The first browser run exposed two test selectors that assumed one Sign in link
per page. The new landing has header and content actions; scope sign-out checks
to Main navigation. Production behavior was correct; the corrected suite passed
(`/tmp/landing-browser-final.log`).

## Outcomes & Retrospective

Landing, discovery routing, right-grouped navigation and neutral palettes are
complete. Commit and push remain subject to milestone review.


### Final combined acceptance — 2026-10-06

`bun run verify` passed in the isolated acceptance copy, including API unit/HTTP
integration tests, web HTTP tests, boundary/documentation checks, lint/format,
production builds and typechecking. `bun run test:browser` passed **26 tests,
301 assertions, zero failures** (103.35s). It covers landing/discovery, both
appearance modes, mobile widths and enlarged text, native no-JavaScript forms,
invitation consent/OTP, profile retry/newer edits, generated images and private
content revalidation. Desktop/phone light/dark screenshots were inspected.
Temporary logs: `/tmp/landing-verify.log`, `/tmp/landing-browser-final.log`.
Implementation and verification are complete; user review precedes commit/push.


### Follow-up: stable page frame and discovery density

User feedback asks for visible header/footer, denser discovery and no decorative
arrows on anchors. Implementation keeps one keyboard-focusable scrolling main
region between the landmarks. Explore/public hub lists become compact two-column
rows, collapsing on phones. Cursor loading and all API limits remain unchanged.
Remove arrow suffixes from landing, section and external-resource links. Short
viewports retain document scrolling as an accessibility fallback. Validate footer
geometry before/after scrolling and appending collections, enlarged text, keyboard
reachability, production privacy/navigation flows and the repository gate.
Follow-up validation is complete: full repository gate passed before the final
motion additions; those additions passed production build, API/test typechecking,
lint/format, docs and boundary checks. The latest full browser run passed 27 cases;
the frame case then passed separately after correcting a focus assertion that
refocused an already-focused control following manual scrolling. The root overflow
fix prevents the actual footer jump during pagination. Evidence:
`/tmp/frame-verify-final.log`, `/tmp/frame-accepted-browser.log`,
`/tmp/frame-focused-browser.log`. All 28 cases are covered across these runs;
no final single-run 28/28 result is claimed.

The follow-up also stacks the landing introduction as three questions, before
the product description, as requested. The scrollable main landmark deliberately
accepts Tab focus for keyboard scrolling; a narrow, documented lint exception
keeps this accessibility requirement explicit.

User refinement: show one question at a time. The initial short fade was
replaced by slower typing at the user's request; see the final motion direction
below. Screen readers receive the complete text without live announcements.


Final motion direction: replace the fast fade with typing at 65ms per character,
hold each completed question for four seconds, and stop on the last question.
A small Pause/Resume/Replay control gives the reader control. Reserve space for
the longest question, keep the complete sentence available to screen readers
without live announcements, and show static questions with reduced motion or
without JavaScript. No animation library or ongoing loop is needed.


Next session: the user requested a handoff for first-link onboarding and unified
“Continue with email” entry, not implementation in this session. The proposal is
preserved in `docs/design-docs/web-product-experience.md`; disposable session and
implementation context is in `ref/next-session-first-link-onboarding.md`. Current
primary CTA/auth labels are intentionally unchanged until their complete save
journey exists. Work remains uncommitted, awaiting review.
