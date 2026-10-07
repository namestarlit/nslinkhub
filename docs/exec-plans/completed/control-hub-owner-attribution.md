# Let users control public owner attribution

## Purpose / Big Picture

Profile settings has an autosaving Show my name on my hub toggle. When off,
owner names are omitted from public hub and collection metadata, while the
account name and hub identity remain intact.

## Progress

- [x] (2026-10-07) Inspect profile autosave and both public attribution serializers.
- [x] (2026-10-07) Add preference/API contracts; generate and review additive SQL,
  apply locally, regenerate Prisma and confirm no schema difference.
- [x] (2026-10-07) Add the autosaving Profile switch and own-hub visibility.
  Production browser checks pass with and without JavaScript; desktop/mobile
  screenshots reviewed.
- [x] (2026-10-07) API privacy/default/blank-name/validation coverage passes.
  Full `bun run verify` passes; focused production browser checks: 2 passed,
  0 failed (enhanced and native forms, reload persistence, owner/public views).

## Surprises & Discoveries

Hub summaries and collection discovery each serialize ownerName separately;
both must respect the preference, not merely hide text in the web UI.

## Decision Log

- Store User.showNameOnHub, default true to preserve existing behavior. It is a
  user's attribution preference, independent of the hub's name and identity.
- Return null for ownerName when opted out, including public collection previews.
  Authenticated profile and direct sharing/account workflows retain the full name.
- Place the toggle below Full name in Profile, with existing autosave/retry and
  native-form fallback. Missing/blank names remain omitted even when enabled.

## Outcomes & Retrospective

Completed. Users can suppress the byline without changing their stored name or
hub identity. Public serializers enforce the preference. The additive migration
is applied locally, and documentation, changelog and regression coverage agree.

## Context And Orientation

Prisma User stores account identity. UsersService maps Profile; UpdateUserDto
validates updates. CollectionsService owns public hub and list serializers.
ProfileEditor autosaves drafts through /forms/profile-save. OwnedHub uses the
private Profile response rather than public metadata.

## Plan Of Work

Add the boolean to schema/types/DTO/service; generate and review migration SQL.
Apply it locally and regenerate Prisma. Add the switch and draft serialization.
Filter ownerName at API serialization and in OwnedHub, then verify all paths.

## Concrete Steps

Use bunx prisma migrate dev --create-only against a disposable migrated database.
Review SQL, apply with migrate deploy and confirm schema parity. Run bun run
check, bun run verify and focused production browser checks in isolated checkouts.

## Validation And Acceptance

Default stays enabled. False persists across reloads without clearing names.
Anonymous hub ID/handle responses and collection lists return ownerName:null.
Turning back on restores attribution; blank names never appear. Both enhanced
and native form saves work. Public name/handle remain unchanged.

## Idempotence And Recovery

Additive non-null boolean migration with default true; no destructive changes.
Do not rewrite prior migrations or edit real account data for testing.

## Artifacts And Notes

Verification logs: `/tmp/attribution-verify.log` and
`/tmp/attribution-browser.log`. Reviewed screenshots:
`/tmp/attribution-settings-desktop.png` and
`/tmp/attribution-settings-mobile.png`.
Migration: `20261006220016_user_hub_attribution` (one additive boolean column).
No deployment or commit requested.

## Interfaces And Dependencies

Profile.showNameOnHub and optional UpdateProfileRequest.showNameOnHub are camel
case; users.show_name_on_hub is snake case. Backend controls public visibility.
