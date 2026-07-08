# Product Definition

NSLinkHub is the canonical product definition for contributors and agents.
Where this document and any older material conflict, this document and
`docs/SYSTEM_DESIGN.md` win. (The original v2 feature spec was
retired after its durable content was absorbed here; git history keeps it.)

## 1. Product Overview

NSLinkHub organizes links into curated, shareable **collections** so people
stop losing resources in browser bookmarks and chat scrollback.

Core value:

- Package many related links, with commentary, into one collection.
- Share one stable URL instead of sending many individual links.
- Keep the collection current so what you shared always shows the latest
  content.
- Scale a collection from a simple bookmark list to a structured, ordered
  guide: a top-level collection acts as a table of contents whose sections are
  sub-collections (nesting is deliberately capped at two levels — a collection
  and its sections, "chapters with sections, no sub-chapters"), each with its
  own rich description and ordered resources.
- Publish the best collections for anyone to discover, save, and follow.
- Export a collection — expanding its nested sections in order into a single
  document, with external links kept as references rather than inlined — as
  Markdown, PDF, or Word, for offline use, broad sharing, or embedding in an
  ebook.

NSLinkHub is an ns-series product: a personal project under the namestarlit
brand, built to solve the author's own problem and published for others.

## 2. Core Concepts

```txt
Hub → Collections → Resources
```

- **Hub** — your one personal space (one hub per user, like a Google Drive),
  the tenant that owns your collections. Created at sign-up and identified by a
  unique, mutable **handle** (the "hub name", tailnet-style) that aliases the
  immutable hub id. You never join anyone else's hub; there are no memberships,
  invitations, or roles — collaboration is per-collection sharing (below).
- **Collection** — the container of curated content; what a folder is to
  Google Drive. A collection is created standalone; **nesting is a separate
  action on collections that already exist** — you add an existing collection
  into another as a section (there is exactly one way to nest). Collections
  nest at most two levels: a collection and its sections (a section cannot
  contain sub-sections, and a collection with sections cannot itself be
  nested). Removing a section's entry un-nests it (it becomes standalone
  again).
