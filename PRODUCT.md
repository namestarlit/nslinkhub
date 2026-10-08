# Product Definition

NSLinkHub's canonical product definition (the PRD), written to be understood
without the conversations behind it. Where this document and older material
conflict, this document wins on what the product is and must do;
`ARCHITECTURE.md` and `docs/design-docs/` say how it is built, `DESIGN.md` how
it looks. Settled foundations are recorded in `docs/engineering-decisions/`.

NSLinkHub is an ns-series product: a personal project under the namestarlit
brand, built to solve its author's own problem and published for others. It has
no company affiliation, and nothing here is deployed yet (see §9).

## Register

product

## Product design context

### Users and working context

A reader arrives through a link or discovers recently updated collections,
understands what a collection covers, then opens a useful resource. A curator
returns to their own hub to save links one at a time, in the middle of other
work, and to share one durable address. A collaborator reads or edits one
specific collection; they never join a hub. Typical scene: someone opens a
colleague's collection on a phone beside a bright window, scans several links,
then continues on a laptop.

### Brand personality

Calm, legible and trustworthy — a dependable personal library. Lowercase
`nslinkhub`, a personal ns-series product under the namestarlit brand.

### Anti-references

- Bookmark dumps: unordered, untitled lists that go stale.
- Invented engagement: counts, decorative covers, recommendations or social
  proof that the data doesn't support.
- Document or course builders with rich editors and uploaded media.
- Cramped, compact forms that save space by dropping labels or crowding fields.
- Team workspaces, organization switchers and admin consoles in the product.

### Product design principles

1. Reading earns the most space; titles and destinations are always clear.
2. People type only what they must; the product resolves the rest.
3. UX over compactness: show fewer items rather than crowd a layout.
4. Copy scans at a glance: short paragraphs, emphasis in bold, the reason
   before the action.
5. Every journey works without JavaScript; hidden controls never stand in
   for permissions.

### Accessibility and inclusion

- WCAG 2.2 AA: keyboard operation, focus visible for keyboard users, reduced
  motion, zoom and reflow, non-color status cues, verified contrast in light
  and dark themes.
- Readable on a phone in daylight and a laptop in the evening (Light, Dark,
  System).
- Labels stay visible; user content wraps rather than overflowing.

## 1. Product overview

NSLinkHub turns the links people collect into **collections**: ordered,
shareable guides with one stable address. A collection can be read by anyone it
is shared with, published for anyone to discover, discussed, and exported.

```txt
Hub (one per person) → Collections → Items (links, headings, references)
```

The north star is **collections as guides, references embedded once**. Instead
of re-sending the same ten links in a chat, or losing them in browser
bookmarks, a person keeps one living collection and shares its address; when
the collection improves, everyone who has the address sees the improvement.

## 2. Problem and goals

**The problem.** Useful links end up scattered across bookmarks, notes and chat
history. Bookmarks are private, unordered and go stale; sending links one by one
loses their order and context, and every update means sending them again.

**Goals.**

- Saving a link takes seconds and as few inputs as possible.
- A set of links becomes an ordered guide, with headings to group it and
  references to other collections, without becoming a document editor.
- Sharing is one stable address, with access controlled per collection, the way
  Google Drive shares a file.
- What is shared stays current: readers always see the latest version.
- The best collections can be published, discovered, discussed and kept.
- Collections can leave the product as Markdown, PDF or Word documents.

## 3. Users and working context

- **The curator** (primary; the author is user zero): collects resources on
  topics they care about, organizes them into collections, and shares or
  publishes the good ones. Usually saving one link at a time, in the middle of
  other work, often on a laptop.
- **The recipient**: is sent a collection's address or shared it directly. Reads
  without an account; with one, finds it again under what's shared with them.
- **The collaborator**: a specific person the owner grants `editor` on one
  collection. They edit that collection's content from their own hub; nothing
  else of the owner's is visible to them.
- **The discoverer**: browses published collections, reads, joins the
  discussion and saves the ones worth keeping.
