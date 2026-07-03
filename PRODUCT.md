# Product Definition

NSLinkHub is the canonical product definition for contributors and agents.
Where this document and older specs conflict, this document and
`docs/design-docs/hub-architecture.md` win. The original v2 feature spec is
kept as historical background at `docs/nestjs-v2-feature-spec.md`.

## 1. Product Overview

NSLinkHub organizes links into curated, shareable **collections** so people
stop losing resources in browser bookmarks and chat scrollback.

Core value:

- Package many related links, with commentary, into one collection.
- Share one stable URL instead of sending many individual links.
- Keep the collection current so what you shared always shows the latest
  content.
- Publish the best collections for anyone to discover, save, and follow.
- Export collection content (Markdown, PDF) for offline and broad sharing.

NSLinkHub is an ns-series product: a personal project under the namestarlit
brand, built to solve the author's own problem and published for others.

## 2. Core Concepts

```txt
Hub → Collections → Resources
```

- **Hub** — the tenant: a personal or shared space that owns collections.
  Users belong to hubs through memberships (`owner | admin | member`) and
  join by invitation. Every user gets a personal hub at sign-up; it is a
  completely normal hub.
- **Collection** — the container of curated content; what a folder is to
  Google Drive. Collections nest.
- **Resource** — an item in a collection: an external link (with title
  override, description, note, position) or a link to another collection.
- **Tag** — normalized lowercase labels attachable to collections and
  resources.

## 3. Target Users

- **The curator** (primary; the author is user zero): collects resources on
  topics they care about, organizes them into collections, and shares or
  publishes the good ones.
- **The recipient**: receives a shared collection link; can read without an
  account, and with an account gets the collection in their shared/ surface
  instead of re-bookmarking it elsewhere.
- **The browser**: discovers published collections on the explore surface and
  saves the ones worth keeping.
- **The team/community hub**: a group curating collections together under a
  shared hub.

## 4. Capabilities

### Capture and organize

- Create collections (nested), add resources with commentary, reorder with
  optimistic-concurrency version checks, tag, and deduplicate URLs by
  canonical form.
- Import from CSV, browser-bookmarks HTML, and WhatsApp chat exports.
- Capture from the browser via the extension (popup, context menu, keyboard
  shortcut) into a chosen hub + collection.

### Share (Drive philosophy)

- **Link sharing**: anyone with the rotatable link can read. Signed-in
  openers get the collection under their **shared/** surface while the link
  stays enabled.
- **Direct sharing**: share to a specific account by email as `reader`
  (default) or `editor` (content-only write). Independent of the link,
  individually revocable, lands in the recipient's shared/.
- Hub membership is never required just to see or edit one collection —
  invitations are for people who belong in the hub.

### Publish and discover

- **Publish/unpublish** (replaces public/unlisted/private): published
  collections appear on the product-wide **explore** surface and the hub's
  public page; unpublished collections are visible to hub members and
  explicit shares only.
- Account holders **save** published collections (social-style bookmark) into
  their **saved/** surface; saves go dormant when a collection is unpublished
  and revive on republish.

### Export

- Markdown export synchronously; PDF export as a queued job with status
  polling.

### Account

- Email/username + password via self-hosted better-auth (cookie sessions for
  browsers, bearer tokens for API clients and the extension). Later:
  "Continue with namestarlit" SSO (`docs/design-docs/identity-sso.md`).

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
- Removing the last owner of a hub is impossible; membership comes only from
  explicit invitation + authenticated acceptance.
- Reorder and update operations reject stale versions (409) rather than
  silently overwriting concurrent edits.
- Imported files that are malformed produce per-row errors, not partial
  silent corruption.
- All identifiers exposed in routes are immutable UUIDv7 values; changing a
  username, hub name, or collection title never breaks a stored reference.

## 7. Out Of Scope (initial)

- Mobile applications.
- Full-text search across collections and resources (future product
  decision).
- Resource-level saves, explore ranking beyond recency, vanity hub handles,
  sharing to unregistered emails — tracked in the hub design doc's deferred
  list.
- Billing or any commercial machinery.

## 8. Open Product Decisions

- Explore curation/ranking beyond recency (decide during the web design
  pass).
- The exact presentation of dormant saves (web design pass).
- Whether full-text search enters the roadmap after the hub architecture
  ships.
