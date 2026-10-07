# Unify the web visual system

## Purpose / Big Picture

The W3 web app works, but its screens do not read as one product: each page
starts at a different left edge, accent blue colors almost every title and
label, row spacing differs between Explore, hubs and the reader, the landing
uses a card/icon vocabulary nothing else shares, and the typeface changes with
the visitor's operating system (Ubuntu on Linux, Segoe on Windows). After this
change every surface shares one typeface, one content edge, one row and
button vocabulary and one restrained accent budget, in both light and dark
themes, so the product feels deliberate and premium while behaving exactly as
before. Observe it by navigating landing → Explore → hub → collection →
sign-in → settings: the content edge, type and controls stay constant.

## Progress

- [x] (2026-10-07) Audit signed-out desktop surfaces in both themes; run the
  Impeccable detector (no slop-pattern hits); brief the user.
- [x] (2026-10-07) User decisions: self-host one sans typeface; user signs in
  for signed-in screens; seed invented demo content into the local dev DB.
- [x] (2026-10-07) Seed demo hubs `@ada-reads` and `@field-notes` (local dev
  DB only; generator kept in ignored `ref/design-review-seed.py`).
- [x] (2026-10-07) System pass in `apps/web/src/app/globals.css` (rewritten,
  same class hooks): typeface, tokens, content edge, rows, links, buttons,
  forms, states.
- [x] (2026-10-07) Surface pass: landing example mirrors the reader; nav Sign in
  button; resource meta line with external/collection cues; hub count pill;
  owner empty state; settings spacing; `/ops` context nav without chevrons.
  Browser-checked landing, Explore, hub, reader, capture, settings, owner hub,
  account menu and `/ops` at 1440 px light/dark, 390 and 320 px.
- [x] (2026-10-07) User correction: the wordmark stays plain text; removed the
  added icon mark and its favicon.
- [x] (2026-10-07) Verify 320/390/1280/1440 px, light/dark, pagination
  capacity at 720 and 1080 px heights; `bun run verify` passed; `bun run
  test:browser` 36 passed, 0 failed, 430 assertions (isolated checkout, not
  the live dev `.next`).
- [x] (2026-10-07) Update tokens/interface/experience docs and CHANGELOG.

### Round 2 (2026-10-07, user review)

User feedback on the first pass, with decisions:

- [x] (2026-10-07) Slice A, web UX (plus one shared 38/44 px control size after
  user review): landing hierarchy and looping questions (no control);
  Explore becomes Discover at `/discover` (`/explore` redirects) titled
  "Someone already found your next good read." / "Discover the links someone
  kept"; calmer, fully clickable collection and resource rows; informational
  notices neutral (not yellow); transient confirmations as top toasts; Share
  menus replace Copy link / Copy hub link (Settings keeps Copy hub link);
  signed-in "Save a link" moves to the top bar; reader styled like the landing
  example with one owner Edit button leading to a dedicated `/c/:id/edit` page;
  Settings keeps its width but fits one viewport, drops the duplicate Sign
  out, hub ID in the body font; no focus frame on the scroll region.
- [x] (2026-10-07) Slice B, performance: parallel/deduplicated server reads; blank the page
  only for slow navigations; on tab return re-check the session instead of a
  full reload.
- [x] (2026-10-07) Slice C: server-enforced 30 s resend cooldown with `Retry-After`, plus a
  UI countdown.
- [x] (2026-10-07) Slice D: auto-title links at save time (safe server fetch of
  og:title/<title>); descriptions deferred.
- [x] (2026-10-07) Slice E: notifications reset on open, unread first, expandable items,
  Clear all.
- [x] (2026-10-07) Reader header (bar, title, description, tags, GitHub-style
  metadata with relative "Updated …") stays fixed on desktop; only sections and
  links scroll beneath it.
- [x] (2026-10-07) Slice F1, comments: user decisions — signed-in readers with
  access comment; anyone who can comment may reply (curator replies labelled,
  owner/editor marks the answer); owners can switch comments off (on by
  default). Schema, policy-reusing API, native-form UI in the side column,
  e2e + browser journeys.
- [ ] Slice F2: comment notifications (needs a general notifications table) and
  `/ops` comment moderation.
- [ ] Slice G, needs a privacy decision: collection creator and contributors in
  the header metadata (creator is stored but not exposed; contributors need edit
  attribution).
- Discovered: the user's dev API watcher exited on an intermediate edit (an
  import added then removed within a minute). It was restarted with the dev
  stack's environment; edits to watched API files must stay valid at each save.
- Deferred, own slice: account deletion with data export.

## Surprises & Discoveries

- CSS generated content joins accessible names: a trailing `::after` "·"
  separator renamed the hub link to "@reader·" and failed browser tests. The
  separator now uses empty alt text (`content: "·" / ""`).
- A 160 ms slide-in on the account menu kept its items "not stable" for
  Playwright clicks; the menu now opens without animation.