- **The service operator**: a separately invited person who keeps the service
  healthy (account restrictions, public-content holds) without any access to
  private content.

## 4. Core concepts

- **Hub** — each person's one personal space (one hub per user, like a Google
  Drive), created when they first sign in. It has a public **name**, an optional
  **description** and a unique, changeable **handle** (`@handle`), all
  independent of the owner's own name and email. Its permanent identity is an
  immutable id, so renaming the handle breaks no link; a hub resolves by id or
  handle. Nobody joins anyone else's hub: there are no memberships or hub roles.
- **Collection** — an independent container with a title, description, tags,
  sharing, publication and discussion. Collections never nest; one collection
  can only *reference* another.
- **Item** (a *resource* in the API) — an ordered entry in a collection. Its kind
  is decided by how it was added, never by inspecting a URL:
  - **Link**: a public web address. Its title is resolved from the page and is
    never typed.
  - **Collection reference**: points to another collection by its permanent id,
    possibly in another person's hub. Whoever adds it must be able to read the
    target; references can be reused and may form cycles. It grants no access:
    each reader sees the target only if they could open it anyway; otherwise
    they see a neutral "unavailable" entry, without its title. Reading,
    sharing, publishing, transferring or deleting the source never grants
    access to or changes the target. Pasting a collection's address creates an
    ordinary link, never a reference: there is no URL auto-detection.
  - **Heading**: a text label that groups the items below it into a section,
    without creating a separate collection or permission boundary.

  Items have no summary field: titles and tags make them clear.
- **Tags** — optional labels on a collection or an item (`video`, `free`,
  `must-read`) that make an item clear at a glance. They are normalized when
  saved (lowercase, de-duplicated, capped) and stored on the item itself as a
  plain list, set as part of creating or editing it. Deliberately not a global
  entity: no shared tag table, no "everything tagged X" view, no autocomplete
  pool, no hierarchies. Finding things across a library is a future full-text
  search feature covering titles, tags and text together.

**What belongs to an item stays as saved**: a link's address and its resolved
title, a reference's target, a heading's text. People change only what they add
to it (tags, order; personal notes are planned). A wrong link is removed and
added again.

## 5. Journeys

These describe the product. Journeys marked *(API only today)* are built and
tested in the API but not yet in the web; §9 has the full picture.

### Save a first link (signed out)

The home page's main action is **Save your first link**. The person pastes one
or two links (tags optional), then verifies their email with an eight-digit
code; titles are looked up once the links are saved. Sending a code creates nothing. Verifying signs
them in, creating their account and hub if new, and saves the links into a new
private collection named with the date ("Saved links, Oct 7"), atomically and
safe to retry. No profile, title or handle setup is needed first. **Sign in**
on its own lands on the person's hub (`/hub` → their permanent `/h/<hubId>`).

### Save a link (signed in)

**Save a link** is always in the header. The form takes one or two links: each
address turns blue when it is a valid public link and red when it isn't, and
shows the page's title once found. Tags are optional, added behind **Add tags**
and shown as pills. The person picks an existing collection (each shows when it
was last updated) or a new one, whose name is prefilled with a suggestion that
never repeats (typed names may repeat). Adding to a published collection is
always an explicit choice. Personal context about a link will be a separate
note (planned), never a rewritten title. Repeated links, non-addresses and domains that don't exist are
refused before saving; a real site with no title is still saved. More than two
links is bulk work: at two rows the form offers **Bulk import links** (see §8).
The whole form fits a 14-inch laptop screen in at most eight actions.

### Read and organize a collection

A collection page shows its title, description, tags, owner and when it was
last updated, then its items in order. Missing titles are resolved whenever the
collection is opened. People who can edit see **Add a link** and **Edit** in the
header; editing changes the name, description, tags and whether comments are
on, in place. A share row offers LinkedIn, X, WhatsApp and **Share link**
(copies the permanent address and says "Link copied to clipboard").