- **Resource** — an item in a collection, and the smallest unit of content
  (like text in a document). Its kind is set by *how it was added*, never by
  inspecting the URL:
  - an **external link** — what a pasted/copied URL always becomes (even one
    pointing to a collection's page): a hyperlink with an editable title, tags,
    and position. It does not expand or nest; opening it just navigates there,
    subject to that destination's own access.
  - a **collection-link** (`kind = collection_link`) — a **section**. It is
    created only by nesting an existing collection (same hub) into this one, and
    is the expandable table-of-contents entry for it. Because a collection-link
    is always a structural section, it is always access-inherited and bounded by
    the two-level cap. There is no way to link an arbitrary collection as a
    floating pointer, and cross-hub references are a future read-only shortcut.

  There is no URL auto-detection: the system never turns a pasted link into an
  expandable collection-link. A resource has no summary — clarify a vague link
  by renaming its title; tags carry the rest.
- **Tag** — an optional normalized lowercase label. Tags are a plain **string
  array** on a collection or a resource — no shared tag table, no global
  namespace. They are set when creating or updating the item (see "Tags"
  below).

### Tags

Tags are optional labels stored **directly on** a collection or a resource as a
string array, normalized (lowercase, de-duplicated, capped) at write time. They
describe what a link or collection is — `video`, `tool`, `free`, `must-read` —
so a vague title reads clearly at a glance, and they are set as part of
create/update (there is no separate attach/detach step).

Deliberately **not a global entity**: no shared tag table, no
"click a tag → everything tagged it" cross-cutting view, no autocomplete pool.
For a single-user tool that normalization added storage and cleanup complexity
without real value — retrieving across a library is a **full-text search**
concern (Phase E), which covers titles, tags, and text together. Tagging is
always optional; keep tags flat (no hierarchies or governance).

## 3. Target Users

- **The curator** (primary; the author is user zero): collects resources on
  topics they care about, organizes them into collections, and shares or
  publishes the good ones.
- **The recipient**: receives a shared collection (link or direct); can read
  without an account, and with an account gets the collection in their own
  space's shared/ surface instead of re-bookmarking it elsewhere.
- **The collaborator**: a specific person the curator grants `editor` on a
  collection (Drive-style) — they edit that one collection from their own
  space, without joining anything.
- **The browser**: discovers published collections on the explore surface
  (optionally filtered by a hub handle) and saves the ones worth keeping.

## 4. Capabilities

### Capture and organize

- Create collections (nested), add resources with commentary, reorder with
  optimistic-concurrency version checks, tag, and deduplicate URLs by
  canonical form.
- Import from browser-bookmarks HTML (the primary migration path) and from a
  **universal CSV format**: a documented required-column layout (`url`, plus
  optional `title`) that users fill from any tool — a spreadsheet, a script
  over a chat export, anything that writes CSV. Every import returns a
  partial-failure report (imported/skipped/error counts plus per-row errors),
  so outlier rows are flagged for the user to fix or drop rather than failing
  the whole file. No source-specific parsers beyond bookmarks HTML.
- Canonical URL identity: lowercase scheme/host, normalized paths, sorted
  query params, tracking params stripped (`utm_*`, `fbclid`, `gclid`) — so
  the same resource captured twice converges.
- Capture from the browser via the extension (popup, context menu, keyboard
  shortcut) into a chosen hub + collection.

### Share (Drive philosophy)

- **Link sharing**: anyone with the rotatable link can read. Signed-in
  openers get the collection under their **shared/** surface while the link
  stays enabled.
- **Direct sharing**: share to a specific account by email as `reader`
  (default) or `editor` (content-only write). Independent of the link,
  individually revocable, lands in the recipient's shared/. This is the only
  collaboration mechanism — an editor works from their own space; there is no
  hub to join.
- **Ownership transfer**: a **top-level** collection can be transferred to a
  user who is already an `editor` on it (Drive-style;
  `POST /collections/:id/transfer`) — a section cannot be transferred alone; it
  moves with its parent. On transfer the collection subtree moves into the new
  owner's hub ("MyDrive"),
  the previous owner keeps it as an editor in their shared/, and the immutable
  **creator** is unchanged (owner is mutable, creator is not). Handing over an
  entire account/hub is instead done by changing the account email (with
  verification; planned with the email/MFA work), not a separate transfer model
  — a hub is 1:1 with its account.

### Publish and discover

- **Publish/unpublish** (replaces public/unlisted/private): published
  collections appear on the product-wide **explore** surface and the hub's
  public page; unpublished collections are visible to the hub owner and
  explicit shares only.
- **Publishing a collection makes its sections publicly readable too** (access
  inherits down): a published guide's sub-sections can be read as part of it,
  though they are *not* listed separately in explore. This is intended — a
  guide is useless if its sections 404 — but it is a public exposure, so the
  web publish flow must confirm it ("this will make N sections readable").
- Account holders **save** published collections (social-style bookmark) into
  their **saved/** surface; saves go dormant when a collection is unpublished
  and revive on republish.

### Export

- Export one **or more** collections as Markdown, PDF, or Word in a single
  synchronous request: the response body is the file itself (a zip when
  several collections are selected, one document per collection). Each
  document reads like one written in Google Docs — root collection = H1 with
  its description under it, each sub-collection **expands in order** as an H2
  section with its description, hyperlinked resource lines under each; never
  an H3, by the two-level nesting cap. `expand: false` collapses
  sub-collections to a single line instead. External-link resources stay as
  references and are not inlined. Rendering is programmatic, so no format
  needs a job queue and nothing is stored server-side. Export requires a
  signed-in account — anonymous readers of published or link-shared
  collections browse but do not export. (Word replaces the earlier CSV idea —
  CSV remains an import format only.)

### Account

- Email + password via self-hosted better-auth (cookie sessions for browsers,
  bearer tokens for API clients and the extension). No username: identity is a
  free-form **display name** plus a unique, mutable **hub handle**. Profile
  self-service lives at `/api/v1/profile`. Later: "Continue with namestarlit"
  SSO (`docs/design-docs/identity-sso.md`).

## 5. Product Surfaces

```txt
API        The product authority (NestJS, /api/v1). Everything below consumes it.
Web        Full surface: explore, hubs, collections, sharing, saves, account.
Extension  Constrained capture companion (popup, context menu, shortcut).
```

The web app's product experience, interface system, and design tokens are
defined in a dedicated design pass before web implementation (Track W3).

## 6. Acceptance Criteria (durable behaviors)

- An unpublished collection is invisible to strangers: not on explore, not on
  the hub's public page, 404 to unauthorized direct requests.
- A share-link reader can read but never write; rotating or disabling the
  link immediately cuts off link-derived access.
- A direct-share `editor` can modify resources/tags/imports in that one
  collection but cannot publish, manage sharing, delete the collection, or
  see anything else in the hub.
- Saving requires publication; a save survives unpublish (dormant) and
  revives on republish.
- Each user owns exactly one hub (their space), created at sign-up with a
  unique derived handle; the handle is mutable, but durable links use the
  immutable hub id, so a rename never breaks a saved reference.
- Reorder and update operations reject stale versions (409) rather than
  silently overwriting concurrent edits.
- Imported files that are malformed produce per-row errors, not partial
  silent corruption.
- Tags are normalized (lowercase, de-duplicated) string arrays stored directly
  on collections and resources; there is no shared tag table. An external
  resource stores its own canonical URL (one copy of a given URL per
  collection).
- Access inherits down the hierarchy: a direct share, active link, or
  publication on a collection grants the same access to its descendant
  collections (and their resources) — sharing a "folder" shares its contents.
  Ownership already spans the whole subtree (one hub).
- Nesting is a single action — add an existing same-hub collection into another
  as a section; it creates the structural link and the section entry together,
  and removing the entry un-nests it. Nesting a section into a collection, or
  nesting a collection that already has sections, is rejected (two-level cap).
- A collection-link exists only as a section (created by nesting); there is no
  way to link an arbitrary collection, so every collection-link is same-hub and
  access-inherited by construction.
- Only a top-level collection can be transferred; transferring a section is
  rejected.
- All identifiers exposed in routes are immutable UUIDv7 values; changing a
  username, hub name, or collection title never breaks a stored reference.

## 7. Out Of Scope (initial)

- Mobile applications.
- Resource-level saves, explore ranking beyond recency, vanity hub handles,
  sharing to unregistered emails, and full-text search across collections and
  resources — tracked in the hub design doc's deferred (Phase E) list.
- Billing or any commercial machinery.
- **Authored rich content / a document or course builder.** Section content is
  a rich *description* plus linked resources — never a block/rich-text editor,
  authored article prose, or hosted/uploaded media. Media is attached as a
  *resource* (a link to an unlisted YouTube or Vimeo video, a recording, etc.),
  not uploaded or authored in-product. A media-and-blocks course/document
  builder is a *different product*: it drags in an editor, object storage, and
  — decisively — organizations and teams, which the individual-scoped ns series
  deliberately excludes. NSLinkHub curates and references; it does not author
  or host. The line is "rich description," and it stops there.

## 8. Open Product Decisions

Both resolve during the W3 web design pass, with real surfaces in hand:

- Explore curation/ranking beyond recency (recency-only ships first; richer
  ranking is a Phase E item).
- The exact presentation of dormant saves on the saved surface.
