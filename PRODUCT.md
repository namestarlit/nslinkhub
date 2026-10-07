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
- Structure guides with ordered headings and links. Reference another
  collection when it is useful as an independent resource, including collections
  from other hubs; references never change ownership or access.
- Publish the best collections for anyone to discover, save, and follow.
- Export collections as Markdown, PDF or Word. Keep references as links by
  default, or explicitly include readable referenced collections one level deep.
  Exports never fetch remote page content; external links remain hyperlinks.

NSLinkHub is an ns-series product: a personal project under the namestarlit
brand, built to solve the author's own problem and published for others.

## 2. Core Concepts

```txt
Hub → Collections → Resources
```

- **Hub** — your one personal space (one hub per user, like a Google Drive),
  the tenant that owns your collections. Created at sign-up and identified by a
  unique, mutable **handle** that aliases the immutable hub id. Its public
  **display name** is stored on the hub, independently of the account owner’s
  full name or email. Hubs resolve by ID or handle; ownership changes do not
  rename the hub. You never join anyone else's hub; there are no memberships,
  invitations, or hub roles — collaboration is per-collection sharing (below).
- **Collection** — an independent container with its own title, description,
  tags, sharing and publication. There are no parent/child relationships.
- **Resource** — an ordered item in a collection. Kind is chosen when added:
  - **External link**: a pasted URL, including a URL to another collection.
    It remains a hyperlink with an editable title and tags.
  - **Collection reference** (`collection_link`): an explicit reference by
    immutable collection ID. The adding editor must be able to read the target.
    References can cross hubs, be reused or form cycles. Reading, sharing,
    publishing, transferring or deleting the source never grants access to or
    modifies the target. Unavailable targets show a neutral unavailable entry.
  - **Heading**: an ordered text label for grouping links inside a guide,
    without creating a separate collection or permission boundary.

  There is no URL auto-detection. Resources have no summary; use titles and tags.
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

- Create independent collections, add links, references and headings, reorder with
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
- Save a link takes one or two links per save (two copy-and-paste trips at
  most; bulk import is for more), each with optional tags, into one chosen
  collection. Repeats, non-addresses and domains that don't exist are refused
  in the form; a site that exists but gives no title is still saved. People type only what they must: a title is never an
  input (personal context will be a separate note, planned with richer link
  metadata). Choosing a new collection asks for its
  name, prefilled with a suggestion that never repeats ("Saved links, Oct 7",
  then "(2)"); typed names may repeat. The destination list shows when each
  collection was last updated.
- Saved links must open for everyone they are shared with: localhost,
  loopback and IP addresses, local/internal names and names reserved for
  examples and testing (`example.com`, `.test`, `.invalid`, …) are refused by
  the API and flagged in the form.