### Share and collaborate *(API only today)*

Three independent ways to give access to one collection; each applies to that
collection only:

- **Link sharing**: anyone with the link can read; the owner can rotate or turn
  the link off, cutting off link-based access immediately. Signed-in people who
  open it find the collection under what's shared with them while the link
  stays on.
- **Direct sharing** to an account by email as `reader` (the default) or
  `editor`, independent of the link and individually revocable; it also lands
  in the recipient's shared list. Editors change content only (items, tags,
  imports) from their own hub and can never publish, share, delete or see
  anything else in the owner's hub. This is the only collaboration mechanism.
- **Publishing**: the collection appears on Discover and the hub's public page.
  Referenced collections need their own publication or shares.

A collection can also be **transferred** to one of its editors: only that
collection moves to their hub, its references are untouched, the previous
owner becomes an editor, and the original creator is kept on record. Handing
over a whole hub is done by changing the account's email, because a hub
belongs to exactly one account: the current address confirms by code (it sees
the new address, and ignoring it changes nothing), the new address verifies by
code, then every session is signed out and the account continues under the new
email.

### Discover, discuss and keep

**Discover** lists published collections, newest first, continuing page by page
(no popularity score, recommendations or sort options yet). Opening one shows
which hub published it, so readers can follow that hub. Signed-in readers can
**save** a published collection to keep it *(API only today)*; a save goes
dormant if the collection is unpublished — it keeps its place, labelled
"Currently unavailable", cannot be opened or exported but can be removed, and
no snapshot is kept — and comes back when the collection is republished.

Every collection can carry a **discussion**: questions or notes with one level
of replies, readable by anyone who can read the collection. Anyone signed in who
can read it can comment and reply, so help never waits on the curator;
signed-out readers are invited to sign in. Replies from the owner or an editor
are labelled Curator, and either can mark one reply per question as
the answer, shown first. Each question shows up to 100 replies, with **More
replies** to continue. Authors edit or delete their own comments (a question
with replies keeps a placeholder); the owner and editors can hide comments,
which stay visible to them. The owner can turn comments off, leaving existing
ones readable; a collection on hold takes no new comments. Comments never grant
access to anything.

### Verify email, wherever it's needed

Every situation that sends a code uses the same two screens, worded for the
purpose: signing in; saving a first link; signing in to do something ("Sign in
to join the discussion."); a session that ended mid-action ("Your session ended
before we could post your comment."); confirming a sensitive action ("Confirm
it's you"); accepting an invitation. A known address is shown, never asked for
again, and nothing is emailed until the person chooses **Send code**. Codes
pasted with spaces or dashes work. An action interrupted by sign-in or
confirmation continues by itself afterwards, and only for the person it
belongs to.

### Export *(API only today)*

Signed-in readers export one or more collections as Markdown, PDF or Word
(several at once arrive as a zip). The collection title and description lead,
headings become sections, and references stay links unless the reader asks to
include readable referenced collections one level deep. Nothing is fetched from
linked pages and nothing is stored. Unavailable references get a generic
notice that reveals no title or content. Signed-out readers can only browse.

### Run the service

Service operators work under **Operations**: find an account by email or
handle and restrict it (suspend, reactivate, sign out everywhere); look up a
public collection by its link and hold or release it; review the audit trail.
Admins manage the operator team from a table (invite, resend, revoke).
Sensitive actions ask the operator to confirm it's them with a fresh code.
Operators never see private content, impersonate anyone, edit credentials or
delete accounts. The full contract (permissions, recovery, retention) is in
`docs/design-docs/service-operations.md`.

## 6. Product requirements

### Capture and organize

- Save a link takes 1–2 public links per save, each with optional tags, into one
  chosen collection.
- Saved links must open for everyone they are shared with: localhost, loopback
  and IP addresses, local/internal names and names reserved for examples and
  testing (`example.com`, `.test`, `.invalid`, …) are refused.
- Every link's title comes from its page (`og:title`/`<title>`, or YouTube's
  oEmbed), looked up by the server with a short deadline. If no title is found,
  the address stands in for it. Nothing else from the page is stored.
