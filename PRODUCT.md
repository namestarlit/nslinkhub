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
understands what a collection covers, then opens a useful resource. An owner
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

- **Everyday people** (the author is user zero): collect resources on topics
  they care about, organize them into collections, and share or publish the
  good ones. Usually saving one link at a time, in the middle of other work,
  often on a laptop. Everything in this document is for them, and free.
- **Professional curators** *(planned: Curator accounts)*: people for whom
  links are the work — educators and researchers managing a digital library of
  links, people running a link-heavy learning program or a community whose
  members get a guide of the best resources (today, a Google Doc sent to every
  new member), the person who keeps the community group supplied with links,
  and people gathering resources from the open web at scale (scraping,
  crawling, research datasets) who label them with tags, organize them in
  collections and add notes, through the API.
  They need analytics and engagement, members-only collections, bigger bulk
  work, link health and API access for integrations and their own data; they
  are who nslinkhub charges (ADR-0016).
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
to it (tags, order, and a note — planned). A wrong link is removed
and added again.

## 5. Journeys

These describe the product. Journeys marked *(API only today)* are built and
tested in the API but not yet in the web; §9 has the full picture.

### Save a first link (signed out)

The home page's main action is **Save your first link**. The person pastes one
or two links (tags optional), then verifies their email with an eight-digit
code; titles are looked up once the links are saved. Sending a code creates
nothing. Verifying signs them in, creating their account and hub if new, and
saves the links into a new private collection named with the date ("Saved links,
Oct 7"), atomically and safe to retry. No profile, title or handle setup is
needed first. **Sign in** on its own lands on the person's hub (`/hub` → their
permanent `/h/<hubId>`).

### Save a link (signed in)

**Save a link** is always in the header. The form takes one or two links: each
address turns blue when it is a valid public link and red when it isn't, and
shows the page's title once found. Tags are optional, added behind **Add tags**
and shown as pills. The person picks an existing collection (each shows when it
was last updated) or a new one, whose name is prefilled with a suggestion that
never repeats (typed names may repeat). Adding to a published collection is
always an explicit choice. Personal context about a link will be a separate
note (planned), never a rewritten title. Repeated links, non-addresses and
domains that don't exist are refused before saving; a real site with no title
is still saved. More than two links is bulk work: at two rows the form offers
**Bulk import links** (bulk import, §6).
The whole form fits a 14-inch laptop screen in at most eight actions.

### Read and organize a collection

A collection page shows its title, description, tags, owner and when it was
last updated, then its items in order. Missing titles are resolved whenever the
collection is opened. People who can edit see **Add a link** and **Edit** in the
header; editing changes the name, description, tags and whether comments are
on, in place. A share row offers LinkedIn, X, WhatsApp and **Share link**
(copies the permanent address and says "Link copied to clipboard").

*(Planned)* Like commits and contributors on GitHub, every change is recorded
as "who did what to which item", and attribution comes from those records: the
collection's metadata names its **creator** (who created it — distinct from the
owner, who owns the hub) and its **maintainers**, everyone who has shaped its
content ("Paul John and 2 maintainers"); each item's details say who added it
and when; owners and editors can open the collection's history.

### Preview and annotate a link *(planned)*

Hovering a link (or focusing it with the keyboard; on phones, a small details
button) shows a preview card, like a link card in Google Docs: title, domain,
site name and the page's description — what the resource is about. The card
is metadata only — no images, icons or thumbnails — so viewing a collection
never contacts the linked sites; the page itself is one click away.

The card has at most two actions. **View** (everyone who can read the
collection) opens the item's details in a dialog with its own address, which
also works without JavaScript. **Edit** (owner and editors) opens the item's
edit form: tags, the note, and removing the item. No row of separate
action buttons.

The **note** is a short piece of context (up to 280 characters) the
owner or an editor writes about a link — why it's here, what to look for. Every
reader sees it in full in the item's details; whether part of it also shows on
the card is decided once the screen is built. Signed-in
readers can **Add to my collection** from the details: Save a link opens with
the address filled in — a quick save into one of their own collections.

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
which hub published it. Signed-in readers can **follow** a hub *(planned)*, like
subscribing to a YouTube channel (the follow belongs to the hub and stays if
the hub changes hands): the hub joins their Following list, its new
published collections appear there, and they're notified when it publishes (each
followed hub has a notifications toggle, on by default). They can also **save**
a published collection to keep it *(API only today)*, like saving a document in
Google Drive; a save goes dormant if the collection is unpublished — it keeps
its place, labelled "Currently unavailable", cannot be opened or exported but
can be removed, and no snapshot is kept — and comes back when the collection is
republished.

