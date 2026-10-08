# Refine profile saving, validation and loading feedback

## Purpose / Big Picture

Make profile editing predictable: one explicit Save profile action, live hub
handle validation, green success feedback, and edits retained after a failed
save. Replace disruptive navigation skeletons with quiet loading feedback and
delayed recovery, while still hiding stale private content during revalidation.

## Progress

- [x] (2026-10-06) Inspect profile forms, loading security boundary and handle rules.
- [x] (2026-10-06) Confirm final preference: explicit saving for all fields.
- [x] (2026-10-06) Add authenticated handle availability and race-safe rename errors.
- [x] (2026-10-06) Enhance profile save in place with native no-JavaScript fallback.
- [x] (2026-10-06) Verify errors, live validation, loading recovery and final full gate.
- [x] (2026-10-06) Prepare the complete verified milestone for review.
- [x] (2026-10-08) User review, then commit/push. Done: reviewed and committed.

## Decision Log

- 2026-10-06: The user first accepted partial autosave, then chose one explicit
  Save profile action. Do not implement autosave or split save controls.
- 2026-10-06: Availability is a debounced authenticated database lookup. No Bloom
  filter: false positives would not provide definitive availability. Checks are
  advisory; the write and unique constraint remain authoritative.
- 2026-10-06: Preserve native forms without JavaScript. Enhanced saves use the
  same bounded, Origin-checked web form route and signed API source attribution.
- 2026-10-06: Navigation still hides private DOM before authorization refresh.
  Show only a compact progress indicator; offer recovery after eight seconds or
  explicit cancellation. No stale private content is restored on failure.

## Context And Orientation

`apps/web/src/app/profile/page.tsx` reads the current profile. A client editor
will enhance its native form; `forms/[action]/route.ts` remains the write bridge.
`FreshDocument` controls document navigation and history/tab revalidation.
`UsersController` exposes own-profile routes; `HubsService` owns handle rules
and atomic renames. The shared `Profile` contract already contains all fields.

## Plan Of Work

Add a bounded handle query and status contract, reusing backend format/reserved
rules. Catch unique collisions on the final write. Enhance the profile form with
debounced checks, stale-response protection and in-place saving. Add distinct
success/error notices and simplify loading. Update browser/API acceptance and
design contracts before final verification.

## Validation And Acceptance

Availability distinguishes current, available, invalid, reserved and taken
handles without revealing account details. Anonymous queries fail. Concurrent
claims cannot both succeed. Saves retain edits on failure and show green success
only after a confirmed response. Newer edits/checks cannot be overwritten by
older responses. JavaScript-disabled forms still save. Navigation cancellation
offers recovery while stale authorized content stays hidden.

## Concrete Steps

Run `bun run verify` and `bun run test:browser` sequentially in the isolated
acceptance copy. Inspect updated desktop/phone profile and loading screenshots.
Finish with documentation and diff checks. No migration or dependency is needed.

## Idempotence And Recovery

Checks are read-only and writes remain explicit. Requests use bounded timeouts;
an uncertain write prompts review/retry and retains the draft. Existing account
data and the local dev environment are preserved. Test accounts are disposable.

## Interfaces And Dependencies

New `GET /api/v1/profile/handle-availability?handle=...` returns a typed status
under the ordinary API envelope and authentication/read-budget boundary.
The existing profile form route supports JSON for enhanced submissions and303
redirects for native forms. No new library or persisted state is introduced.

## Surprises & Discoveries

All native-form notices previously used warning colors, including successful
profile saves. The loading state immediately showed reload instructions and
large collection skeletons, even for a small profile update.

## Artifacts And Notes

Verification is combined with the account-shell and generated-avatar changes.
Record final logs and screenshot findings here when checks finish.

## Outcomes & Retrospective

Profile and loading refinements are complete and verified. Autosave remains out
of scope following the user's correction.


The first combined gate passed API build/type/unit/e2e checks, then identified
that the enhanced profile submission bypassed the shared HTTP adapter. Moved it
to `submitForm` in `lib/http.ts`, retaining Origin checks, timeout, same-origin
credentials, redirect rejection and safe failure handling. Boundary checks now
pass; final combined verification is pending.


Further user feedback (2026-10-06): routine profile-save confirmation is now a
compact green “Saved” with a check beside the stable Save profile button, not a
banner. Errors remain prominent. The handle hint previews the public address;
format/availability guidance appears only for changed handles. No redundant
“current handle” sentence. Browser acceptance caught edits being lost during
hydration; native uncontrolled field values now survive early typing/autofill,
and enhanced submission reads the actual form values. The loading recovery test
also needed assertions moved after browser cancellation so Playwright did not
wait for the deliberately blocked navigation. These fixes passed the final combined acceptance below.


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