- Addresses are canonical (lowercase scheme and host, normalized path, sorted
  query, tracking parameters such as `utm_*`, `fbclid`, `gclid` removed), so the
  same link saved twice is one item per collection.
- Items are ordered; reordering and edits use version checks, so a stale edit
  is rejected rather than silently overwriting someone else's.
- Bulk import is Save a link at scale (being built; today the API imports in
  one shot): a browser bookmarks file, one documented CSV layout (`url`,
  optional `tags`, optional `folder`) or a pasted list becomes a draft to review
  before anything lands. Titles resolve from the pages like any save (source
  titles are ignored); each row shows Ready, Failed with a reason, Duplicate or
  Already saved; failed rows are fixed in place, revalidated or dropped.
  Folders become sections of one collection or split into separate
  collections, chosen per folder. Ready rows import while the rest wait in the
  draft. No source-specific parsers beyond bookmarks HTML.
- The browser extension (planned) captures the current tab into a chosen
  collection.

### Access and privacy

- Access to a collection is decided per collection, strongest first: hub owner →
  direct share (reader/editor) → active share link → published. Anything else
  is "not found", so private collections can't be probed.
- Managing a collection (publish, share, delete, rename, settings) is
  owner-only.
- References, discussion and exports each authorize their own targets; none of
  them widens access.
- Email addresses are never shown publicly. The owner's name appears on their
  public hub only if they choose to show it.

### Account

- Sign-in is passwordless: email, then an eight-digit emailed code. Sign-in
  emails carry codes only, never sign-in links. There are no passwords and no
  usernames. Browsers use cookie sessions; API clients and the extension use
  bearer tokens. "Continue with namestarlit" single sign-on is planned for the
  ns series; authenticator-app codes and recovery codes are a later follow-up.
- Settings: full name, email and member-since; hub name, handle, description
  and permanent id; whether to show the name on the hub. Changes save as they
  are made. Appearance (system, light, dark) is a header control.
- Notifications currently cover invitations to service roles.

### Service operations

- Operator and admin roles are granted only by invitation. The first admin is
  invited by email at startup; only admins invite or remove operators. A new
  recipient enters their name and accepts before any account is created, and
  every recipient — including someone already signed in — verifies a fresh
  email code before the role activates. No first-user, email-domain or
  single-sign-on shortcut grants a role, and changing the account's email
  removes both service roles.
- Suspension blocks the account's sign-in and others' access to its content;
  reactivation allows a fresh sign-in and restores existing sharing, except
  where a collection is held. A hold keeps a public collection available to its
  active owner for correction but hidden from everyone else; only operators
  release holds.
- Every operator action carries a reason and is audited together with its
  effect.

## 7. Acceptance criteria

- An unpublished collection is invisible to strangers: not on Discover, not on
  the hub page, "not found" to direct requests.
- A share-link reader can read but never write; rotating or disabling the link
  cuts off link-based access immediately.
- A direct-share editor can change items, tags and imports in that one
  collection, and cannot publish, manage sharing, delete it or see anything
  else in the hub.
- Saving a collection requires it to be published; the save survives
  unpublishing (dormant) and comes back on republish.
- Each person owns exactly one hub, created at first sign-in with a unique handle
  derived from their name, or a readable random one; never from their email.
  Durable links use permanent ids, so renaming a handle, hub or collection
  breaks nothing.
- Tags are normalized (lowercase, de-duplicated) lists stored on collections
  and items, with no shared tag table. A link keeps one canonical address, at
  most once per collection.
- Guides use ordered heading items.
- Stale reorders and edits are rejected (409) instead of overwriting concurrent
  changes.
- Malformed import rows produce per-row errors, never silent partial
  corruption.
- A link's title is never an input when saving or editing; its address, title,
  target or heading text never changes after saving.