Every collection can carry a **discussion**: questions or notes with one level
of replies, readable by anyone who can read the collection. Anyone signed in who
can read it can comment and reply, so help never waits on the maintainers;
signed-out readers are invited to sign in. Replies from the owner or an editor
are labelled Maintainer, and either can mark one reply per question as
the answer, shown first. Each question shows up to 100 replies, with **More
replies** to continue. Authors edit or delete their own comments (a question
with replies keeps a placeholder); the owner and editors can hide comments,
which stay visible to them. The owner can turn comments off, leaving existing
ones readable; a collection on hold takes no new comments. Comments never grant
access to anything.

### Your home *(planned)*

Your own hub page is your home, Google-Drive style: **My collections** (every
collection in your hub), **Shared with me**, **Saved** and **Following**. A
"View your public hub" link shows what visitors see: the hub's name, handle,
description, Follow, the share row and its published collections.

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

### Download and export *(API only today)*

Like File › Download in Google Docs, a signed-in reader can **Download** a
collection as a document: Word, Markdown or PDF. To export several collections
at once (one document each, in a zip), hub owners use **Import & export** in
Manage. The collection title and description lead, headings become sections, and
references stay links unless the reader asks to include readable referenced
collections one level deep — an expanded guide. Nothing is fetched from linked
pages and nothing is stored. Unavailable references get a generic notice that
reveals no title or content. Signed-out readers can only browse.

### Manage your hub and the service

**Manage**, in the account menu, is one workspace whose sections follow your
roles *(planned; today it is the service-operations console)*:

- **Every hub owner** manages their own hub: all collections as a table,
  comments across the hub (hide, show, mark answers), **Access** (requests
  to view or edit, every share, link-shared collections — like Google Drive's
  "Manage access"), **People** (followers and blocked accounts), **Import &
  export** (bulk import, exporting several collections), and the hub's
  activity — its audit trail. Signed-in people who can't open a collection can
  **Request access**; the request always reads "sent", so it never reveals
  whether a private collection exists. Owners block someone where that person
  appears (a comment, a follower, a request, a share) and unblock in People.
  Blocking stops taking part, never public reading: what is published is
  public to everyone.
- **Service operators** find an account by email or handle and restrict it
  (suspend, reactivate, sign out everywhere); look up a public collection by
  its link and hold or release it, or moderate its comments; and review the
  service audit. **Admins** also manage the operator team (invite, resend,
  revoke).

Sensitive service actions ask the operator to confirm it's them with a fresh
code. Operators never see private content, impersonate anyone, edit
credentials or delete accounts; owners manage only their own hub. Full
contracts: `docs/design-docs/manage-workspace.md` and
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
  bearer tokens. Single sign-on through the ns series' own centralized identity
  service (one account across ns products) is planned; authenticator-app codes
  and recovery codes are a later follow-up.
- Settings: full name, email and member-since; hub name, handle, description
  and permanent id; whether to show the name on the hub. Changes save as they
  are made. Appearance (system, light, dark) is a header control.
- Notifications currently cover invitations to service roles. Planned: one
  inbox for every kind that concerns you, scoped by role, with settings to turn
  kinds (and individual followed hubs) off; invitations and security notices
  stay on. Notifications are in-app; email is kept for codes, invitations,
  targeted shares and security notices.
- Account deletion (planned) is self-service with an email code, offers a
  download of everything first, and has a 14-day grace period; then the hub,
  its collections and the handle go, comments read "[deleted]" and activity
  keeps only an anonymous actor.

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
- A separate saved-items list: reusing someone's link is "Add to my
  collection" instead.
- Billing, until Curator accounts are built and priced
  (`docs/design-docs/monetization.md`).

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
| Link metadata, preview cards, notes | Planned | Planned |
| Following hubs, your home (My collections, Shared with me, Saved, Following) | Planned | Planned |
| Activity records, creator and maintainers, hub audit | Planned | Partial (management audit) |
| Manage for hub owners (collections, comments, people, blocking, import, activity) | Planned | Planned |
| Discover search and tag filters, full-text search | Planned | Planned |
| Notifications for every kind, notification settings | Planned | Planned |
| Single sign-on (ns-series identity service), account deletion | Planned | Planned |

