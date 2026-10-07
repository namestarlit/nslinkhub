# Edit collection metadata in place

## Purpose / Big Picture

Owners edit collection names, descriptions and tags directly in the reading
header. The separate expanded form disappears when JavaScript is available.
Hub navigation uses `/h/:hubId` or `/@handle`, which show owners their own
collections; public preview remains in Settings.

## Progress

- [x] (2026-10-07) Inspect editor, versioned PATCH contract and owner capability.
- [x] (2026-10-07) Implement inline editing with autosave, cancellation and error recovery.
- [x] (2026-10-07) Correct owner hub navigation and remove the owner-page public preview link.
- [x] (2026-10-07) Verify browser behavior and repository gate; update durable docs.

## Surprises & Discoveries

Owner list cursors must be applied only after resolving the viewer and hub ID;
passing them through the public list first can reject a valid owner cursor.

The existing `canManage` capability is emitted only for the hub owner. The PATCH
response returns updated collection metadata and its incremented version.

## Decision Log

- User correction: canonical hub links remain `/h/:hubId`; `/@handle` is the
  readable alias. `/hub` only redirects. Settings preview uses `?view=public`.

- Edit one field at a time in its reading position; save on blur/Enter (multiline
  uses Ctrl/Cmd+Enter), Escape cancels. Native controls preserve accessibility.
- Send only the edited field with the last acknowledged version. Conflicts never
  silently overwrite another edit; preserve the draft and offer latest data.
- Keep a native form inside noscript for JavaScript-disabled browsers.
- Copy links always use durable public URLs; navigation can target the owner's
  workspace without changing those sharing URLs.

## Outcomes & Retrospective

Inline editing and owner-aware routing are implemented. The repository gate and
ten focused browser journeys passed; an additional network failure/retry check
passed. Five final focused browser journeys passed after cursor routing was
refined, including owner pagination at both URL forms, explicit public preview,
network retry, invalid tags, cancellation, conflict recovery and native editing.

## Context And Orientation

`apps/web/src/components/collection-reader.tsx` renders the reading header.
`collection-editor.tsx` currently renders a details/form below it.
`apps/web/src/lib/collection-actions.ts` forwards validated, authenticated forms
to the existing versioned backend PATCH. `primitives.tsx` renders hub metadata.

## Plan Of Work

Move owner metadata into an inline editor, reuse read-only metadata for visitors,
retain native fallback, then adapt the server action for field-scoped writes.
Change owner context links and cover edits, failure, conflicts and navigation.

## Concrete Steps

Run `bun run check`, `bun run verify`, and focused production browser journeys
in isolated checkouts to preserve the live development server build.

## Validation And Acceptance

Title, description and tags edit in place without a page reload. Saved values
persist; invalid/network-failed drafts remain recoverable. Escape restores the
saved value. Conflicts cannot silently overwrite remote values. Nonowners get
read-only headers. Own hub links target `/h/:hubId`; `/@handle` also resolves the owner view.
Explicit Settings preview stays public. Mobile layout wraps and native editing still works without JavaScript.

## Idempotence And Recovery

No migrations or persistent test-data edits. Version guards stay backend-owned.
Retry only acknowledged failures; conflicting writes require reviewing latest.

## Artifacts And Notes

Final checks: `bun run check`, `bun run verify`, and production browser journeys
passed. Reviewed mobile/desktop inline-edit screenshots in dark and light themes.
No migration, commit or push was made.

The preceding owner hub layout passed repository verification and five focused
browser journeys before the inline-editing refinement.

## Interfaces And Dependencies

Use public Collection capability/version and existing PATCH; no Prisma imports
in web, no auth-contract changes, no mutable handle authorization.
