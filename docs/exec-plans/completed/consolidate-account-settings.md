# Consolidate account settings and expose appearance in the header

## Purpose / Big Picture

People can change appearance from any signed-in page and edit their account in
Settings. The current /profile editor does not justify a separate profile space;
redirect it to Settings, preserving existing entry links. Keep the public hub as
the collection presentation surface, with no new speculative profile features.

## Progress

- [x] (2026-10-06) Review current routes, native commands, design rules and browser coverage.
- [x] (2026-10-06) Add accessible three-option header appearance control and organized Settings sections.
- [x] (2026-10-06) Move profile editing/redirects and remove duplicate account navigation.
- [x] (2026-10-06) Verify production browser journeys, document results and prepare for review.

## Surprises & Discoveries

Appearance already uses a native form and browser cookie; signed-out pages follow
system appearance. Preserve that policy. ProfileEditor already retains failed/newer
edits and checks handle availability; move it without replacing its behavior.

## Decision Log

- (2026-10-06) Use one icon button cycling System → Light → Dark → System next to
  the avatar, following the user’s clarification. System remains the default.
- (2026-10-06) Settings initially used route-backed Profile/Appearance/Account navigation,
  horizontal on mobile. No separate profile view until it has meaningful content.
  Existing /profile links redirect to the profile editor in Settings.

## Outcomes & Retrospective

Implementation complete and ready for review. `bun run verify` passed, followed
by all 30 production browser cases (350 assertions). After the final narrow-screen
menu alignment correction, five focused account/capture browser cases passed
(102 assertions). Light/dark desktop and 320px mobile screenshots were inspected.
The header appearance control retains the current page and works without JavaScript;
System is initially selected. Legacy /profile links reach Settings, profile save
and retry still work, and one-page collections show no pagination controls.
Collection descriptions and tags save with and without JavaScript; invalid tag
lengths preserve the entire submitted draft. Browser boundary checks still pass:
the server component passes an action reference into the editor, with no direct
client import of server code. Successful enhanced saves use document navigation.

The user's live dev server held a stale ThemeToggle import during export changes.
Restarted only the web process, preserving shared configuration/API/worker/data,
and preserved its old cache under the ignored .next directory. Localhost renders
again; the production signed-in checks prove the current imports are valid.
No commits or pushes were made.

## Context And Orientation

Web layout and SessionNav render account controls. ThemePicker posts /forms/theme;
ProfileEditor posts /forms/profile-save. Settings and profile are app routes.
The production browser suite is apps/api/test/browser/reading.browser.ts.

## Plan Of Work

Reuse the theme form as a three-option header control. Move ProfileEditor into Settings,
add native section links, update redirect targets and account navigation. Extend
existing browser journeys for header theme changes, old-route redirects and mobile.

## Concrete Steps

Use Bun/Biome and preserve existing uncommitted work. Run bun run verify and
bun run test:browser sequentially in the isolated acceptance copy so the live
.next directory remains untouched. Capture screenshots with disposable accounts.

## Validation And Acceptance

Theme switch retains current page/query, works with and without JavaScript, has
accessible action labels and visible keyboard focus, and fits 320px screens.
Profile save/retry/handle checks work in Settings. Old /profile routes retain
notices and redirect. Signed-out appearance/session protections remain unchanged.

## Idempotence And Recovery

No schema changes or data migrations. Existing settings cookies and APIs remain
compatible; editing is still explicit and uses backend validation.

## Artifacts And Notes

User references: DiceBear header theme access and Claude settings categories.
Use the existing product typography, neutral surfaces and blue accent.

## Interfaces And Dependencies

/settings selects Account by default; ?section=appearance selects Appearance.
Legacy ?section=profile and ?section=account also resolve to Account. Header appearance changes POST to the existing native route.

Scope additions (2026-10-06): Hide Previous/Next for a single page. Collection
editing must expose description and tags as well as name. Use progressive server
action form state for full-size error recovery without putting long descriptions
in cookies. It calls the existing signed API helper with exact Origin validation;
backend ownership, content validation and version checks remain authoritative.

Final appearance refinement (2026-10-06): The header uses one icon button, not
three visible segments. It cycles System → Light → Dark → System; the tooltip
and accessible name describe the current mode and next action. Settings retains
direct choices. Four focused account/appearance browser checks passed (75
assertions), covering all modes with and without JavaScript. Desktop and 320px
mobile screenshots confirm the compact header layout.

Account simplification (2026-10-06): Account replaces the separate Profile and
Account panels, before Appearance in navigation. Reuse the existing profile save
and handle validation behavior. Group display name/bio under Profile details,
immutable hub ID/editable handle/public hub link under Hub, and email/member-since
under Sign-in details. Hub has no separate name field in the current model.
Profile details, Hub and Sign-in details stack vertically at all screen sizes,
following the user’s explicit preference for a single column. Display name
belongs to the user model; the hub has no separate name field.
This intermediate layout and model description were superseded by the independent
hub identity and autosaving account settings in resolve-account-avatars.md.
