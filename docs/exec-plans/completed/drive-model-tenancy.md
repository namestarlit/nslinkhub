# ExecPlan: Google-Drive tenancy model (one hub per user)

## Purpose / Big Picture

Reshape NSLinkHub from a Slack-style shared-workspace model to a Google-Drive
individual model, decided 2026-07-04 before Track W3 builds any UI.

After this change:

- A **hub is one personal space per user** (1:1, like a Google Drive or a
  Tailscale tailnet). Nobody joins anyone else's hub.
- There are **no hub memberships, invitations, or roles**. Collaboration is
  Drive-style **collection-level sharing** only (link share + direct
  reader/editor), which already exists and lands in the recipient's own
  `shared/` surface.
- Identity is a unique **hub handle** (the "hub name", tailnet-style) plus a
  free-form **display name**. There is **no username**.

Observable result: sign-up no longer asks for a username; a user has exactly one
hub addressed by a unique handle; the membership/invitation endpoints are gone;
sharing a collection with someone still works unchanged; `bun run verify` is
green.

## Progress

- [x] (2026-07-04) Schema: `Hub.handle` (unique) + `Hub.ownerUserId` (unique
  FK) added; `HubMembership`/`HubInvitation` dropped; `User.username`,
  `User.displayUsername`, and `User.role` dropped.
- [x] (2026-07-04) Reshaped `0_init` migration SQL (squash); regenerated the
  client; recreated the DB; hand-written objects verified preserved (3 fns, 9
  triggers, partial index; both membership tables gone).
- [x] (2026-07-04) Auth: dropped the `username()` plugin and the `role`
  additional field; `hub-onboarding` derives a unique handle (no membership).
- [x] (2026-07-04) `HubsService` → ownership API (`getUserHubId`, `isOwner`,
  `requireHubOwner`, `updateHandle` with reserved-word + format validation).
- [x] (2026-07-04) `CollectionPolicyService` → owner → direct share → link →
  published; membership branch and admin bypass removed.
- [x] (2026-07-04) Removed member/invitation services, controllers, DTOs, the
  `UserRole` enum, and `hub-members` spec; trimmed `HubsModule`.
- [x] (2026-07-04) Users module → self-service `/api/v1/profile`
  (displayName + handle); consumers repointed (`getUserHubId`,
  `requireHubOwner`); `AuthUser` slimmed to `{ userId }`.
- [x] (2026-07-04) Tests: stripped `username` from every sign-up; added
  `identity.e2e.spec.ts` (handle derivation, collision dedup, rename, reserved).
- [x] (2026-07-04) Docs: `PRODUCT.md`, `AGENTS.md` invariants, `ARCHITECTURE.md`,
  `identity-sso.md`, `hub-architecture.md` (superseding banner), CHANGELOG.
- [x] (2026-07-04) `bun run verify` green (24 e2e across 8 files).

## Outcomes & Retrospective

The refactor shipped and matches the purpose: one hub per user, no
memberships/invitations/roles/username/admin, collection-level Drive sharing,
identity = handle + display name, durable links on `hubId`. `bun run verify`
green. The advisor's three guards paid off: the migration preserved every
hand-written object, the auth smoke passed before the full suite, and the
`User.role`-vs-hub-role landmine was resolved by dropping `User.role` outright.

Deferred follow-ons (small, separate — not blocking W3):

- **Handle-based discovery filter** on explore (`?hub=<handle>` → resolve to
  `hubId`) so published content can be browsed/searched "by hub"
  (YouTube-handle style). Durable routes stay `hubId`; the handle is a mutable
  discovery/search/attribution dimension only.
