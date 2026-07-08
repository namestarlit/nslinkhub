# Hub tenancy schema and the collection/resource rename (Phase B)

This ExecPlan is a living document. Maintain it according to `PLANS.md`.

## Purpose / Big Picture

Phase B of `docs/SYSTEM_DESIGN.md`: the domain model becomes
**Hub → Collections → Resources**. Hubs own collections; users get a personal
hub at sign-up; publication is a boolean pair (`published`,
`linkSharingEnabled`) instead of the visibility triad; the schema gains
memberships, shares, saves, and invitations tables. Observable: sign-up
creates a hub with an owner membership; `POST /api/v1/collections` creates a
collection owned by that hub; unpublished collections are invisible to
strangers; the share-token flow works through `linkSharingEnabled`.

Deliberately NOT in this phase (Phase C): the hub policy service, hub-scoped
routes (`/hubs/:hubId/collections`), publish/unpublish + shares/saves
endpoints, explore, the public hub page, and deleting the username lookup.

## Progress

- [x] (2026-07-04) Prisma schema rewritten (Hub, HubMembership, HubInvitation,
      Collection, CollectionShare, CollectionSave, Resource, Link, Tag,
      CollectionTag, ResourceTag, ExportJob + better-auth models); `0_init`
      reshaped; dev DB reset; `migrate diff` clean; fresh-DB deploy green.
- [x] (2026-07-04) Enums/DTOs renamed (`ResourceKind` with `collection_link`;
      visibility enum deleted; `published` boolean in create/update DTOs).
- [x] (2026-07-04) Hubs module: `HubsService` (createHubWithOwner,
      getPrimaryHubId, isMember, assertMember) + framework-free
      `createPersonalHub` invoked from better-auth's `user.create.after` hook.
- [x] (2026-07-04) Modules renamed/reworked: collections, resources, tags,
      imports, exports (+ lookup controller); access bridge
      (published / admin / member / link+token) replaces owner/visibility.
- [x] (2026-07-04) Routes under `/api/v1/collections`; e2e suites rewritten
      (+ new hub-tenancy spec); live smoke incl. export queue confirmed.
- [x] (2026-07-04) `bun run verify` green (build + lint + unit + 14 e2e);
      docs + CHANGELOG updated; plan moved to `completed/`.

## Surprises & Discoveries

- Observation: the browser-friendly `?s=<token>` share link was rejected by
  the global `forbidNonWhitelisted` ValidationPipe on any route with a
  `@Query()` DTO — a latent bug the old smoke tests missed by only ever
  sending the token via the `x-share-token` header.
  Evidence: hub-tenancy e2e share-token read returned 400 until `s` was
  whitelisted on `CursorQueryDto`/`PaginationQueryDto`.
- Observation: verified the onboarding hook creates exactly one hub + owner
  membership per user.
  Evidence: `SELECT count(*)` — 7 users / 7 hubs / 7 owner memberships.

## Decision Log

- Decision: Include the `hub_invitations` table now (schema only, no
  endpoints).
  Rationale: the baseline reshapes once; Phase D adds behavior, not DDL.
  Date/Author: 2026-07-03 / namestarlit
- Decision: Until Phase C's hub-scoped routes, collection creation infers the
  target hub as the user's oldest owned hub (the personal hub), and the
  interim write-access rule is "any membership in the owning hub".
  Rationale: keeps the current API surface stable so B ships green; C
  replaces the routes and installs the real policy service.
  Date/Author: 2026-07-03 / namestarlit
- Decision: `kind` value `repository_link` becomes `collection_link`
  (CHECK constraint and enum) — no data migration needed, the dev DB is
  disposable and resets with the reshaped baseline.
  Date/Author: 2026-07-03 / namestarlit
- Decision: User deletion may orphan a hub (cascade removes memberships).
  Rationale: the last-owner rule and hub lifecycle land with Phases C/D;
  recorded here so it is not mistaken for intended final behavior.
  Date/Author: 2026-07-03 / namestarlit

## Outcomes & Retrospective

Shipped as planned. The model is now Hub → Collections → Resources with
hub-membership access and publication booleans; sign-up auto-creates a
personal hub via the app-owned onboarding hook (the SSO-ready seam). Interim
access is deliberately membership-only; Phase C installs the real policy
service, the hub-scoped routes, and the publish/share/save/explore endpoints
whose tables this phase already created. The `?s=` fix is a real correctness
win beyond the rename. Next: Phase C.

## Context And Orientation

Backend at `apps/api`. Schema: single `0_init` migration owning the
uuid-v7 function, `set_updated_at` triggers, the hierarchy trigger, CHECKs,
and partial unique indexes (`docs/runbooks/migrations.md`). Current models:
User/Repository/Link/Entry/Tag/RepositoryTag/EntryTag/ExportJob + better-auth
tables. Services check `ownerId === user.userId` and the visibility triad.
better-auth config is a standalone singleton (`src/auth/auth.ts`) with its
own PrismaClient — the onboarding hook must be callable from there (and from
any future SSO path), hence a plain function receiving a Prisma client.

## Plan Of Work

1. Rewrite `prisma/schema.prisma`; reshape `0_init` (rename tables/columns,
   new tables + triggers + CHECKs, renamed indexes incl. the partial unique
   `uq_resources_collection_link`); reset the dev DB; `prisma generate`.
2. Rename enums/DTOs/utils in `src/common`.
3. New `src/modules/hubs`: `HubsService.createHubWithOwner` ($transaction) +
   `createPersonalHub(prisma, { userId, name })` used by the better-auth
   `databaseHooks.user.create.after` hook.
4. `git mv` module directories (`repositories`→`collections`,
   `entries`→`resources`), rename classes/files/routes, replace access checks
   with the bridge rule, thread `hubId` through export jobs.
5. Update e2e specs and scratchpad smoke scripts to the new routes/fields.
6. Verify (root `bun run verify`, smokes, fresh-DB deploy, drift check),
   update docs/CHANGELOG, move this plan to `completed/`.

## Concrete Steps

```bash
docker compose up -d
bun run verify
# schema gates, from apps/api:
bunx prisma migrate diff --from-config-datasource --to-schema prisma/schema.prisma
# fresh-DB check per docs/runbooks/migrations.md
```

## Validation And Acceptance

- Sign-up (any auth path) atomically yields user + personal hub + owner
  membership; the hub is a completely normal row (no special-casing).
- `POST /api/v1/collections` creates a collection with `hub_id` set to the
  creator's personal hub; `published` defaults false.
- Unpublished collection: 404/403 to strangers on lookup and resource
  listing; readable by hub members; readable via share token only while
  `link_sharing_enabled`.
- Published collection appears in the public listing.
- Resource CRUD/reorder, tags, imports, exports behave as before under the
  new names; version-conflict semantics unchanged.
- `migrate diff` reports no drift; fresh-DB deploy works; verify green;
  smoke suites pass end to end.

## Idempotence And Recovery

The dev database is disposable and is dropped/recreated from the reshaped
baseline (documented; the same reset works for any worktree). No production
data exists anywhere. Code recovery is git.

## Artifacts And Notes

(Fill during implementation.)

## Interfaces And Dependencies

- Phase A contracts preserved: error envelope, `X-Request-Id`, cursor meta.
- better-auth boundary preserved: onboarding is app-owned and
  auth-path-agnostic; `resolveSessionUser` untouched.
- Route surface after B: `/api/v1/collections/:id/resources|tags|children|
  export`, `/api/v1/users/:username/collections/:slug` (interim),
  `/api/v1/imports/*` with `targetCollectionId`.
