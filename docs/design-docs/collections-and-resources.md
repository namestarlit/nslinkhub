# Collections and resources

Status: implemented. Item kinds and their API, link titles and public
addresses, tags, and the Save a link command. Settled in
[ADR-0007](../engineering-decisions/0007-resolved-titles-read-only-items.md) and
[ADR-0008](../engineering-decisions/0008-references-grant-nothing.md).

## Items and their API

Collections have no structural parent. Resources are ordered rows with versions:

- `POST /collections/:id/resources/external`: canonical HTTP(S) URL, optional
  tags. The title is resolved from the page, never an input. Pasting a
  collection URL still creates an external link.
- `POST /collections/:id/resources/collection`: `linkedCollectionId`, optional
  tags and position; its title is the target's. Requires source write and target read,
  including cross-hub references. One reference per source/target pair; cycles
  and multiple incoming references are allowed. No copied target title by default.
- `POST /collections/:id/resources/heading`: nonblank `titleOverride` and position.
  A heading groups resources without a collection or an access boundary.
- `PATCH /collections/:id/resources/:resourceId`: tags and position only. To
  change an address or a heading, remove the item and add it again.

A link must be a public web address (`isPublicLinkHost`, shared with the web):
IP literals, single-label, local/internal and reserved example/test names are
refused with `link_not_public`. Its title is looked up server-side after the
write commits, and again whenever an untitled collection is read
(`og:title`/`<title>`, YouTube oEmbed; SSRF-guarded, short deadline, small body
cap); no lookup runs under the write lock. Imports currently keep the source
file's title (bookmark text or a CSV `title` column); whether they should
resolve like other saves is an open product decision.

Reference edits, reorders and removal require only source write access. The
viewer-filtered `linkedCollection` payload is `{ id, title }` or null; it never
reveals an unreadable destination's title. Deleting a target nulls its reference
FK and leaves an unavailable resource. No nest/children endpoints, hierarchy
trigger, parent field, compatibility aliases or inherited-grant backfills remain.
Resources carry no summary. Titles and tags clarify links; headings organize guides.

## Tags

Optional labels stored **directly on** a collection or resource as a normalized
`text[]` (lowercase, de-duplicated, capped at write time) — set as part of
create/update, not a separate attach/detach step. There is no shared tag table,
no global namespace, and no "click a tag → everything tagged it" view: that
global machinery added complexity without value for a single-user tool.
Cross-library retrieval is a full-text search concern (Phase E), covering
titles, tags, and text together. Keep tags flat — no hierarchies or governance.

## First-link capture command

`POST /api/v1/capture` resolves the session owner's immutable hub and atomically
saves 1–2 links (each with optional tags, never a title; canonicalised and
deduplicated, appended in order; links already in the collection are kept
as they are) plus a user-scoped operation receipt, returning the collection
and the resource IDs in input order. A collection it creates takes
`collectionTitle`, or a default "Saved links, <date>" suffixed so it never
repeats a hub title. `GET /api/v1/link-preview?url=` (signed-in, read-only,
own "lookup" budget of 30/min) returns a canonical URL and looked-up title
for the save form. The command
uses the existing collection policy and resource canonicalization, and shares
the authority transaction. Its destination is first, new, or an explicit owned
collection ID. First-save concurrency uses a nullable immutable collection ID
on the hub, never a title/slug; only private unshared collections can be
implicitly reused by intents begun before that first collection was created.
Returning intents require a destination choice. Retry receipts recheck current
ownership/access and resource existence; deletion never recreates content on replay.
Receipts retain only IDs, a SHA-256 input fingerprint and creation time, with no
URL or authored text. Retention currently follows the no-automatic-account-deletion
boundary; future cleanup must define an explicit idempotency window.

The web retains at most three independent 30-minute AES-GCM draft cookies, each
below browser cookie limits; a draft that would outgrow its cookie drops tags
before any link. Ordinary email verification may submit the pending
capture with the newly issued session; invitation verification is separate.
Auth and capture intentionally commit separately, preserving login on save failure.