- References never inherit direct shares, link access or publication. An editor
  can reference any collection they can read, then tag, reorder or remove the
  reference without access to its target. Deleting the target leaves a neutral
  unavailable entry; deleting or transferring a source never affects its targets.
- Export expansion is one level deep and separately authorized, so cycles can't
  recurse and private content can't leak.
- Verification sends nothing until the person chooses to; an interrupted action
  continues after verification only for the account it belongs to.
- Suspended sessions are denied and held content is restricted on every read,
  list and export path. Operators gain no private-content access; actions and
  their audit commit together; recovery never revives old sessions or role
  grants. Invitation acceptance starts from the emailed link, creates an
  account only with explicit consent, and grants no role until a fresh,
  invitation-bound email code is verified. Sensitive actions need a recent
  email code.

## 8. Outside initial scope

- Mobile apps.
- Authored rich content, a document or course builder, and uploaded or hosted
  media. A collection is a description plus headings and links; media is linked
  (an unlisted video, a recording), never uploaded. A course builder would need
  an editor, storage and teams, which the individual-scoped ns series
  deliberately excludes.
- Organizations, teams and shared workspaces. Collaboration stays per
  collection.
- Item-level saves, explore ranking beyond recency, vanity handles, sharing to
  people without an account, and full-text search (deferred, see §10).
- Billing. Monetization ideas (`docs/design-docs/monetization.md`) are notes
  under review, not decisions.

## 9. Current state

Nothing is deployed; everything below runs and is verified locally. The API
(NestJS, `/api/v1`) is the product authority; the web is the full surface; the
browser extension will be a narrow capture companion. The web's journeys,
interface and tokens are specified in `docs/design-docs/web-product-experience.md`,
and `web-interface-system.md`; the visual system is `DESIGN.md`.

| Capability | Web | API |
| --- | --- | --- |
| Discover, hub pages, collection reading (links, headings, references) | Built | Built |
| First link and Save a link (1–2 links, tags, live validation, titles) | Built | Built |
| Collection details (name, description, tags, comments on/off) | Built | Built |
| Discussion (comment, reply, answer, hide) | Built | Built |
| Email verification (all purposes, resume, confirm) | Built | Built |
| Settings, appearance, invitation notifications | Built | Built |
| Service operations (accounts, collections, team, audit) | Built | Built |
| Removing and reordering items, adding headings and references | Not yet | Built |
| Sharing (link, direct), publishing, transfer | Not yet | Built |
| Saves (saved collections), shared-with-me lists | Not yet | Built |
| Export, import | Not yet | Built |
| Email change (account handover) | Not yet | Built |
| Browser extension | Planned | Uses existing API |
| Search, single sign-on, account deletion | Planned | Planned |

Next:

- **Internals pass** — [final-pass-internals](docs/exec-plans/active/final-pass-internals.md).
- **W3, remaining journeys** — item management (remove, reorder, sections with
  headings and references), sharing/publishing/transfer, saved and shared
  lists, export, the web import page, email change, richer link details and
  notes.
- **W4 — Browser extension.** `apps/extension` (MV3) capture companion.
- **Before public release** — live email provider and webhook acceptance,
  browser and worker telemetry, deployment (`docs/design-docs/infra-deployment.md`).
- **Phase E (deferred)** — "Continue with namestarlit" SSO; Discover search by
  tags and text and full-text search; pending shares for people without an
  account; item-level saves; account deletion with export and retention rules.

## 10. Open decisions

- **Sections in the web.** How people add headings and place links under them.
- **Richer link details and notes.** More page metadata to tell similar links
  apart, and personal notes on an item.
- **Requesting access** to a collection someone can't open.
- **Account deletion** with export, and its retention rules.
- **Monetization**, per the notes under review, including whether bulk import
  is a paid feature.

Settled since this list was written: role names stay `reader`/`editor` with
labels chosen per surface (ADR-0013); imports resolve titles through reviewed
drafts (ADR-0012, design in `docs/design-docs/bulk-import.md`).
