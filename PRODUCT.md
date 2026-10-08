# Product Definition

NSLinkHub's canonical product definition (the PRD), written to be understood
without the conversations behind it. Where this document and older material
conflict, this document wins on what the product is and must do;
`ARCHITECTURE.md` and `docs/design-docs/` say how it is built, `DESIGN.md` how
it looks, and `docs/engineering-decisions/` records the settled foundations.

## Register

product

## Product Design Context

### Users And Working Context

A reader arrives through a link or discovers recently updated collections,
understands what a collection covers, then opens a useful resource. An owner
returns to their own hub to save links one at a time, in the middle of other
work, and to share one durable address. A contributor reads or edits one
specific collection; they never join a hub. Typical scene: someone opens a
colleague's collection on a phone beside a bright window, scans several links,
then continues on a laptop.

### Brand Personality

Calm, legible and trustworthy — a dependable personal library. Lowercase
`nslinkhub`, a personal ns-series product under the namestarlit brand.

### Anti-References

- Bookmark dumps: unordered, untitled lists that go stale.
- Invented engagement: counts, decorative covers, recommendations or social
  proof that the data doesn't support.
- Document or course builders with rich editors and uploaded media.
- Cramped, compact forms that save space by dropping labels or crowding fields.
- Team workspaces and organization switchers.

### Product Design Principles

1. Reading earns the most space; titles and destinations are always clear.
2. People type only what they must; the product resolves the rest.
3. UX over compactness: show fewer items rather than crowd a layout.
4. Copy scans at a glance: short paragraphs, emphasis in bold, the reason
   before the action.
5. Every journey works without JavaScript; hidden controls never stand in
   for permissions.

### Accessibility And Inclusion

- WCAG 2.2 AA: keyboard operation, focus visible for keyboard users, reduced
  motion, zoom and reflow, non-color status cues, verified contrast in light
  and dark themes.
- Readable on a phone in daylight and a laptop in the evening (Light, Dark,
  System).
- Labels stay visible; user content wraps rather than overflowing.

## 1. Product Overview

NSLinkHub turns the links people collect into **collections**: ordered,
shareable guides with one stable address. A collection can be read by anyone it
is shared with, published for anyone to discover, followed, discussed, and
downloaded as a document.

```txt
Hub (one per person) → Collections → Items (links, sections, references)
```

The problem it solves: useful links end up scattered across bookmarks, notes
and chat history. Bookmarks are private, unordered and go stale; sending links
one by one loses their order and context, and every update means sending them
again. Instead, a person keeps one living collection and shares its address;
when the collection improves, everyone who has the address sees the
improvement.

NSLinkHub serves two audiences:

- **Everyone** gets a complete personal library for free: save, organize,
  share, publish, follow and discuss.
- **Professional curators** — people for whom links are the work — opt into a
  paid **Curator account** with the tools that work needs (§6.13).

NSLinkHub is an ns-series product: a personal project under the namestarlit
brand, built to solve its author's own problem and published for others. It has
no company affiliation, and nothing is deployed yet (§11).

## 2. Product Goals

- Saving a link takes seconds and as few inputs as possible.
- A set of links becomes an ordered guide, with sections and references to
  other collections, without becoming a document editor.
- Sharing is one stable address, with access controlled per collection, the way
  Google Drive shares a file.
- What is shared stays current: readers always see the latest version.
- The best collections can be published, discovered, followed, discussed and
  kept.
- Collections can leave the product as Word, Markdown or PDF documents.

### Guides North Star

**Collections as guides, references embedded once.** A collection is more than
a list: it has order, sections, context (notes, discussion) and references to
other collections, so it reads like a guide someone maintains. Every feature
should make a collection more useful to follow, or easier to keep current.

### Free Library, Paid Curator Accounts

Everything an everyday person needs stays free, so collections spread through
readers, followers and shares. NSLinkHub charges professional curators, who get
professional value: analytics, members-only collections, bulk work at their
scale, link health, API access and AI curation (ADR-0016). Nothing free today
moves behind the Curator account.

## 3. Target Users

### Everyday Owner