Next, in order (everything is to be built; what to charge for is chosen after):

1. **Link metadata foundation** — durable background lookups (the worker
   queue), stored title, description and site name per link (text only; no
   images or icons are fetched or stored), and a shared fetch cache. Bulk
   import and preview cards both depend on it; it absorbs the first step of the
   [internals pass](docs/exec-plans/active/final-pass-internals.md).
2. **Activity and attribution** — every change recorded as an activity entry;
   creator, maintainers and "added by" shown; the hub audit
   ([attribution-and-activity](docs/design-docs/attribution-and-activity.md)).
3. **Manage** — the operations console becomes one workspace scoped by role,
   adding the hub-owner sections: collections, comments, people and blocking,
   activity ([manage-workspace](docs/design-docs/manage-workspace.md)).
4. **Bulk import**, inside Manage —
   [deliver-bulk-import](docs/exec-plans/active/deliver-bulk-import.md).
5. **Notifications** — one inbox for every kind (following, comments, saves
   and follows, sharing, invitations, imports, service), scoped by role, with
   per-kind and per-hub settings on the Notifications page
   ([notifications](docs/design-docs/notifications.md)).
6. **Your home and following** — My collections, Shared with me, Saved,
   Following; the public hub page with Follow
   ([hub-home-and-following](docs/design-docs/hub-home-and-following.md)).
7. **Preview cards, item details and notes** — View and Edit only,
   with Add to my collection in the details.
8. **Managing a collection in the web** — remove and reorder items, sections
   (headings) and references, sharing (Can view / Can edit, link sharing),
   publishing, transfer, export.
9. **Discover** — search by text and tags, tag filters, then full-text search
   across collections and items.
10. **Rest of the internals pass** — fewer queries, one write-lock opt-out per
    controller, the forms route as an action table, Save a link drafts in
    Redis, focus rings.
11. **Account** — email change in the web, account deletion with export and
   retention rules, optional authenticator-app codes.
12. **Browser extension** (W4) — capture into a chosen collection.
13. **Targeted sharing by invitation** — sharing a collection with a specific
    email address as Can view or Can edit sends an invitation; the share
    activates once that person verifies their email and has an account. As in
    Google Drive, anyone can read through link sharing or publishing without an
    account, but a targeted share needs an identity to authorize, so it needs
    an account.
14. **ns-series single sign-on** — a centralized identity service for all ns
    products (`docs/design-docs/identity-sso.md`); nslinkhub is its first
    consumer.
15. **Before public release** — live email provider and webhook acceptance,
    browser and worker telemetry, deployment
    (`docs/design-docs/infra-deployment.md`).
16. **Curator accounts** — the professional account people opt into, like a
    business account on Instagram: analytics and engagement, members-only
    collections, bigger bulk work, link health, API access (keys for
    integrations and data), a curator profile; then
    pricing (ADR-0016, `docs/design-docs/monetization.md`).

## 10. Open decisions

- **Curator account details** — what exactly it includes and costs, decided
  after everything else is built; the direction (charge professional curators,
  keep everyone's library free) is settled in ADR-0016. Analytics will need a
  privacy decision: aggregate counts, never tracking individual readers.

Settled since this list was written: role names stay `reader`/`editor` with
labels chosen per surface (ADR-0013); imports resolve titles through reviewed
drafts (ADR-0012, design in `docs/design-docs/bulk-import.md`); link metadata,
preview cards and notes are the chosen direction (§5); one Manage
workspace scoped by role (ADR-0014); attribution and the hub audit come from
activity records (ADR-0015); following works like YouTube subscriptions and
saved collections like saved Drive documents; following notifies by default
with a per-hub toggle; blocking only stops taking part, never public reading;
everyone who shapes a collection is a maintainer (Curator is the professional
account, ADR-0016); sections are added and assigned
in the collection's edit view; preview cards show the page description, with
the note (up to 280 characters) in full in the details; notifications
stay in-app apart from codes, invitations, targeted shares and security; all
three download formats; account deletion with a 14-day grace period; bulk
import limits of 1,000 links, 10 MB, 3 open drafts and 30 days; popular tags from
published collections over 90 days, no date-range filter; access requests
and shares live in Manage › Access, blocking happens in context with People
holding followers and blocked accounts, and follows belong to the hub. Details live in the
design docs.
