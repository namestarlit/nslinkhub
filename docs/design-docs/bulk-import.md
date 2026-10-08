# Bulk import

Status: designed, not built (ExecPlan:
[deliver-bulk-import](../exec-plans/active/deliver-bulk-import.md)). Settled in
[ADR-0012](../engineering-decisions/0012-bulk-import-through-reviewed-drafts.md).
Bulk import is Save a link at scale: the same rules for every link, a preview
step to fix things before they land, and destinations that can span many
collections.

## Journey

1. **Start** (`/import`, reached from Save a link's "Bulk import links"): upload
   a bookmarks file (HTML, as every browser exports it) or a CSV, or paste a list
   of links, one per line. Nothing is saved to any collection yet.
2. **Preview**: a table of every row, filling in as titles resolve, with a
   summary line ("184 ready · 12 need attention · 3 duplicates") and filters
   All / Ready / Needs attention.
3. **Structure** (files with folders): keep everything in one collection with
   folders as sections, or split folders into collections; see below.
4. **Fix**: edit a failed row's address in place (re-checked at once), add or
   remove tags, drop rows; **Revalidate failed** retries lookups; **Drop all
   failed** clears them.
5. **Import N ready links**: commits every ready row to its destination. Rows
   that still need attention stay in the draft ("12 links need attention"),
   reachable from the import page until fixed or dropped.

## Rows and statuses

Each row holds an address, optional tags and its folder path. A source title
(bookmark text, a CSV `title` column) is ignored: titles come from the page.

| Status | Meaning | Importable |
| --- | --- | --- |
| Looking up | Waiting for its title | No (yet) |
| Ready | Valid public address; title found, or a real site without one (the address stands in) | Yes |
| Failed | Not an address, not public, domain doesn't exist, or the site couldn't be reached; the reason is shown | After a fix or revalidation |
| Duplicate | Same canonical address earlier in this draft for the same destination | No; dropped on import |
| Already saved | Already in its destination collection | No; skipped on import |
| Imported | Saved to its destination | — |

Checks are the Save a link checks: canonical address, the public-address rule,
tags normalized and capped. Editing an address moves the row back to Looking up.

## Folders and destinations

Bookmark folders (and a CSV `folder` column such as `Design/Typography`) form a
tree. The structure choice:

- **Keep in one collection**: one chosen destination (existing or new); every
  folder becomes a heading (section) in order, nested folders flattened to
  "Design › Typography".
- **Split into collections**: each folder gets a destination —
  - a new collection named after the folder (default for top-level folders);
  - an existing collection the person can edit;
  - a section in its parent folder's destination (default for subfolders);
  - skip (for leftovers such as "Other bookmarks").

Links outside any folder, and pasted lists, go to one chosen collection. New
collections are private. Changing a destination re-marks "Already saved" and
"Duplicate" rows for the new target.

## Limits

- One file up to 10 MB and 1,000 links per draft; larger exports are imported in
  parts (one folder at a time).
- Up to 3 open drafts per account; a draft expires 30 days after its last change.
- Title lookups run in the worker with a per-account budget separate from Save a
  link's previews, limited concurrency and politeness per site.

## API sketch

- `POST /api/v1/imports` (multipart file or pasted `urls`) → draft with rows.
- `GET /api/v1/imports/:id` → draft summary, folder tree and destinations;
  `GET /api/v1/imports/:id/rows?status=&cursor=` → paginated rows.
- `PATCH /api/v1/imports/:id/rows/:rowId` (address, tags), `DELETE …/rows/:rowId`.
- `PATCH /api/v1/imports/:id/folders/:folderId` (destination mode and target).
- `POST /api/v1/imports/:id/revalidate`, `POST /api/v1/imports/:id/drop-failed`.
- `POST /api/v1/imports/:id/commit` → per-destination counts; idempotent per row.
- `DELETE /api/v1/imports/:id` discards a draft.

The previous one-shot `POST /imports/csv` and `/imports/bookmarks-html` are
removed (pre-deployment, no compatibility).

## Web

`/import` lists open drafts and starts a new one. `/import/:id` is the preview:
structure panel, summary, filters and the paginated table, with native forms
for every action (works without JavaScript; the page refreshes to show progress,
and polls with JavaScript). Reuses Save a link's pieces: blue/red address
state, tag pills, destination picker.

## Open questions

- Whether bulk import is a paid feature (see [monetization.md](monetization.md));
  built free for now.
