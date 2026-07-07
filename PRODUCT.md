# Product Definition

NSLinkHub is the canonical product definition for contributors and agents.
Where this document and any older material conflict, this document and
`docs/design-docs/hub-architecture.md` win. (The original v2 feature spec was
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
  guide: collections nest, so a top-level collection can act as a table of
  contents whose sections are sub-collections (nested as deep as needed), each
  with its own rich description and ordered resources.
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
  Google Drive. Collections nest.
- **Resource** — an item in a collection: an external link (with title
  override, description, note, position) or a link to another collection.
- **Tag** — normalized lowercase labels attachable at two levels, on
  collections and on resources — a retrieval axis orthogonal to the collection
  hierarchy (see "Tags: the retrieval axis" below).

### Tags: the retrieval axis

Collections are the primary *organization* (where a link belongs). Tags are a
distinct, orthogonal *retrieval* axis, optional at two levels with different
jobs:

- **Collection tags — what a collection is about.** Coarse topical discovery
  and grouping across collections (`design`, `react`, `recipes`); the
  discovery-facing level (a person's collections, or the explore surface,
  browsed/filtered by topic).
- **Resource tags — what an individual link is.** The item-level axis
  collections structurally cannot provide: retrieving one resource *across*
  collections, plus facets that describe the link itself rather than its
  collection — format/nature (`video`, `tool`, `pdf`, `free`, `paywalled`),
  status (`must-read`, `todo`), and filtering within a large collection or
  guide. This answers "where did I put that one article?" — the retrieval half
  of escaping bookmarks hell that grouping alone does not solve.

Principle: collections stay primary; **tagging is always optional, never a
required step**, and grows more useful as a library grows. Resource tags are
justified by a **cross-collection filter view** ("everything tagged `video`
across my hub") — without that surface they are decoration; the view is what
earns them. Keep tags flat and lightweight — no hierarchies, required tags, or
tag governance. Full-text search (Phase E) is the heavier retrieval answer;
tags are the manual precursor. **W3:** expose resource tags lightly (optional
chips) and ship the cross-collection filter as the surface that proves them.

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
- Import from CSV, browser-bookmarks HTML, and WhatsApp chat exports, with a
  partial-failure report (imported/skipped/error counts plus per-row errors).
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

### Publish and discover

- **Publish/unpublish** (replaces public/unlisted/private): published
  collections appear on the product-wide **explore** surface and the hub's
  public page; unpublished collections are visible to the hub owner and
  explicit shares only.
- Account holders **save** published collections (social-style bookmark) into
  their **saved/** surface; saves go dormant when a collection is unpublished
  and revive on republish.

### Export

- Export a collection as Markdown, PDF, or Word. Export **expands nested
  sub-collections in order** into one document, so a table-of-contents
  collection becomes a printed guide in a single pass; external-link resources
  stay as references and are not inlined. Markdown is synchronous; PDF and Word
  run as queued jobs with status polling. (Word replaces the earlier CSV idea —
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
- Tags are global and shared; a tag is deleted once nothing references it (no
  collection and no resource, via detach or a cascading delete) — no dangling
  tags accumulate.
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