- **Collection ownership transfer** (2026-07-04 decision) — Drive-accurate.
  Distinguishes **owner** (`collection.hubId`, mutable) from **creator** (a new
  immutable `creatorUserId`, set at creation, never changes on transfer — Drive
  keeps "created by" after an ownership change). Transfer is allowed **only to
  a user who is already a `CollectionShare` editor** on the collection, and:
  1. reassigns the collection subtree (`collection.hubId`, recursively for
     nested children, detaching the top's `parentCollectionId`) to the
     recipient's hub — it moves into their personal hub ("MyDrive");
  2. removes the recipient's now-redundant editor share (they own it);
  3. adds an `editor` direct share for the previous owner, so it lands in
     **their** `shared/` surface (Drive keeps the ex-owner as editor);
  4. leaves `creatorUserId` untouched.
  Requires adding `creatorUserId` to `Collection` (immutable). Buildable now
  (no email); the field should ideally be added pre-deployment.
- **Account/hub transfer is NOT a model** (2026-07-04 decision). A hub is 1:1
  with the account, so handing over the hub = handing over the account =
  **changing the account email** (better-auth `changeEmail` with code
  verification). Arrives with the email/MFA hardening (needs real email
  delivery — currently the deferred no-op). Do not build a hub-transfer model.
- **Full rewrite of `hub-architecture.md`** below its superseding banner (the
  membership/invitation/role sections are marked historical, not yet excised).

## Context And Orientation

Today (`apps/api`):

- `prisma/schema.prisma`: `User` has `name` (free-form), `username` (unique),
  `displayUsername`; `Hub` has `name`/`description` but **no owner FK** — the
  hub↔user link is `HubMembership(hubId, userId, role, status)`; `HubInvitation`
  holds email invites. `Collection.hubId` is the tenant key.
- `src/auth/auth.ts`: better-auth with `username()` + `bearer()` plugins; a
  `databaseHooks.user.create.after` calls `createPersonalHub` (creates hub +
  owner membership).
- `src/modules/hubs/`: `HubsService` (role rank, `requireHubRole`, membership
  checks, `getPrimaryHubId`), `CollectionPolicyService` (resolves
  published → membership → direct share → active link), `HubMembersService`,
  `HubInvitationsService`, `hub-members.controller`, `invitations.controller`,
  `hub-onboarding.ts`.
- `src/modules/collections/`, `resources`, `tags`, `imports`, `exports` consume
  `CollectionPolicyService`.

The migration SQL owns `app_uuid_v7()`, `set_updated_at` triggers, the
collection-hierarchy trigger, CHECK constraints, and the partial unique index —
these must survive the reshape (see `docs/runbooks/migrations.md`).

## Plan Of Work

1. **Schema** (`schema.prisma`): drop `HubMembership`, `HubInvitation` and their
   relations. On `Hub`, add `ownerUserId String @unique` (FK to User,
   `onDelete: Cascade`) and `handle String @unique @db.VarChar(60)` (the hub
   name). On `User`, drop `username` and `displayUsername`; keep `name` as the
   display name. Keep `Hub.name` optional or drop it — decided below.
2. **Migration**: reshape `prisma/migrations/0_init/migration.sql` (squash, not
   stack — nothing is deployed, matching the established Phase B pattern):
   remove the two dropped tables, adjust `users` and `hubs` columns/indexes,
   preserve every hand-written object. Regenerate the client
   (`bunx --bun prisma generate`).
3. **Auth** (`auth.ts`): remove `username()` from plugins (keep `bearer()`).
   Sign-up input becomes email + password + name. `hub-onboarding.ts`
   `createPersonalHub` creates a hub with `ownerUserId` and a generated unique
   `handle` (slug of name/email + numeric suffix on collision); no membership
   row.
4. **HubsService**: replace `roleRank/getMembershipRole/requireHubRole/
   isMember/assertMember/countOwners/getPrimaryHubId` with `getUserHubId(userId)`
   (the single owned hub), `requireHubOwner(hubId, user)`, `createUserHub`,
   handle lookup/rename helpers.
5. **CollectionPolicyService**: `resolve()` drops `hubRole`; ownership
   (`hub.ownerUserId === user.userId`) grants full access; otherwise direct
   share (reader/editor) / active link / published, as today.
6. **Remove** `HubMembersService`, `HubInvitationsService`, their controllers,
   and their DTOs; trim `HubsModule` providers/controllers/exports.
7. **Users/profile & public pages**: drop `username` from services/DTOs/
   responses; expose `displayName` (name) + `handle`. `collections/hubs.controller`
   public hub page resolves by `handle` → `hubId` (immutable key stays `hubId`).
8. **Tests**: delete `test/hub-members.e2e.spec.ts`; rewrite the membership
   parts of `test/hub-tenancy.e2e.spec.ts` as owner/share/handle cases; remove
   `username` from every sign-up payload across all specs; keep the tag-cleanup
   and sharing specs green.
9. **Docs**: update `hub-architecture.md` (tenancy + sharing + phased plan),
   `PRODUCT.md` (§2 Hub, §3 target users, §4 remove invitations, Account
   identity), `AGENTS.md` invariants (drop membership from the policy chain;
   replace "usernames" language), `identity-sso.md` cross-ref, `CHANGELOG.md`.

## Decision Log

- Decision: One hub per user (1:1). Rationale: matches the Drive/tailnet model
  the product adopted; removes the switcher and the membership join.
  Date/Author: 2026-07-04 / namestarlit.
- Decision: Squash the `0_init` migration rather than stack a new one.
  Rationale: nothing is deployed; established pattern (Phase B). The hand-written
  SQL objects must be preserved.
  Date/Author: 2026-07-04 / namestarlit.
- Decision: **Hub handle at sign-up** — derive an initial unique handle
  automatically (slug of name/email + numeric dedup suffix); user can rename
  later. Rationale: smooth onboarding; SSO later reuses the derive path.
  Date/Author: 2026-07-04 / namestarlit.
- Decision: **Login is email + password** (drop username login). A handle is a
  space identifier, not a login credential. Date/Author: 2026-07-04.
- Decision: **Drop `Hub.name`**; the handle is the hub's identity, the display
  name lives on the user. Date/Author: 2026-07-04.
- Decision: **No admin role at all — drop `User.role` entirely.** The only roles
  are collection-scoped: owner (the hub holding the collection) / editor / reader
  (+ link + published). Removing the field (schema, migration `users_role_check`,
  auth `additionalFields.role`, the `UserRole` enum, the policy bypass)
  eliminates the platform-admin bypass *and* the "two role concepts" landmine in
  one move. Future moderation of the public explore surface, if ever needed, is a
  separate explicit capability, not a latent field. Date/Author: 2026-07-04.
- Decision: **Ownership is a transferable FK, not identity.** A collection's
  owner is its `hubId`; transferring a collection = reassign `hubId` to the
  recipient's hub (Drive-style). Enabled by the 1:1 `Hub` entity; the transfer
  endpoint itself is a follow-on, not this milestone. Date/Author: 2026-07-04.
- Decision: **Handle is a public discovery/attribution dimension** (like a tag
  for the explore surface: "everything from `namestarlit`"), mutable, while
  durable links use the immutable `hubId`. Published/explore responses carry the
  handle; explore gains an optional `?hub=<handle>` filter. Date/Author: 2026-07-04.
- Decision: **`handle` validation** — lowercase `[a-z0-9-]`, 3–60 chars, no
  leading/trailing/double hyphen; reserved words rejected (`api`, `explore`,
  `me`, `hubs`, `collections`, `resources`, `tags`, `imports`, `exports`,
  `invitations`, `auth`). Public hub page is `/hubs/:handle` resolving
  handle→hubId (literal-before-param ordering preserved). Date/Author: 2026-07-04.

## Surprises & Discoveries

- Risk guards from review (things `bun run verify` cannot catch):
  1. **Two `role` concepts.** `HubMembership.role` (removed) vs `User.role`
     (kept). The admin bypass in `CollectionPolicyService` keys off `User.role`;
     it is removed deliberately (decision above), not by accident — grep
     `UserRole` / `.role` in the policy and confirm no path silently grants
     cross-hub access, and update any test that asserted the bypass.
  2. **Migration SQL.** Hand-edit `0_init/migration.sql` surgically (delete the
     two dropped tables' DDL, alter `users`/`hubs`); do **not** regenerate. After
     `docker compose down -v && up -d` + apply, grep the SQL for `app_uuid_v7`,
     `set_updated_at`, the hierarchy trigger, the CHECK constraints, and
     `uq_resources_collection_link`, and confirm no schema drift vs
     `schema.prisma`.
  3. **Auth runtime.** After the auth + migration change, smoke a *single*
     sign-up (email+password+name → assert one hub with handle + owner FK, no
     membership row) before running the full e2e suite, so an auth-boundary
     regression is not mistaken for many test bugs.
  - Blast radius to fix at source, then let `tsc` enumerate stragglers:
    `getPrimaryHubId` (e.g. `imports.service.ts`), `requireHubRole`, `hubRole`,
    `HubMembership`, `assertMember`, `isMember`, `getMembershipRole`.

## Validation And Acceptance

- Sign-up with email + password + name succeeds and creates exactly one hub
  with a unique handle and an owner FK; no membership row exists.
- A second user cannot read/write the first user's unpublished collection
  except through an explicit collection share or active link (404/403 as today).
- Sharing a collection with a second user still lands it in their `shared/`
  surface (unchanged behavior).
- The public hub page is reachable by handle and 404s for unknown handles.
- No route, response, or FK exposes a username; `hubId` remains the immutable
  key, `handle` is a mutable alias.
- `bun run verify` green (build, typecheck, Biome, unit, e2e).

## Idempotence And Recovery

- The migration reshape is destructive to local dev data. Recreate with
  `docker compose down -v && docker compose up -d` then apply migrations. Safe
  because nothing is deployed. Never drop `app_uuid_v7()`, triggers, CHECK
  constraints, or the partial unique index in the reshape.
- Prisma client regeneration is idempotent (`bunx --bun prisma generate`).

## Interfaces And Dependencies

- better-auth (drop `username` plugin; keep `bearer`, argon2id via
  `Bun.password`, `generateId: false`). `resolveSessionUser` stays the single
  session entry point; downstream still consumes `AuthUser`.
- Prisma 7 pg adapter; migration SQL is the source of truth for hand-written
  objects.
- Invariant preserved: mutable human-facing values (handle, display name,
  email) never appear in authorization rules, FKs, or route contracts as keys —
  `handle` resolves to `hubId`.