Anyone with a hub (the author is user zero). Collects resources on topics they
care about, usually one link at a time in the middle of other work, often on a
laptop.

Needs:

- Save a link quickly into the right collection.
- Organize collections into guides and keep them current.
- Share or publish the good ones; manage who has access.
- Find again what they saved, shared with them, or followed.

### Contributor

Someone the owner granted Can edit on one collection (role `editor`). Works on
that collection from their own hub, without joining anything.

Needs:

- Add, organize, annotate and remove items in that collection.
- Moderate its discussion.
- See nothing else of the owner's hub.

### Reader

Opens a collection someone sent, shared or published — with or without an
account — and discovers more through Discover and hubs they follow.

Needs:

- Understand what a collection covers and open the right resource.
- Ask questions and get answers in the discussion.
- Follow hubs, save collections, and find them again later.

### Professional Curator

People for whom links are the work: educators and researchers managing a
digital library of links; people running a link-heavy learning program or a
community whose members get a guide of the best resources (today, a Google Doc
sent to every new member); the person who keeps a community group supplied
with links; people gathering resources from the open web at scale (scraping,
crawling, research datasets).

Needs (planned, through a Curator account):

- See how their collections are used: views, link clicks, saves, follows.
- Give members-only access to their best collections.
- Bring in and keep large libraries healthy: bulk work at scale, dead-link
  alerts, AI curation.
- Integrate through the API, with rate limits that fit their work.

### Service Operator And Admin

Separately invited people who keep the service healthy: account restrictions,
holds on public content, the operator team and the service audit. They never
see private content.

## 4. Success Measures

Proposed signals, not targets; there is no usage data yet, and none is
invented here.

- A first link is saved in the first visit.
- People return to collections shared with them (returning readers).
- Collections get shared, published and followed.
- Owners keep collections current (items added or changed after the first
  week).
- Professional curators would pay for the Curator account (validated with a
  few hand-picked curators before self-serve).

## 5. Hubs, Ownership And Access

### Hub Model

A **person** (the account) has an **@username** and a name. Their **hub** is
their publishing space — like My Drive in a Google account, or a channel on
YouTube — with its own **name**, optional **description** and **@handle**
(ADR-0018). A person has at most one hub, created when they first save a link
or start a collection; someone who only reads or contributes by invitation
needs none. The hub owns every collection in it and its subscribers, and is the
face wherever those appear: its page reads "Hub name" over "@handle", or
"@handle by Owner Name" when the owner shows their name. People act as
themselves — commenting, contributing, invited by email — and appear by
@username. Usernames and handles share one namespace. Permanent identities are
immutable ids, so renaming breaks no link. A hub is never transferred (its
owner's fingerprint); collections are. Others **subscribe** to hubs; people
aren't followed. No memberships or organizations (ADR-0017, rejected).

### Collections And Items

A **collection** is an independent container with a title, description, tags,
sharing, publication and discussion. Collections never nest; one collection
can only *reference* another. Its **items** are ordered; an item's kind is
decided by how it was added, never by inspecting a URL:

- **Link**: a public web address. Its title comes from the page and is never
  typed.
- **Section** (a heading): a text label that groups the items below it,
  without creating a separate collection or permission boundary.
- **Collection reference**: points to another collection by its permanent id,
  possibly in another person's hub. Whoever adds it must be able to read the
  target; references can be reused and may form cycles. It grants no access:
  readers who couldn't open the target anyway see a neutral "unavailable"
  entry, without its title. Pasting a collection's address creates an
  ordinary link, never a reference.

**Tags** are optional labels on a collection or item (`video`, `free`,
`must-read`), normalized when saved (lowercase, de-duplicated, capped) and
stored on the item as a plain list — no shared tag table, no autocomplete
pool, no hierarchies.

**What belongs to an item stays as saved**: a link's address and its title, a
reference's target, a section's text. People change only what they add to it
(tags, order, section, note). A wrong link is removed and added again.

### Roles

Roles come in two separate scopes (ADR-0013):

| Role | Scope | Can |
| --- | --- | --- |
| Owner | Their hub and every collection in it | Everything |
| Contributor — "Can contribute" | One collection | Change its content; never publish, share or delete |
| Viewer — "Can view" | One collection | Read |
| Operator, Admin | The service (`/platform`) | Run the service; never read private content |

Contributors and viewers are a collection's **collaborators**, invited by name;
unlike a share link, their access can't be forwarded. *(The roles are renamed
from editor and reader in the next slice.)*

