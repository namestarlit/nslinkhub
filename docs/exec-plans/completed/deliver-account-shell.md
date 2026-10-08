# Deliver notifications, account navigation and themes

## Purpose / Big Picture

Make the signed-in shell useful beyond operations: invitations live in a
Notifications area; Profile, Settings, Service operations and Sign out live in
an account menu. Use a quiet two-line copyright footer and Settings-only
Light/Dark/System appearance. Keep service status in API monitoring only. The user explicitly chose invitation notifications first and sharing
updates next. Preserve the completed, uncommitted invitation work.

## Progress

- [x] (2026-10-06) Read current shell, design tokens, profile API, auth/form boundaries and browser tests.
- [x] (2026-10-06) Confirm invitation-only notifications for this milestone.
- [x] (2026-10-06) Implement accessible account menu, footer and themes; replace initial avatars with API-generated SVGs.
- [x] (2026-10-06) Deliver editable own profile, working appearance settings and invitation notifications.
- [x] (2026-10-06) Verified backend/form boundaries and browser journeys in both themes and without JavaScript.
- [x] (2026-10-06) Updated changelog and acceptance evidence; implementation ready for review.
- [x] (2026-10-08) User reviews the milestone before commit/push. Done: reviewed and committed.

## Decision Log

Decisions below were made on 2026-10-06 from the user request and existing APIs.

- Invitations remain the source of truth. Notifications initially projects the
  recipient's invitations; the badge counts actionable invitations, not unread
  events. Sharing updates require a later event/delivery contract. No speculative
  notification table, notification preference switches or empty future tabs.
- Use local initials derived from the display name (email fallback for unnamed
  accounts) rather than introducing a remote avatar provider. No avatar upload
  or remote-image fetching is added in this milestone.
- Profile is the authenticated user's own name, biography and hub handle. Reuse
  the backend PATCH contract; credentials are never edited through this form.
- Settings offers appearance and explains email-code security. Email handover UI
  remains a separate complete account workflow; no disabled controls or dead links.
- Theme uses a validated browser cookie and server-rendered attribute. System
  follows the operating system via CSS; no flash or browser storage of account
  data. Native POST works without JavaScript. Switching appearance requires a
  session; signed-out visitors always follow System.
- Account navigation uses native disclosure with keyboard/focus, Escape and
  outside-click enhancement. Operations visibility reflects current role grants;
  backend authority remains unchanged. Footer stacks the current-year product
  copyright above “an ns series product”; service status remains API-only.

## Context And Orientation

Shell and tokens: `apps/web/src/app/layout.tsx`, `globals.css`, and
`src/components/session-nav.tsx`. Native forms and API transport live under
`src/app/forms` and `src/lib`. Profile authority is `apps/api/src/modules/users`;
invitation state is `modules/operations`. Shared wire contracts are in
`packages/types`. Follow existing Impeccable product register and semantic tokens.

## Plan Of Work

Update the design contract to allow two palettes and system preference. Build
shell components, new `/profile`, `/settings`, and `/notifications` routes, and
native form handlers. Add PATCH support to the existing HTTP boundary and ensure
signed source attribution covers that method. Preserve invitation email entry
and old ID links. Update affected navigation tests and add real browser journeys
for profile persistence/validation, menu access, theme persistence/system choice,
notifications, mobile layout and JavaScript-disabled behavior.

## Validation And Acceptance

`bun run verify` and `bun run test:browser` in the isolated acceptance copy;
inspect screenshots at narrow and wide widths, light/dark/system, verify contrast
for semantic pairs. Tests use disposable accounts/databases and capture mail.
Do not build over the user's live dev server. No new migration is expected.

## Idempotence And Recovery

Profile writes operate only on the authenticated account and keep backend
validation, Origin checks and atomic hub rename. Invalid themes create no
preference; cookies contain only a theme enum. Navigation exposes no private
account data after sign-out/history revalidation. Existing local data is preserved.

## Outcomes & Retrospective

Implemented Notifications for invitations, the initials-avatar account menu,
editable own profile, Settings, a two-line footer and Light/Dark/System themes.
Before the final status-page removal, verification passed 144 tests and all 25
journeys, including no-JavaScript profile edits, role-aware menu, notification
states, system appearance, theme persistence, shared/sign-in return URLs, source
budgets, forged Origin rejection, 200% text size and both-palette contrast.

Screenshots were inspected at desktop and phone widths in light and dark themes.
The existing dev stack serves the changes. No migration or dependency was added.
Sharing-update notifications remain the next notification milestone; personal
collection management remains planned. Changes are uncommitted for review.

Dark semantic color pairs were computed from OKLCH through linear sRGB. Text
pairs range from 7.12:1 to 15.48:1 and control borders from 3.69:1 to 4.15:1.
The canonical token document records the individual pairs. Browser validation
remains in progress; no migration is needed.

## Surprises & Discoveries

The profile API was already complete; only the client form and PATCH transport
were missing. Signed form attribution originally covered POST only, so PATCH
must share that purpose-bound source proof. Theme changes need safe document
returns that allow sign-in pages; post-login redirects still reject auth loops.

## Concrete Steps

