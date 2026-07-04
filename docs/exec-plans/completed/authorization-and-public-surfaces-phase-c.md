# Authorization policy service + public surfaces (Phase C)

This ExecPlan is a living document. Maintain it according to `PLANS.md`.

## Purpose / Big Picture

Phase C of `docs/design-docs/hub-architecture.md`. A single
`CollectionPolicyService` becomes the source of truth for collection access,
replacing the interim membership checks scattered across services. The real
capability tiers land: hub **members** manage (publish, share, delete);
direct-share **editors** write content only; **readers / link / published**
read only. Discovery and sharing surfaces ship: `/explore`, the public hub
page, publish/unpublish, link-sharing toggle, direct shares, saves, and the
`/me/shared` + `/me/saved` user surfaces. The mutable-username lookup route is
deleted in favor of `GET /hubs/:hubId/collections/:slug`.

Observable: a stranger gets 404 on an unpublished collection and never sees it
in `/explore`; a direct-share editor can add resources but cannot publish; a
reader cannot write; rotating a share link cuts off everyone who held it;
saving requires publication and a save goes dormant when unpublished.

## Progress

- [x] (2026-07-04) `CollectionPolicyService` (resolve access; requireRead/WriteContent/
      Manage; recordLinkAccess). Exported from HubsModule.
- [x] (2026-07-04) Reworked collections service: management ops (update/remove/publish/
      unpublish/link-sharing/shares/createChild) use requireManage; add
      hub-scoped list + lookup, explore listing, shares CRUD, save/unsave,
      me/shared, me/saved.
- [x] (2026-07-04) Reworked resources/tags/imports write paths to requireWriteContent
      (editor or member); read paths to policy requireRead + link recording.
      Exports read via policy.
- [x] (2026-07-04) New controllers: ExploreController, HubsController (public page + hub
      collections list + lookup), MeController; CollectionsController gains
      publish/unpublish/link-sharing/shares/save; delete the username lookup
      controller and `/collections/public`.
- [x] (2026-07-04) New DTOs: create-share, set-link-sharing.
- [x] (2026-07-04) E2E reworked + sharing spec added (19 e2e) specs per the acceptance list; `bun run verify`
      green; live smoke.
- [x] (2026-07-04) Docs (ARCHITECTURE codemap/routes, PRODUCT if needed) + CHANGELOG;
      plan to completed/.

## Surprises & Discoveries

- Observation: switching reads to `policy.requireRead` (which throws 404, not
  the old 403) changed two hub-tenancy expectations. This is the intended
  "prefer 404 for resources you cannot know exist" behavior; updated the
  tests to 404.
  Evidence: stranger reading an unpublished collection / wrong token → 404.

## Decision Log

- Decision: `canManage` = any hub membership (owner/admin/member) plus the
  platform-admin bypass; no role gradation in Phase C.
  Rationale: members have full content write and publish/share authority
  per the design; owner-only actions (transfer, last-owner rule) are Phase D.
  Date/Author: 2026-07-04 / namestarlit
- Decision: disabling link sharing clears the share-token hash (not just the
  flag).
  Rationale: makes "disable cuts off access" unambiguous and forces a fresh
  token on re-enable — no accidental resurrection of an old link.
  Date/Author: 2026-07-04 / namestarlit
- Decision: `/explore` replaces `GET /collections/public`; the hub-scoped
  lookup `GET /hubs/:hubId/collections/:slug` replaces and deletes
  `GET /users/:username/collections/:slug`.
  Rationale: design route surface; usernames are mutable (principle 1).
  Date/Author: 2026-07-04 / namestarlit
- Decision: `/me/saved` returns saved collections with an `available` flag
  (= published) rather than filtering unpublished ones out.
  Rationale: the design's "dormant handling" — a dormant save is visible but
  marked unavailable, and revives when the collection is republished.
  Date/Author: 2026-07-04 / namestarlit

## Outcomes & Retrospective

Shipped as planned. Access resolution is now centralized in one service and
the capability tiers (member / editor / reader) are real and tested. The
public product surfaces exist: explore, hub pages, saves, and the shared/
and saved/ user views. Verified green (build + lint + unit + 19 e2e) and via
a live smoke of every new surface. Next: Phase D (invitations + membership
management), then the W2/W3/W4 client tracks.

## Context And Orientation

Phase B left interim access checks: `HubsService.assertMember/isMember` used
directly in collections/resources/tags/imports/exports. Collection read logic
is duplicated (published/member/link-token) in collections and resources
services. `CollectionLookupController` resolves owner→personal hub→slug.
`getPublic` lives on the collections controller at `/collections/public`.
Share links use `POST /collections/:id/share-link`. Tables `collection_shares`
and `collection_saves` exist (Phase B) with no endpoints yet.

## Plan Of Work

1. `hubs/collection-policy.service.ts`: `resolve(collection, viewer, token)`
   → `{ canRead, canWriteContent, canManage, viaLinkToken, hubRole }`
   (admin bypass; membership → all; direct editor → write; direct reader /
   link row (while enabled) / valid token / published → read).
   `requireRead/WriteContent/Manage` throwers; `recordLinkAccess` upsert.
2. collections.service: replace interim checks with policy; add publish,
   unpublish, setLinkSharing, listShares, createShare (email→userId), remove
   Share, save, unsave, listShared, listSaved, listHubCollections,
   getHubCollectionBySlug, getHubPage, explore. Remove getByOwnerAndSlug,
   getPublic, createOrRotateShareLink.
3. resources/tags/imports: write → policy.requireWriteContent; resources read
   → policy.requireRead + recordLinkAccess. exports read → policy.requireRead;
   getJob → membership.
4. Controllers: ExploreController, HubsController, MeController; update
   CollectionsController; delete CollectionLookupController.
5. Wire modules; update e2e; verify; live smoke.

## Concrete Steps

```bash
docker compose up -d
bun run verify
```

## Validation And Acceptance

- Unpublished collection: 404 to stranger; absent from `/explore`.
- Direct reader share: reads, cannot write (403 on resource create).
- Direct editor share: creates resources; 403 on publish and on share mgmt.
- Link rotation/disable: a previously valid token and link-sourced access
  both stop working.
- Save requires publication (400 on unpublished); unpublish makes the save
  `available:false`; republish restores `available:true`.
- Hub-scoped lookup works; username lookup route is gone (404).
- `bun run verify` green; live smoke incl. export queue passes.

## Idempotence And Recovery

Pure code + additive endpoints; no schema change (Phase B added the tables).
Recovery is git. Link-share recording upserts are idempotent.

## Interfaces And Dependencies

- Phase A/B contracts preserved (envelope, request id, cursor, camelCase).
- New public routes: `/explore`, `/hubs/:hubId`, `/hubs/:hubId/collections`,
  `/hubs/:hubId/collections/:slug`, `/collections/:id/{publish,unpublish,
  link-sharing,shares,save}`, `/me/{shared,saved}`.
- Removed: `/collections/public`, `/collections/:id/share-link`,
  `/users/:username/collections/:slug`.
