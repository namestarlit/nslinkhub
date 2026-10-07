# Simplify account settings and resolve profile avatars

## Purpose / Big Picture

Account settings follow one vertical flow with compact label/control rows, as in
the user's reference. The signed-in user's avatar uses a stored chosen image,
then a Gravatar associated with their verified email, then the generated SVG.

## Progress

- [x] (2026-10-06) Inspect existing user/hub models, avatar routes and Gravatar docs.
- [x] (2026-10-06) Implement avatar resolution and compact settings rows.
- [x] (2026-10-06) Verify avatar precedence, fallback, privacy boundaries and browser behavior.
- [x] (2026-10-06) Update documentation and changelog.
- [x] (2026-10-06) Replace the user bio setting with autosaved Hub.description and Hub name labeling.
- [x] (2026-10-06) Verify seven focused browser journeys after the description change (99 assertions).
- [x] (2026-10-06) `bun run verify` passed after the final description refinement.

## Surprises & Discoveries

User.image exists, but there is no upload UI. Initially Hub had no name field;
the hub-identity scope update below adds it. The public UUID avatar route does not expose
account existence. Keep that behavior for anonymous and other-user requests.

## Decision Log

- (2026-10-06) Resolve external avatars only for the authenticated user's own UUID.
  Public requests still receive the deterministic generated fallback, with no DB lookup.
- (2026-10-06) Fetch Gravatar server-side from its fixed HTTPS image endpoint using
  normalized-email SHA256 and d=404. Never expose email hashes to the browser.
  Bound request time/body/cache size and fall back on missing/invalid/failed images.
- (2026-10-06) Existing chosen HTTPS image URLs have priority; no upload UI or
  automatic name/bio imports are part of this change.

## Outcomes & Retrospective

Account settings now follow a vertical flow with autosave and draft recovery.
Hub name, handle and description are independent of the owner's full name;
public hub navigation uses the immutable ID. Automatic avatars remain in the
header without an implied settings upload control. The earlier complete browser
suite passed all 31 cases (364 assertions); the final description change passed
seven relevant browser cases with JavaScript and native forms (99 assertions).
`bun run verify` passed, including API unit/e2e tests, wire contracts, formatting,
boundary/documentation checks, production build and type checking. Desktop and
mobile screenshots were reviewed. No commit or push was made.

## Context And Orientation

apps/api/src/modules/avatars holds the generator and public controllers.
apps/web/src/components/avatar.tsx uses the own-user resolver and generated fallback.
Settings reuses ProfileEditor for progressive saving and handle validation.

## Plan Of Work

Add a bounded Gravatar image service and own-user avatar resolver. Update the
existing UUID image route and shared Avatar component. Reshape Settings fields
into stacked rows while preserving names/actions and mobile stacking. Add unit,
HTTP and browser assertions; update the canonical interface docs.

## Concrete Steps

Use Bun from the repository root: bun run check, bun run verify and bun run
test:browser. Run builds in the isolated acceptance checkout to preserve live dev.

## Validation And Acceptance

Chosen picture wins; verified-email Gravatar wins over generated fallback; 404,
timeout and invalid/oversize content fall back safely. Unknown/other/anonymous
UUID requests do not query personal data or Gravatar. No email/hash in image HTML
or redirect headers. Profile saves and theme cycle work with and without JS.
Settings has Account then Appearance and one vertical flow at every width.

## Idempotence And Recovery

The additive 20261006202458_hub_display_name migration preserves IDs and handles,
backfills names from existing handles and retains existing SQL-only constraints.
Existing immutable avatar URLs remain valid. Provider failures are nonfatal.
Cache is bounded in memory and safe to discard on restart.

## Artifacts And Notes

Gravatar image contract: https://docs.gravatar.com/sdk/images/ and
https://docs.gravatar.com/rest/hash/ (SHA256; trim and lowercase email; d=404).

## Interfaces And Dependencies

Auth resolves through OptionalAuthGuard/resolveSessionUser. Services use AuthUser.
Prisma stays inside the API. Browser image URLs carry only the immutable UUID.

## Scope update: independent hub identity (2026-10-06)

The user clarified that the hub is the public identity. Add Hub.name independent
of User.name, label the user field Full name, and Hub.name as Display name inside
Hub settings. Backfill existing hubs from handles, never from owner/email. Keep
hub UUID and handle lookup; add a stable /h/:hubId web route alongside /@handle.
Public pages and collection metadata show the hub name. Name/handle changes never
alter the UUID; owner name/email changes never alter hub name. No ownership-transfer
UI is introduced. Add a reviewed additive migration and audit name changes.

- [x] (2026-10-06) Generate/review/apply Hub.name migration; parity reports no difference.
- [x] (2026-10-06) Expose/edit/render independent hub names and ID/handle lookup.

Further user refinements: Profile, Hub and Sign-in are the simple section names.
Changes autosave after 800ms, retain newer drafts, and flush before public-hub
navigation. Native no-JS editing retains a noscript submit control. Collection
metadata shows hub handle, published-by owner name, update date, description and
tags; no email is used as a missing-name fallback. Backend/public payloads expose
only the requested owner full name, not private email or account credentials.

Final settings refinement: remove the profile-picture row entirely. Automatic
avatar resolution remains in the header, with no implied editing control.

Model naming confirmed by the user: retain Hub.name and User.name. No column
rename is needed; the existing profile API displayName field continues to map
to User.name, and hubName maps to Hub.name.

Final identity refinement: replace the user bio editor/API field with
hubDescription, persisted on the existing Hub.description column. Label the
name control Hub name and place Description in the Hub section. Render it on
public hubs reached by ID or handle. Keep any historical User.bio stored without
publishing or copying it automatically; it is no longer an account setting.
Verify description autosave, clearing, validation and independence from the owner.
