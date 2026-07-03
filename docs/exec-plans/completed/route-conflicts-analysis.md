# Route conflicts: repositories `:owner/:slug` shadows literal sub-routes

**RESOLVED (2026-07-03).** Both issues below were fixed differently than
proposed here: instead of reordering module/route registration (which only
relocates the ambiguity — e.g. a repository slugged "entries" would then break
the lookup), the owner/slug lookup moved off `/repositories` entirely, to
`GET /api/v2/users/:username/repositories/:slug`
(`src/modules/repositories/repository-lookup.controller.ts`). Regression e2e
tests live in `test/routes.e2e.spec.ts`, including the non-uuid 400 canary
proposed below. The reserved-slug design note is moot under this fix: slugs no
longer appear anywhere under `/repositories/*` (repositories are addressed by
uuid there), and the lookup path `/users/:username/repositories/:slug` has no
literal sibling segments to collide with. Kept for the analysis below.

---

Post-migration follow-up. These defects were confirmed on pre-migration main
(db22cd7) in a worktree investigation on 2026-07-02/03, then re-checked against
the in-progress Prisma working tree — the two issues below still apply there.
Fix after the migration lands; the fix is identical either way (it only touches
route registration order, not the data layer).

**Root cause:** NestJS registers routes in module import order, then in
declaration order within a controller. `GET api/v2/repositories/:owner/:slug`
matches *any* two-segment GET path under `/repositories`, so every more
specific GET route must register before it — currently two don't.

## Issue 1 — `GET /api/v2/repositories/:id/entries` unreachable

- `RepositoriesModule` precedes `EntriesModule` in `src/app.module.ts`, so
  `:owner/:slug` wins with `owner=<uuid>, slug='entries'` and returns
  404 "Repository not found" for every entries listing.
- Verified with curl: `GET /api/v2/repositories/not-a-uuid/entries` returns the
  repositories controller's 404 instead of a 400 from the entries controller's
  `ParseUUIDPipe`.
- [ ] Fix: move `EntriesModule` above `RepositoriesModule` in `src/app.module.ts`,
      with a comment explaining the ordering constraint so a future cleanup
      doesn't alphabetize it back.

## Issue 2 — `GET /api/v2/repositories/:id/children` unreachable

- Same shadowing, but *within* `RepositoriesController`
  (`src/modules/repositories/repositories.controller.ts`):
  `@Get(':owner/:slug')` is declared before `@Get(':id/children')`.
- [ ] Fix: move `getByOwnerAndSlug` to the **end** of the controller class,
      with a comment that it must stay last among GET routes.

## Already fixed during the migration (no action)

- `PATCH .../entries/reorder` was shadowed by `@Patch(':entryId')` on
  pre-migration main (the UUID pipe rejected `'reorder'` with a 400). The
  Prisma working tree already declares `reorder` first — keep it that way.

## Design note — reserved slugs (decide, don't skip)

Once the literal routes win, the ambiguity flips: a repository whose slug is
literally `entries` or `children` becomes unreachable via `GET :owner/:slug`
(the request 400s in the UUID pipe instead of falling through). Slug validation
(`CreateRepositoryDto`, `^[a-z0-9-]+$`) currently allows these.

- [ ] Add a reserved-slug list to repository slug validation. Minimum:
      `entries`, `children`, `public`. Consider also reserving path segments
      used by sibling controllers (`tags`, `export`, `share-link`) to keep the
      URL space unambiguous for future routes.

## Regression test

A full e2e spec was written and proven on the pre-migration branch (it failed
4/5 cases before the fix, passed after). That version needed TypeORM-era
workarounds (register-token `sub` bug, missing ids in create responses, direct
DB seeding) which Prisma makes unnecessary — post-migration it reduces to plain
API calls:

- [ ] Add `test/entries-routing.e2e-spec.ts`:
  1. Setup: register + login, `POST /api/v2/repositories` (visibility
     `public`), `POST .../entries/external` (one entry). Use unique suffixed
     username/slug; clean up in `afterAll`.
  2. `GET /api/v2/repositories/:id/entries` **without auth** → 200, one item,
     `meta.total: 1` (was 404 pre-fix).
  3. `GET /api/v2/repositories/not-a-uuid/entries` → 400 "Validation failed"
     from `ParseUUIDPipe` (was 404 pre-fix — this is the cheapest canary for
     the ordering regressing).
  4. `GET /api/v2/repositories/:id/children` without auth → 200 `[]`
     (was 404 pre-fix).
  5. Guard against over-correction: `GET /api/v2/repositories/:owner/:slug`
     still resolves the repository (200, matching id).
  6. `PATCH .../entries/reorder` with a valid payload → 200 (guards the
     already-fixed declaration order in the entries controller).