- Desktop pagination fits complete rows only; with real tags a row was ~167 px
  and 720 px screens showed one row pair. Tags now sit on a tight line inside
  the meta block, and main bottom padding is 2rem, fitting two pairs.

- `system-ui` resolves to Ubuntu on the author's Linux desktop, so the
  documented "system font as identity" produced a different brand per OS.
- Explore/hub content started at x≈192, the reader at ≈336 and sign-in at
  ≈448 on a 1440 px viewport: three alignment axes for one shell.

## Decision Log

- Decision: Replace the system font stack with self-hosted Schibsted Grotesk
  (variable, OFL-1.1), vendored as a woff2 under `apps/web/src/fonts/` and loaded
  through `next/font/local`, with the system stack as metric-adjusted fallback.
  Rationale: one brand on every OS; an editorial grotesk suits a reading
  library while staying legible at UI sizes; no third-party request at runtime.
  Compared against Inter, Instrument Sans, Geist, Hanken Grotesk and Figtree.
  Date/Author: 2026-10-07 / user approval, choice by agent.
- Decision: One left content edge for all pages. Narrow surfaces (reader,
  sign-in, settings) keep their maximum widths but align to the shell's left
  edge instead of centering at different offsets.
  Rationale: page-to-page continuity is the main cohesion signal.
- Decision: Titles in rows render in ink; accent is reserved for actions,
  inline text links, hover/focus and selection.
  Rationale: the documented ≤10% accent budget; blue-everything removed
  hierarchy. Supersedes "Links use accent color" for row titles only.
- Decision: The wordmark `nslinkhub` is the whole logo; no icon mark or
  derived favicon. Rationale: user correction, 2026-10-07.
- Decision: Keep approved copy, header composition, theme toggle, settings
  autosave and typed landing questions; keep class names used by
  `apps/api/test/browser/reading.browser.ts`.

## Outcomes & Retrospective

Shipped locally, uncommitted, awaiting user review: one typeface, one content
edge, one row/button/form vocabulary and a recalculated palette across every
surface; docs and CHANGELOG updated. Remaining: owner inline-edit and
notifications were only checked through shared styles (the reviewer account had
no owned collection); 768 px and 200% zoom were not separately screenshot.
Next time, run the browser suite earlier — two of its failures came from
details (pseudo-element names, menu motion) invisible in screenshots.

## Context And Orientation

`apps/web` is a Next.js 16 app. Styling lives almost entirely in
`apps/web/src/app/globals.css` as hand-written semantic classes over Tailwind 4
`@theme` tokens; components in `apps/web/src/components/` and routes in
`apps/web/src/app/` emit those classes. Canonical token values and contrast
evidence live in `docs/design-docs/web-design-tokens.md`; layout/component
contracts in `web-interface-system.md`; journeys and copy in
`web-product-experience.md`. Desktop pagination in
`apps/web/src/components/paginated-list.tsx` measures rendered row heights to
fit complete rows, so row geometry changes must be checked at several heights.

## Plan Of Work

1. Vendor the font and wire `next/font/local` in `apps/web/src/app/layout.tsx`
   exposing a CSS variable consumed by `--font-sans`.
2. In `globals.css`: tune the type scale for the new face, define one content
   edge, unify row/list rhythm, link and button states, tags, meta lines,
   feedback panels, form controls and header/footer.
3. Per surface, adjust markup only where structure blocks the system (e.g. the
   landing example card, pagination placement, hub count).
4. Browser-check every surface at the widths/themes listed below, then run the
   gates and update docs.

## Concrete Steps

From the repository root:

    bun run verify          # full gate; do not overlap with other builds
    bun run test:browser    # production-build browser acceptance (36 cases)

Never run a production build over the live dev `.next` directory.

## Validation And Acceptance

- Every route renders in Schibsted Grotesk in light and dark themes.
- Landing, Explore, hub, reader, sign-in and settings share one left content
  edge at 1440 px; nothing scrolls horizontally at 320 px.
- Body/meta text ≥4.5:1, control boundaries/focus ≥3:1 in both themes.
- Desktop pagination still shows only complete rows at 720/900/1080 px heights.
- `bun run verify` and `bun run test:browser` pass.

## Idempotence And Recovery

CSS/markup changes are reversible through git. The demo seed (disposable,
`ref/design-review-seed.py`; run `python3 ref/design-review-seed.py` from `ref/`
to write `seed.sql`, then pipe it to `psql`) deletes and recreates only users
`design-review-*@example.test`; hubs, collections and resources cascade. Remove
the demo data with
`delete from users where email like 'design-review-%@example.test';`.

## Artifacts And Notes

Screenshots live in the session scratchpad; not tracked.

## Interfaces And Dependencies

No API, contract or schema change. New tracked asset: the Schibsted Grotesk
latin variable woff2 (`apps/web/src/fonts/`, ~46 KB) plus its OFL license text;
Latin Extended glyphs fall back to the system sans. No new runtime dependency.