Per collection, everyone who can change its content is a **contributor** (the discussion
badge, attribution). The collection's **creator** is a record of who created
it, kept through transfers, never a role. "Curator" names the professional
account type, not a role.

### Backend Authority

The API decides every rule, permission and derived state; the web and the
browser extension are replaceable surfaces, and hidden controls are never a
permission. Access to a collection resolves per collection, strongest first:
owner → direct share → active share link → published. Anything else is "not
found", so private collections can't be probed.

## 6. Core Functional Modules

Status per module: **Built** (web and API), **API only** (built and tested in
the API, no web screens yet), or **Planned**.

### 6.1 Saving Links

Purpose: get a link into the right collection in seconds. Status: Built.

- **First link (signed out):** the home page's main action is **Save your
  first link**. The person pastes one or two links (tags optional), then
  verifies their email with an eight-digit code — it is sign in plus add the
  link. Sending a code creates nothing; verifying signs them in (creating the
  account if new) and saves the links: with no hub yet, the hub is created on
  the spot with a new private collection named with the date ("Saved links,
  7 Oct"); with a hub that has collections, they choose where the links go.
  Existing accounts are never turned away. Saving is atomic and safe to retry;
  no profile, title or handle setup comes first. **Sign in** on its own creates
  the account only — no hub until the first saved link or collection
  (ADR-0018).
- **Save a link (signed in):** always in the header. One or two links per save;
  each address turns blue when it is a valid public link and red when it isn't,
  and shows the page's title once found. Tags are optional, behind **Add
  tags**, shown as pills. The destination is an existing collection (each shows
  when it was last updated) or a new one, prefilled with a name that never
  repeats; adding to a published collection is always an explicit choice.
  Repeats, non-addresses and domains that don't exist are refused before
  saving; a real site with no title is still saved. The form fits a 14-inch
  laptop screen in at most eight actions; more than two links is bulk work
  (**Bulk import links**, §6.2).
- Saved links must open for everyone they're shared with: localhost, loopback
  and IP addresses, local/internal names and names reserved for examples and
  testing (`example.com`, `.test`, `.invalid`, …) are refused.
- Addresses are canonical (lowercase scheme and host, normalized path, sorted
  query, tracking parameters such as `utm_*`, `fbclid`, `gclid` removed), so the
  same link is one item per collection.
- **Add to my collection** *(planned)*: from a link's details, Save a link opens
  with the address filled in — a quick save into one of your collections.
- The browser extension *(planned)* saves the current tab into a chosen
  collection.

### 6.2 Bulk Import

Purpose: bring an existing library in, reviewed before it lands — Save a link
at scale. Status: Planned (today the API imports in one shot);
design: `docs/design-docs/bulk-import.md`, ADR-0012.

- Sources: a browser bookmarks file, one documented CSV layout (`url`,
  optional `tags`, optional `folder`), or a pasted list. Only the link and its
  destination are needed; a title in the file is a hint for human readers and is
  ignored — everything about the page is fetched from the link.
- Everything becomes a **draft** first. Titles resolve from the pages like any
  save (source titles are ignored); each row shows Ready, Failed with a reason,
  Duplicate or Already saved, with a summary and filters.
- Failed rows are fixed in place (re-checked), revalidated or dropped.
- Folders become sections of one collection, or split into separate
  collections chosen per folder (new, existing, section of the parent, or
  skip).
- **Import N ready links** commits the ready rows; the rest wait in the draft
  until fixed or dropped.
- Limits: 1,000 links and 10 MB per draft, 3 open drafts, 30-day expiry.
- Lives in Manage › Import & export (§6.9).

### 6.3 Collections And Guides

Purpose: read and keep a collection current as a guide. Status: reading,
details and attribution Built; organizing items API only.

- A collection page shows its title, description, tags, owner and last update,
  then its items in order. Missing titles are resolved when it is opened.
- Contributors see **Add a link** and **Edit** in the header. Editing changes the
  name, description, tags and whether comments are on, in place.
- A share row offers LinkedIn, X, WhatsApp and **Share link** ("Link copied to
  clipboard").
- **Sections** *(planned in the web)*: **Add section** in the edit view; a
  link's edit form moves it into a section; items reorder by drag, with Move up
  and Move down for keyboard users. Save a link can target "Collection ›
  Section".
- Reorders and edits use version checks; a stale edit is rejected, never
  silently overwritten.
- **Attribution** (ADR-0015): like commits and contributors on
  GitHub, every change is recorded as "who did what to which item". The
  collection shows its **creator** and its **contributors** ("Paul John and 2
  contributors"); each item says who added it and when; contributors can open
  the collection's history.

### 6.4 Link Previews And Notes

Purpose: tell similar links apart and give them context, without leaving the
collection. Status: link metadata Built (the worker looks it up; the web shows
titles); preview cards and notes Planned.

- **Link metadata:** each link stores its title, description and site name,
  looked up in the background. Text only: no images or icons are fetched or
  stored, so viewing a collection never contacts the linked sites.
- **Preview card:** hovering a link (or focusing it; on phones, a details
  button) shows the title, domain, site name and the page's description — what
  the resource is about, like a link card in Google Docs.
- The card has at most two actions: **View** (anyone who can read) opens the
  item's details, which have their own address and work without JavaScript;
  **Edit** (contributors) opens the item's edit form — tags, note, section,
  remove.
- **Note:** up to 280 characters of context a contributor writes about a link —
  why it's here, what to look for. Readers see it in full in the details;
  whether part of it shows on the card is decided once the screen is built.

### 6.5 Sharing And Access

Purpose: give exactly the right people access to one collection. Status: API
only; access requests and targeted invitations Planned.

- **Link sharing:** anyone with the link can read; the owner can rotate or turn
  it off, cutting off link-based access immediately. Signed-in people who open
  it find the collection under Shared with me while the link stays on.
- **Direct sharing:** to an account by email as Can view (default) or Can edit,
  independent of the link and individually revocable. This is the only
  collaboration mechanism.
- **Targeted sharing by invitation** *(planned)*: sharing with an email address
  that has no account sends an invitation; the share activates once the person
  verifies their email and has an account. Reading without an account works
  through link sharing and publishing, as in Google Drive; a targeted share
  needs an identity to authorize.
- **Publishing:** the collection appears on Discover and its hub's public page.
  Publication, like every grant, applies only to that collection; referenced
  collections need their own.
- **Request access** *(planned)*: signed-in people who can't open a collection
  can ask for Can view or Can edit; the owner answers in Manage › Access. The
  request always reads "sent", so it never reveals whether a private
  collection exists.
- **Transfer:** a collection moves to one of its editors' hubs; references are
  untouched, the previous owner becomes an editor, the creator stays on
  record. Handing over a whole hub is adding the new person as its owner and
  leaving (hub membership, §5); a person's own access never moves with it.

### 6.6 Discover, Following And Your Home

Purpose: find good collections and come back to them. Status: Discover Built;
saves API only; following and your home Planned
(`docs/design-docs/hub-home-and-following.md`).

- **Discover** lists published collections, newest first, page by page. Search
  by text and tags, tag filters (popular tags from published collections over
  the last 90 days) and full-text search are planned; no date-range filter.
- **Public hub page:** the hub's name, handle, description, **Follow**, the
  share row and its published collections.
- **Follow** a hub like subscribing to a YouTube channel: it joins your
  Following list, its new published collections appear there, and you're
  notified when it publishes (a per-hub notifications toggle, on by default).
  A follow belongs to the hub and stays if the hub changes hands.
- **Save** a published collection like saving a document in Google Drive. If
  it is unpublished, the save goes dormant — it keeps its place labelled
  "Currently unavailable", can't be opened or downloaded, can be removed, and
  no snapshot is kept — and comes back when it is republished.
- **Your home:** your own hub page, Google-Drive style — **My collections**,
  **Shared with me**, **Saved**, **Following** — with "View your public hub".

### 6.7 Discussion

Purpose: questions and answers next to the resources. Status: Built.

- Every collection can carry a discussion: questions or notes with one level of
  replies, readable by anyone who can read the collection.
- Anyone signed in who can read it can comment and reply, so help never waits
  on the contributors; signed-out readers are invited to sign in.
- Contributors' replies are badged **Contributor**; they can mark one reply per
  question as the answer (shown first) and hide comments (still visible to
  them). Each question shows up to 100 replies, with **More replies**.
- Authors edit or delete their own comments; a question with replies keeps a
  placeholder.
- The owner can turn comments off, leaving existing ones readable; a collection
  on hold takes no new comments. Comments never grant access to anything.

### 6.8 Notifications

Purpose: one inbox for everything that concerns you. Status: invitation
notifications Built; the rest Planned (`docs/design-docs/notifications.md`).

- Kinds, scoped by role: following (a followed hub published), comments, saves
  and follows of your hub, sharing, invitations, imports, and service notices
  for operators.
- **Settings** on the Notifications page: a switch per kind and per followed
  hub; invitations and security notices are always on.
- Notifications are in-app. Email is kept for sign-in codes, invitations,
  targeted shares and security notices.

### 6.9 Manage

Purpose: the hub owner's workspace (`/manage`, ADR-0014). Status: Planned
(`docs/design-docs/manage-workspace.md`). Running the service stays separate:
the platform console, moving from `/ops` to `/platform` (§6.12).

- **The owner:** **Collections** (all collections as a table),
  **Comments** across the hub (hide, show, mark answers), **Access** (access
  requests, every share, link-shared collections; each collection's Manage
  access opens it filtered), **People** (followers and blocked accounts),
  **Import & export**, and **Activity** — the hub's audit trail.
- **Blocking** happens where a person appears — a comment, a follower, an
  access request, a share — and is undone in People. A blocked account can't
  comment, follow, be shared into or open link-shared collections; published
  collections stay public to everyone.

### 6.10 Download And Export

Purpose: take a collection out of the product as a document. Status: API only.

- Like File › Download in Google Docs, a signed-in reader can **Download** a
  collection as Word, Markdown or PDF; several collections at once (one
  document each, zipped) are exported from Manage › Import & export.
- The title and description lead, sections become headings, and references stay
  links unless the reader asks to include readable referenced collections one
  level deep — an expanded guide.
- Nothing is fetched from linked pages and nothing is stored. Unavailable
  references get a generic notice that reveals no title or content.

### 6.11 Account And Sign-In

Purpose: one account, passwordless, that never loses what you were doing.
Status: sign-in, verification and settings Built; email change API only;
deletion Planned.

- **Sign-in:** email, then an eight-digit emailed code. Emails carry codes
  only, never sign-in links; no passwords, no usernames.
- **Verification:** every situation that sends a code uses the same two
  screens, worded for the purpose (sign in, first link, signing in to do
  something, a session that ended mid-action, confirming a sensitive action,
  accepting an invitation). A known address is shown, never asked for again;
  nothing is emailed until the person chooses **Send code**; codes pasted with
  spaces or dashes work. An interrupted action continues afterwards, only for
  the person it belongs to.
- **Settings:** full name, email and member-since; hub name, handle,
  description and permanent id; whether to show the name on the hub. Changes
  save as they are made. Appearance (System, Light, Dark) is a header control.
- **Email change** (only ever the same person updating their address): the
  current address confirms by code
  (ignoring it changes nothing), the new address verifies by code, then every
  session is signed out.
- **Account deletion** *(planned)*: self-service with an email code, a download
  of everything first, and a 14-day grace period; then the hub, collections and
  handle go, comments read "[deleted]", and activity keeps only an anonymous
  actor.
- **Single sign-on** *(planned)*: one account across ns products through the ns
  series' own centralized identity service. Authenticator-app codes are a later
  option.

### 6.12 Service Operations

Purpose: keep the service healthy without access to private content. Status:
Built.

- Operator and admin roles are granted only by invitation. The first admin is
  invited at startup; only admins invite or remove operators. A new recipient
  enters their name and accepts before any account is created, and every
  recipient — even one already signed in — verifies a fresh email code before
  the role activates. No first-user, email-domain or single-sign-on shortcut
  grants a role; changing the account's email removes both roles.
- Suspension blocks the account's sign-in and others' access to its content;
  reactivation allows a fresh sign-in and restores sharing except where a
  collection is held. A hold keeps a public collection available to its owner
  for correction but hidden from everyone else; only operators release it.
- Every action carries a reason and is audited with its effect; sensitive
  actions ask the operator to confirm it's them with a fresh code. Operators
  never see private content, impersonate anyone, edit credentials or delete
  accounts. Contract: `docs/design-docs/service-operations.md`.

### 6.13 Curator Accounts

Purpose: the professional account people opt into when links are their work,
like a business account on Instagram — and what NSLinkHub charges for
(ADR-0016). Status: Planned, after everything above; notes in
`docs/design-docs/monetization.md`.

Candidates:

- **Analytics and engagement** per collection — views, link clicks, saves,
  follows — counted in aggregate, never tracking individual readers.
- **Members-only collections** for a community, through an invitation list or a
  join link, later paid access — always through the collection access rules.
- **Bulk work at scale:** higher import limits, possibly scheduled imports.
- **Link health:** alerts when links break.
- **API access:** scoped, revocable keys for integrations, automation and
  pulling one's own data; programmatic collectors use NSLinkHub as a curation
  layer (tags as labels, collections, notes). Rate limits sized to the plan.
- **AI curation:** send everything in one bucket and get back a reviewable
  draft with proposed collections, sections, tags and notes, and duplicates,
  dead links and unsafe sites flagged. AI proposes, people decide; titles
  still come from the pages.
- **A curator profile:** a verified label and a richer hub page.

## 7. Technical Product Requirements

### Web Application

The complete product surface: every module above. Native form posts work
without JavaScript, which only enhances. The interface follows `DESIGN.md`
and `docs/design-docs/web-interface-system.md`.

### Browser Extension

A planned, narrow capture companion: sign in, pick a collection, save the
current tab or selection (popup, context menu, keyboard shortcut) through the
same API as Save a link. No management screens.

### API Clients

Browsers use cookie sessions; API clients and the extension use bearer tokens.
Every client goes through the same authorization; Curator API keys (planned)
are scoped, revocable and rate-limited per plan.

### Privacy

- Email addresses are never public. People appear everywhere by their @handle;
  a name shows only on that person's hub page, and only if they choose.
- Saved links must be public addresses; link previews are text only and never
  make readers' browsers contact linked sites.
- Activity records hold ids, never names, emails or authored text.
- Analytics (planned) count in aggregate, never per reader.

### Auditability And Retention

- Every change to a hub's content and settings is recorded as an activity
  entry (planned beyond today's management audit); every operator action is
  audited with its reason.
- Import drafts expire after 30 days; account deletion has a 14-day grace
  period; exports are never stored.

## 8. Acceptance Criteria

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
- Guides use ordered section items.
- Stale reorders and edits are rejected (409) instead of overwriting concurrent
  changes.
- Malformed import rows produce per-row errors, never silent partial
  corruption.
- A link's title is never an input when saving or editing; its address, title,
  target or section text never changes after saving.
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

## 9. Out Of Scope

- Mobile apps.
- Authored rich content, a document or course builder, and uploaded or hosted
  media. A collection is a description plus sections and links; media is
  linked (an unlisted video, a recording), never uploaded. A course builder
  would need an editor, storage and teams, which the individual-scoped ns
  series deliberately excludes.
- Organizations, teams and hub memberships (ADR-0017, rejected). Collaboration
  is per collection; GitHub-style organizations only if ever needed.
- A separate saved-items list: reusing someone's link is Add to my collection.
- Billing, until Curator accounts are built and priced.

## 10. Open Product Decisions

- **Curator account details:** what it includes and costs, decided after the
  everyday product is built. The direction is settled (ADR-0016).

Decisions already made live in their module above, in the design docs, and in
`docs/engineering-decisions/`.

## 11. Delivery

Nothing is deployed; everything built runs and is verified locally. The API
(NestJS, `/api/v1`) is the product authority.

| Module | Web | API |
| --- | --- | --- |
| 6.1 Saving links | Built | Built |
| 6.2 Bulk import (reviewed drafts) | Planned | One-shot import built; drafts planned |
| 6.3 Collections: reading, details | Built | Built |
| 6.3 Organizing items, sections, references | Not yet | Built |
| 6.3 Attribution and history | Built | Built |
| 6.4 Link metadata (title, description, site name) | Shown as titles | Built |
| 6.4 Preview cards, notes | Planned | Planned |
| 6.5 Sharing, publishing, transfer | Not yet | Built |
| 6.5 Access requests, targeted invitations | Planned | Planned |
| 6.6 Discover | Built | Built |
| 6.6 Saves, shared with me | Not yet | Built |
| 6.6 Following, your home, search | Planned | Planned |
| 6.7 Discussion | Built | Built |
| 6.8 Notifications | Invitations only | Invitations only |
| 6.9 Manage: hub sections, blocking | Planned | Planned |
| 6.10 Download and export | Not yet | Built |
| 6.11 Sign-in, verification, settings | Built | Built |
| 6.11 Email change | Not yet | Built |
| 6.11 Account deletion, single sign-on | Planned | Planned |
| 6.12 Service operations | Built | Built |
| 6.13 Curator accounts | Planned | Planned |
| Browser extension | Planned | Uses the existing API |

Delivery order (everything is built; what to charge for is chosen after):

1. **Link metadata foundation** — done
   ([deliver-link-metadata](docs/exec-plans/completed/deliver-link-metadata.md)):
   background lookups in the worker, title, description and site name stored
   once per address. Bulk import and previews build on it.
2. **Activity and attribution** (§6.3) — done
   ([attribution-and-activity](docs/design-docs/attribution-and-activity.md)).
3. **People and hubs** — separate identities: @username for people, the
   optional hub with its own name and @handle, one namespace, the hub created
   on first save, subscriptions to hubs
   ([people-and-hubs](docs/design-docs/people-and-hubs.md)).
4. **Collaborators and routes** — collection roles become **viewer** and
   **contributor** (renamed from reader and editor); the platform console moves
   from `/ops` to `/platform`; items open by `?item=<id>` on a collection's
   address.
5. **Manage** for the hub owner (§6.9) —
   [manage-workspace](docs/design-docs/manage-workspace.md).
6. **Bulk import** (§6.2) —
   [deliver-bulk-import](docs/exec-plans/active/deliver-bulk-import.md).
7. **Notifications** (§6.8) —
   [notifications](docs/design-docs/notifications.md).
8. **Your home and following** (§6.6) —
   [hub-home-and-following](docs/design-docs/hub-home-and-following.md).
9. **Link previews and notes** (§6.4), with Add to my collection.
10. **Organizing and sharing in the web** (§6.3, §6.5, §6.10) — items,
   sections, references, sharing, publishing, transfer, download.
11. **Discover search** (§6.6).
12. **Rest of the internals pass** — fewer queries, one write-lock opt-out per
    controller, the forms route as an action table, Save a link drafts in
    Redis, focus rings.
13. **Account** (§6.11) — email change in the web, deletion, authenticator-app
    codes.
14. **Browser extension** (§7).
15. **Targeted sharing by invitation** (§6.5).
16. **ns-series single sign-on** (§6.11) — `docs/design-docs/identity-sso.md`.
17. **Before public release** — live email provider and webhooks, browser and
    worker telemetry, deployment (`docs/design-docs/infra-deployment.md`).
18. **Curator accounts** (§6.13), then pricing.

## 12. References

- Architecture: `ARCHITECTURE.md`; visual system: `DESIGN.md`.
- Focused designs: `docs/design-docs/README.md`.
- Settled foundations: `docs/engineering-decisions/README.md`.
- Security and reliability rules: `docs/SECURITY.md`, `docs/RELIABILITY.md`.