- Every link gets a title resolved from its page: the save form shows each
  pasted address's title as confirmation before saving. Untitled links are also filled after
  the save commits and whenever a collection is opened (`og:title`/`<title>`,
  or YouTube's oEmbed; public addresses only, short deadline, small body cap).
  Failure leaves the URL as the title; nothing else from the page is stored.
- Capture from the browser via the extension (popup, context menu, keyboard
  shortcut) into a chosen hub + collection.

### First-link activation

The landing's primary action is **Save your first link**; Discover remains
available. Paste one HTTP(S) URL, then verify email if signed out. Sending
a code creates no account or content. Verification signs in an existing account
or creates the ordinary account and its one hub. The API saves the first private
“My links” collection and resource atomically with a user-scoped retry identity.
No profile, title or handle setup is required. Existing owners choose a destination
or create a private collection. Adding to a published collection requires an
explicit destination choice. The saved reader offers another link and optional
renaming. General **Sign in** returns through `/hub` to the owner’s stable `/h/<hubId>` address.

### Share (Drive philosophy)

- **Link sharing**: anyone with the rotatable link can read. Signed-in
  openers get the collection under their **shared/** surface while the link
  stays enabled.
- **Direct sharing**: share to a specific account by email as `reader`
  (default) or `editor` (content-only write). Independent of the link,
  individually revocable, lands in the recipient's shared/. This is the only
  collaboration mechanism — an editor works from their own space; there is no
  hub to join.
- **Ownership transfer**: a collection can be transferred to an existing
  `editor` (`POST /collections/:id/transfer`). Only that collection moves into
  the recipient's hub. Referenced collections remain unchanged. The previous
  owner becomes an editor and the immutable creator remains unchanged. Handover
  of an entire account/hub is instead done by changing the account email (with
  verification; implemented locally in the auth-delivery backend), not a separate transfer model
  — a hub is 1:1 with its account.

### Publish and discover

- **Publish/unpublish** (replaces public/unlisted/private): published
  collections appear on the product-wide **explore** surface and the hub's
  public page; unpublished collections are visible to the hub owner and
  explicit shares only.
- Publication applies only to the collection being published. Referenced
  collections need their own publication or grants; inaccessible targets remain
  unavailable. Every independently published collection can appear in explore.
- Account holders **save** published collections (social-style bookmark) into
  their **saved/** surface; saves go dormant when a collection is unpublished
  and revive on republish.

### Discuss

Every collection can carry a discussion: top-level comments (questions or
notes) with one level of replies. Comments follow the collection's own access,
so anyone who can read the collection can read its discussion. Signed-in readers
with access (published collections, direct shares, or an active share link they
opened) can comment and reply; anonymous readers see a sign-in prompt. Anyone who
can comment may reply, so help never waits on the curator. Replies from the owner
or an editor are labelled Curator or Editor, and the owner or an editor can mark
one reply per question as the answer; it is shown first. Each question returns
up to 100 readable replies, independently of other questions. “More replies”
continues that thread; a readable accepted answer stays first on each page.

Authors edit or delete their own comments (a question with replies keeps a
placeholder). The owner and editors can hide comments; hidden comments stay
visible to them. Owners turn comments off per collection (on by default);
existing comments stay readable. A collection on hold accepts no new comments.
Comments never grant access to the collection or anything it references.
Comment notifications and operator moderation follow as the next milestone.

### Export

- Export one or more collections as Markdown, PDF or Word in a synchronous
  request (one file, or a zip with one document per selected collection).
  The collection title is H1, its description follows, and ordered headings
  become H2. References remain durable links by default. With `expand: true`,
  readable referenced collections become H2 sections; their headings become H3.
  Expansion stops there: deeper and self references remain links. Every target
  is separately authorized; unavailable references get a generic notice without
  disclosing a title or content. External links remain hyperlinks. Nothing is
  queued or stored server-side. Export requires sign-in; anonymous readers browse.

### Account

- Email codes via self-hosted better-auth (cookie sessions for browsers,
  bearer tokens for API clients and the extension). No username: identity is a
  full name on the account and a public hub name plus unique, mutable **hub handle**. Profile
  self-service lives at `/api/v1/profile`. Later: "Continue with namestarlit"
  SSO (`docs/design-docs/identity-sso.md`).
- **Email code is the sign-up and sign-in path** (ships with the email-delivery slice):
  continue with email → enter the emailed code. Authentication emails carry
  codes only, without direct sign-in links or password authentication. The W3 design pass
  shapes the presentation; the flow itself is decided
  (`docs/SYSTEM_DESIGN.md` § Identity and handles).
- **Account handover = verified email change**, double-verified: confirm from
  the **current** address by code (which sees the target address; ignoring it changes
  nothing), then verify the **new** address by code; on completion all sessions are
  revoked and the account signs in with the new email
  (`docs/SYSTEM_DESIGN.md` § Identity and handles).

Optional authenticator-app TOTP and recovery codes are a separate follow-up
from core email-code delivery.

### Service operations

A product-authorized operator can look up accounts, suspend/reactivate them,
revoke sessions, hold/release distribution of public collections, and inspect
an operator audit trail. This is service administration, separate from hub
ownership and reader/editor sharing. Operator access never grants private
collection reads, impersonation, credential editing or account deletion.

Suspension denies authentication and sharing of the account's owned content;
reactivation permits fresh sign-in and restores existing sharing except for
independent content holds. Holds preserve owner content/settings while denying
non-owner access to the held collection. Active owners can correct content; only
operators can release holds. Reasons and audit records accompany actions.

Startup emails the configured initial admin an invitation. New recipients enter
their name and accept before the account is created. Every recipient, including
someone already signed in, verifies a fresh email OTP before the role activates.
Only admins can invite/remove operators; recipients must accept and verify before receiving
a UUID-bound grant. No first-user, email-domain or SSO-claim shortcut confers
access. Verified email handover removes both service roles.
See [service operations](docs/design-docs/service-operations.md) for the complete
permission, recovery, retention and acceptance contract. The implementation
includes the reusable web sign-in/session flow and `/ops` pages.

## 5. Product Surfaces

```txt
API        The product authority (NestJS, /api/v1). Everything below consumes it.
Web        Full surface: explore, hubs, collections, sharing, saves, account.
Extension  Constrained capture companion (popup, context menu, shortcut).
```

The web app's [product experience](docs/design-docs/web-product-experience.md),
[interface system](docs/design-docs/web-interface-system.md), and
[design tokens](docs/design-docs/web-design-tokens.md) define the Track W3
implementation contract. These designs precede the web scaffold.

## 6. Acceptance Criteria (durable behaviors)

- Service operations deny suspended sessions and restrict held
  content across every read/list/export path. Operators gain no private-content
  access; actions and audit commit atomically. Recovery does not revive old
  sessions or service-role grants. Startup invites the initial admin; only admins
  invite operators. Acceptance begins from the emailed link, creates new accounts
  only on explicit consent, and grants no role until a fresh invitation-bound email
  OTP is verified. Matching signed-in accounts also verify. Sensitive actions
  require recent email-code verification; TOTP remains a later phase.
  See the service-operations contract above.
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
  unique handle derived from a supplied name, or a readable random handle when
  no usable name is supplied. Email addresses are not used as fallback seeds.
  The handle is mutable, but durable links use the
  immutable hub id, so a rename never breaks a saved reference.
- Reorder and update operations reject stale versions (409) rather than
  silently overwriting concurrent edits.
- Imported files that are malformed produce per-row errors, not partial
  silent corruption.
- Tags are normalized (lowercase, de-duplicated) string arrays stored directly
  on collections and resources; there is no shared tag table. An external
  resource stores its own canonical URL (one copy of a given URL per
  collection).
- References never inherit direct grants, share-link access or publication.
  Their destinations resolve through the same independent collection policy.
- An editor can add a reference to a readable collection from any hub, then
  tag, reorder or remove the reference without write access to the target.
- What belongs to an item stays as saved: a link's address and its resolved
  title, a reference's target, a heading's text. People change only what they
  add (tags, order; reference notes planned). A wrong link is removed and
  added again.
- Deleting a referenced target keeps a neutral unavailable resource in the source.
  Deleting or transferring a source never deletes or transfers its targets.
- Guides use ordered heading resources. Explicit export expansion is bounded
  and separately authorized, so cycles cannot recurse or expose private content.
- All identifiers exposed in routes are immutable UUIDv7 values; changing a
  username, hub name, or collection title never breaks a stored reference.

## 7. Out Of Scope (initial)

- Mobile applications.
- Resource-level saves, explore ranking beyond recency, vanity hub handles,
  sharing to unregistered emails, and full-text search across collections and
  resources — tracked in the hub design doc's deferred (Phase E) list.
- Billing or any commercial machinery.
- **Authored rich content / a document or course builder.** Collection content is
  a *description* plus headings and linked resources — never a block/rich-text editor,
  authored article prose, or hosted/uploaded media. Media is attached as a
  *resource* (a link to an unlisted YouTube or Vimeo video, a recording, etc.),
  not uploaded or authored in-product. A media-and-blocks course/document
  builder is a *different product*: it drags in an editor, object storage, and
  — decisively — organizations and teams, which the individual-scoped ns series
  deliberately excludes. NSLinkHub curates and references; it does not author
  or host. The line is "rich description," and it stops there.

## 8. W3 Presentation Decisions

- Explore ships the existing recency order in a readable list, with explicit
  cursor continuation. No popularity score, recommendations or single-option
  sort selector; richer ranking remains Phase E.
- Dormant saves keep their place with the saved-list title, saved date and
  “Currently unavailable” label. Opening/exporting is disabled, previews are
  suppressed, and removal remains available. Republish restores opening.
  This presentation does not create a historical snapshot or authorize a
  read of unavailable contents.

The [web experience](docs/design-docs/web-product-experience.md) owns the
detailed states; browser verification follows with the corresponding journey.