From the repository root, run `bun run verify` in the isolated acceptance copy,
then `bun run test:browser`. Expected: all source/test/build gates pass and 23
browser journeys pass for this scope (24 including the subsequent generated-avatar
integration), including the account-shell cases. Use `bun run check:docs`
after updating plan evidence. The existing `bun run dev` stack hot reloads these
changes; do not start a second stack or migrate/reset the local database.

## Artifacts And Notes

Acceptance evidence is under `/tmp/account-shell-verify.log` and
`/tmp/account-shell-browser.log`; screenshots use `/tmp/account-menu-dark-*` and
`/tmp/profile-light-*`. All accounts used in tests are synthetic and disposable.

## Interfaces And Dependencies

SessionView now includes the current user's email for the private account menu.
Profile fields retain the existing API contract. Session and notification reads
stay no-store; clients never import Prisma. React native disclosure and CSS
semantic palettes add no package or external avatar dependency.

Initial browser acceptance passed the new account/profile/notification/theme
journeys but caught footer overflow at 200% text size. Theme controls now wrap
within a reset fieldset minimum width; the local 390 px / 200% check reports no
overflow. The contrast fixture now resolves CSS colors on an attached element
before canvas sampling and checks both palettes, rather than passing unresolved
`light-dark()` custom-property text to a detached canvas. Final gate and browser
rerun remain in progress.

The final source gate passed 144 tests plus builds, typechecks, boundaries,
format/lint and documentation checks (`/tmp/account-shell-verify-final.log`).
Desktop light-profile and dark-account-menu screenshots were inspected. The
complete final browser rerun is pending; no migration or real account mutation
was needed for this milestone.

Final evidence: `/tmp/account-shell-verify-final.log` (144 tests plus all source,
format/lint, type/build, boundary and documentation gates) and
`/tmp/account-shell-browser-final.log` (25 passed, zero failed, 292 assertions).
Phone account-menu screenshots, with JavaScript enabled and disabled, and the
200% text-size status page were inspected. The earlier browser failures and
fixes above are retained as historical evidence, not outstanding work.

## Navigation refinement (2026-10-06)

The user requested Notifications directly below Profile inside the popup, and
an avatar-only trigger. Moved the attention badge with the notification link,
removed trigger text/chevron and the unnamed-account heading, and preserved the
accessible Account menu label. Updating existing browser journeys for the new
location; also checking the reported local Notifications route availability.

### Final shell refinements (2026-10-06)

Appearance now lives only in Settings. The root layout verifies the session once
for both navigation and theme: signed-out visitors always use System even with a
saved appearance cookie. Theme writes require a valid session. The footer uses
the current year above “an ns series product”. The user subsequently requested
removing client status entirely; the API health/readiness endpoints are retained.
The local running dev server returned 404 for newly added Notifications and
Settings while Profile worked; restarting the owned stack and checking routes.
These refinements are being verified before the final review handoff.

Local route check after the controlled dev restart: `/notifications`, `/profile`
and `/settings` each return 307 to their matching sign-in return path for an
anonymous request. The previously reported route-level 404s are resolved without
changing invitation records, sessions or grants. Root dev remains running.

The final user refinement removes the client `/status` route and its component,
styles and obsolete browser journeys. API health/readiness routes remain intact.
A replacement browser check covers API readiness, the two-line footer and the
absence of a client status route/link. Final source and browser reruns pending.

The user subsequently supplied a generated-avatar handoff. The local-initials
decision above is superseded by the UUID-seeded API generator in
[the avatar plan](deliver-generated-avatars.md). Its verification is combined
with the final shell gate. The first footer-only build found stale generated
Next dev route types for the deleted status page in the acceptance copy; remove
that disposable generated cache before rebuilding, without altering source.

## Invitation notifications and wordmark refinement (2026-10-06)

The user found the notification → invitation status → paste-link sequence
misleading. Invitation notifications are now informational messages directing
recipients to their email, with no review links or clickable-row treatment.
Legacy invitation listing redirects to Notifications; legacy detail links
explain checking the inbox without another entry-page link. Email fragment
links still open the actual consent page. The manual full-link entry form is
only a styled no-JavaScript fallback; invite codes remain deferred.

The wordmark keeps its neutral ink color (white in dark mode), no underline on
hover/active/visited/focus, and the existing keyboard outline. Signed-in users
navigate through `/hub` to their current personal hub; anonymous users navigate
to the landing page. The user clarified this means the hub, not the profile editor.


The user added global Explore navigation and per-page browser titles. The header
now leaves the wordmark on the left and groups Explore with the account avatar
on the right. Explore breadcrumbs are removed from hub/collection pages; parent/hub
collection context remains. Titles use a shared nslinkhub suffix and route-specific
labels, with the public handle for hub pages. Private entity data is not fetched
again solely for metadata. These final changes join the browser acceptance pass.


The later DiceBear-inspired refinement introduces `/` as the landing page and
`/explore` as public discovery, with a shared neutral charcoal palette. See
[public entry refinement](refine-public-entry.md) for the final navigation and
visual acceptance. The first initials-avatar decision above was superseded by
the generated-avatar plan, preserving immutable UUID seeds.


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
