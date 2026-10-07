# Web product experience

Status: W3 design contract. Public reading and account navigation are implemented;
account/editing journeys remain separate slices. Read alongside
[the system design](../SYSTEM_DESIGN.md), [adoption gates](adoption-decisions.md)
and [interface system](web-interface-system.md). Product behavior stays owned
by [PRODUCT.md](../../PRODUCT.md).

## People, jobs and feeling

A reader arrives through a link or discovers recently updated collections,
understands what a collection covers, then opens a useful resource. A curator
returns to their own hub to maintain links and share one durable reference.
A collaborator reads or edits a specific collection; they do not join a hub.

The interface should feel like a dependable personal library: legible titles,
clear destinations and visible structure. Reading earns the most space.
Counts, decorative covers, recommendations and social proof must not be
invented to fill a page. Product copy uses “collection”, “heading”, “resource”
and “your hub”; there is no workspace or organization switcher.

Physical scene: someone opens a colleague's collection on a phone beside a
bright window, scans several links, then continues on a laptop. Use a light
canvas with dark text and restrained accents in daylight, with a complete dark
palette for evening reading. Appearance supports Light, Dark and System.

## Reading journeys: one complete slice at a time

The lowercase `nslinkhub` wordmark links to `/h/<hubId>` for the current personal hub when signed in and
to the landing page when signed out. User direction (2026-10-06): complete discover → collection → referenced collection
or external resource as one MLP journey before the next. Public hub/pretty-URL
browsing adds owning-hub context and pretty collection links. The top bar provides an avatar-only account menu for signed-in users. The route table below lists
the implemented public reading surfaces. Add account navigation
only when a working sign-in/session journey exists. No disabled search box,
“New collection” button, empty account menu or links to future pages.

Public hub → pretty collection URL → reference/resource is implemented and reviewed
in [its ExecPlan](../exec-plans/completed/deliver-public-hub-reading.md).
The two collection entry points share one reader. Hub attribution uses only
public hub data, and a failed optional hub lookup does not hide authorized ID
reading. Account navigation, profile editing and invitation notifications are
implemented; first-link capture, owned collections and optional renaming are implemented.

| Surface | Route and data | Main action |
| --- | --- | --- |
| Landing | `/` | Save your first link; Sign in; Discover the links someone kept |
| Discover | `/discover`; `GET /api/v1/discover` | Open a collection |
| Public hub | `/@handle`; `GET /api/v1/hubs/by-handle/:handle` | Open a collection |
| Collection | `/c/<id>`; `GET /api/v1/collections/:id`, then resources | Open a resource or referenced collection |
| Pretty collection URL | `/@handle/<slug>`; resolve handle, then hub+slug | Read the same collection view |

Route labels are presentation; the API receives immutable IDs for durable
references. Link and share controls always copy `/c/<id>`. When the visitor
arrived using a valid share token, copying that shared access link preserves
the token only through an explicit sharing action. Never append a token to
external resource URLs or pretty browse URLs. All referenced collections use the same permalink shape.

### Discover and hub pages

Discover leads with “Someone already found your next good read.” and “Discover
the links someone kept.” over the recency list. Use rows in two columns on desktop and one on phones,
with a clear title, up to two lines of description, the owning hub and an updated date. The first slice does not claim
popularity, recommendation quality or an exact total. Ship the API's existing
recency order; ranking beyond recency remains Phase E. Do not expose a sort
selector with one option.

The hub page leads with `@handle`, optional hub description and its published
collections. Its API does not supply a public display name or avatar; do not
borrow private profile data or fabricate either. A signed-in owner's editing
surface will be distinct from the public hub page.

Desktop lists measure the available frame and paginate complete rows with
Previous/Next. Mobile keeps scrolling with an explicit More collections control.
Native no-JavaScript cursor continuation remains available. Preserve position when appending results; keep focus on the control
and announce the number loaded. A URL-based next-page fallback must work
without JavaScript. Empty Discover says “No published collections yet.” An
empty hub says “No published collections here yet.” Neither names private
collections or promises an action that has not shipped.

### Collection reading

Hierarchy: context/back link, title, description, tags, ordered resources.
The collection is one sheet, identical in structure to the landing example: a
top bar with the hub link and Share (plus Edit for owners), then title,
description and tags, ordered headings and resources (each whole row opens its
destination), an owner-only “Add a link” row, and a footer with hub, publisher
and updated date. Do not infer whether
the visitor is an editor from the presence of a session. Future edit controls
must use an API-owned capability contract and still handle rejected writes.

External resources are rows: title override when present, otherwise a readable
URL; destination hostname beneath it, optional tags, and a clear external-link
affordance. Long titles and URLs wrap. Resource order is the backend's position
order; do not resort by title or host. No remote thumbnails or favicon fetches
in the first slice. Open links with ordinary anchor behavior; modified clicks
work. An explicit new-tab affordance must be labelled.

A collection-reference row uses its saved title override first, otherwise the
viewer-authorized destination title. It shows saved tags and links directly to
`/c/<linkedCollectionId>` without forwarding source tokens. Unavailable targets
show a neutral entry without target metadata. Headings group ordered resources
without links or permission implications. There are no parent breadcrumbs.

Descriptions render as text initially, preserving line breaks. A later rich
description renderer must sanitize its supported markup; never inject API
strings as HTML. An empty collection says “No resources in this collection
yet.” Do not show “Add a link” until the capture journey is implemented.

### Status and failures

Service readiness belongs to API monitoring (`GET /api/v1/status`), not client
navigation. There is no client `/status` page. A service failure is explained
where it interrupts a user's task, with an appropriate retry or return action.
Never expose dependency names, connection details or exception messages.

Private, removed and nonexistent collection URLs share one unavailable view:
“This collection isn't available. It may be private or no longer exist.” Offer
return to Discover and, for signed-out readers, sign-in with the destination
preserved. Request access awaits an owner approval workflow. Do not disclose whether a collection
exists, who owns it or why access failed. Malformed route IDs receive the same
reader-facing unavailable state. Expired sessions clear private rendered state
before showing sign-in; no redirect loop or background repeated retries.

## Service operations

The [service-operator contract](service-operations.md) is implemented with
reusable email-code sign-in/session support. `/ops` provides account lookup,
account/session actions, public-content holds and audit. Navigation appears
only for currently granted admins/operators. Admins manage invitations and
operator access at `/ops/operators`. Recipients open the emailed link before sign-in. New recipients enter their name
and accept; every recipient then verifies a fresh emailed OTP, including matching
sessions. Existing names are preserved. `/invitations/:id` is status only. The role
activates after verification and `/ops` opens; startup creates only an invitation. Native POST forms work without JavaScript;
recent-authentication expiry returns to sign-in without replaying an action.

## Later W3 journeys: specified, not first-slice navigation

| Journey | Presentation contract and release condition |
| --- | --- |
| Email change/account settings | Sign-in, sign-out, profile editing and appearance settings exist; verified email-change screens remain. Live delivery acceptance is still required before public release. |
| Own hub | Collections, shared with you and saved collections are separate destinations; one personal hub, no switcher. |
| Dormant saves | Keep the saved row in place with “Currently unavailable”. Disable opening/exporting while dormant; allow removal. Restore opening on republish. Do not fetch or preview unavailable contents. |
| Capture/edit | Inline forms and an ordered resource list; backend validates and authorizes. A 409 preserves the unsent draft, fetches current state and asks for a deliberate retry. |
| Publish | Explain that this collection becomes public. References retain their own access settings; publication never exposes private destinations. |
| Sharing | Reader/editor access per collection. A missing account produces an inline explanation; no invitation promise. A link token appears only in its explicit sharing flow. |
| Imports | Show universal CSV columns (`url`, optional `title`) and bookmarks HTML. Present per-row results. Verify multipart CSRF before shipping the form. |
| Exports | Signed-in readers choose Markdown/PDF/Word and expansion; multiple collections download a zip. The response is a real file, not a job-status page. |
| Email change | Confirm current address, then verify new address; completion revokes all sessions. Do not put an editable email field on the first profile form. |

Dormant-save rows retain the title supplied by the saved-list contract, with
muted text, saved date and unavailable label. This is not a historical snapshot.
Tags and descriptive previews are suppressed while unavailable. Removing a
save uses an explicit action and refreshes the list; no new retention policy
is implied by this presentation. Gate #3 has closed the profile credential-write
bypass and implemented verified email handover locally. Account deletion stays
unavailable pending its verified ownership and retention workflow; browser
acceptance for account journeys remains outstanding.

## Reading acceptance

A person can browse Discover, open a hub or stable collection link, follow
ordered resources and headings, and understand empty/unavailable/service states
on keyboard and a narrow phone. Renaming a handle or slug does not break a
copied permalink. Unauthorized and nonexistent resources look alike. Unpublish,
link rotation and account changes invalidate displayed private state on the
next validation; no shared cache retains sensitive responses. The interface
never uses hidden controls as an authorization mechanism.

## Account shell

Notifications lists service invitations as expandable items (summary line with
title, relative time and a “New” marker; expanding shows what to do next).
Unread items lead, newest first. Opening Notifications resets the menu badge;
“Clear all” hides everything present (newer items still arrive). Email remains
the acceptance entry.
Shared-collection update notifications follow in a later milestone. The account
menu contains Notifications, Settings, Service operations when authorized, and Sign out.
Settings directly renders Profile (editable full name, an autosaving “Show my name
on my hub” switch enabled by default, read-only email and account
creation date) and Hub (independent hub name
and description, immutable ID and editable handle); Sign out is in the account
menu only. The outlined Copy hub link precedes View your public hub, and shares the permanent ID-based address. Changes
autosave after typing pauses, with save status and retry recovery. The public-hub
link saves pending edits before opening `/h/:hubId`; `/@handle` also resolves it. The
footer stacks “© <current year> nslinkhub” above the smaller, muted line
“an ns series product”, with Discover and Support links beside it. Client apps do not expose service-status navigation or a
status page; API readiness endpoints remain available for monitoring. Appearance
is controlled only by one icon button beside the header avatar, which cycles
System → Light → Dark → System, showing the current mode. System is the default.
The account avatar uses a chosen image first, then a server-proxied Gravatar
for the verified email, then a generated geometric SVG seeded by immutable UUID.

Signed-out visitors always follow the system color preference, even when the
browser retains an earlier appearance cookie. Saved Light/Dark/System preferences
apply only with a currently valid session; preference changes require sign-in.
The account-menu trigger shows only the avatar; Notifications starts the popup.


The name switch hides owner attribution on the own hub, public hub and published
collection metadata without clearing the account name. A blank name remains hidden.

Profile and hub changes autosave after typing pauses. Keep newer drafts intact
and show Saving/Saved or a retry action on failure. A noscript Save changes
control preserves editing when JavaScript is disabled.
Success uses green semantic feedback. Debounced handle availability distinguishes
current, available, reserved, taken and invalid names without exposing owners.
It is advisory: final validation and the database unique constraint decide the
write. Discard stale availability responses and preserve edits made during a save.

During a document navigation still pending after ~300 ms, hide the current
content and show a compact progress indicator (fast navigations never flash).
Returning to a tab re-checks the session cheaply and reloads only when the
account changed, the session ended, or the tab was away over ten minutes. Do not display collection skeletons on account pages
or immediate failure instructions. Offer reload recovery after eight seconds or
Escape cancellation. Reduced-motion users get a static indicator.


Invitation notifications are messages, not review links. They name the service
role and direct recipients to the emailed Review invitation button. Legacy
invitation status pages also direct recipients to their inbox without a chain
of entry links. Email links open consent directly through the token preview;
manual full-link entry exists only for JavaScript-disabled browsers. Invite codes
are deferred. The wordmark preserves its neutral ink color and has no link
underline in any interaction state, while retaining a keyboard-focus outline.


Routine profile-save confirmation is a compact green “Saved” with a check beside
the form; errors remain prominent. Show the public-address preview below the
handle and only show format/availability guidance when it changes. Keep native
field values intact through hydration and preserve edits made during a request.
Page titles use the current surface name followed by “· nslinkhub”; hub titles
use the public hub display name. Account/private collection data and tokens do not appear
in metadata titles.


Discover is a persistent header link grouped on the right with the account controls for both signed-in and
anonymous visitors. Do not repeat it as a breadcrumb on hub/collection pages;
collection context retains its hub link. Signed-in visitors then see Save a link, the appearance toggle and the avatar; navigation wraps at narrow widths or
enlarged text.


## Public entry and neutral surfaces (2026-10-06)

The root `/` introduces the product; `/discover` is the public feed.
The header keeps the wordmark alone on the left and groups Discover before the
account controls on the right, following the user-supplied DiceBear reference.
The landing uses a clearly labelled example collection, working discovery and
sign-in/own-hub links, and no pretend collection editor. Dark surfaces are
neutral charcoal; the blue accent, semantic feedback and system preference
remain shared with account and reading pages. The self-hosted Schibsted Grotesk face (2026-10-07,
replacing the system font) is part of the identity. Landing headings may scale up to 3.5rem; product headings
retain the compact type scale. Layout stacks naturally on narrow screens.


### Stable page frame and compact discovery (2026-10-06)

Header and footer frame a single scrollable main region, which is keyboard
focusable. Content never scrolls behind either landmark. Very short viewports
(480px high or less, including heavy zoom) fall back to document scrolling so
navigation cannot consume the entire available content area. Discover and public
hubs use compact collection rows in two columns on desktop, one on phones;
reading content keeps its comfortable text width. Cursor pagination remains an
explicit More collections action, with native next-page links without JavaScript.
Inline text links use accent color or button styling without decorative arrow
suffixes; list titles are ink. The small external glyph beside a resource
hostname marks the destination type and is not a link suffix.


## Next milestone proposal: first useful save (2026-10-06)

User requested a handoff for the next session, not implementation now. Recommended
primary CTA: “Save your first link”; secondary: “Sign in”. General
identity entry becomes “Continue with email”, using the existing unified OTP
signup/sign-in behavior. New accounts/hubs follow ordinary verified signup;
invitation acceptance remains a separate consent/proof flow.

Proposed activation path: paste a URL, verify email if needed, then save the link
into a private collection and open it. Defer optional name/handle/tags and full
profile setup until after this first success. Preserve the draft on errors and
make first collection + resource creation atomic and retry-safe in the backend.
The next ExecPlan must settle draft retention, private destination selection for
existing users, and the complete minimal management surface. These recommendations
are not shipped behavior; current landing/auth controls remain usable as built.

## First-link capture

`/capture` accepts a URL. `/capture/<draftId>` resumes a 30-minute encrypted
HttpOnly draft; URLs are never placed in navigation strings or client storage.
Up to three drafts coexist. The auth form explains “Verify your email to save
this link”; navigation and the general page retain **Sign in**. Successful ordinary
verification submits the saved intent. Existing collections require a destination
choice. Save failure retains both verified session and draft with a deliberate
retry. Invitation verification never executes a capture intent.

`/h/<hubId>` and `/@handle` show the owner's collections when signed in as that
hub's owner; visitors see published collections only. `/hub` is a compatibility
redirect. Settings alone offers a public preview using `?view=public`.
Empty hubs offer first-link capture. The reader's API-owned manage capability
reveals Add another link and in-place name, description and tag editing. Failed
saves retain drafts, and version conflicts require reviewing latest values.

Spacing groups rows without repeated divider lines. Header/footer borders and
the landing divider before discovery remain deliberate structural boundaries;
the example collection has no internal separators. Descriptions show up to two
lines when authored; missing descriptions are omitted, never fabricated.

Landing action grouping (user refinement): Save your first link + Sign in in the
hero. In the left discovery column, directly below “Someone already found your next
good read”, place “Discover the links someone kept”. Omit the public/no-account-needed
note: this section speaks to readers discovering resources. The top-bar
Discover link remains available. The Discover page reuses the same two lines as
its heading and introduction.

Unavailable collection reads keep missing and inaccessible IDs equivalent at the
API boundary (404). The reader says “This collection isn't available. It may be
private or no longer exist.” Signed-out readers can sign in and return to the
same permalink or pretty URL, including a supplied share token. Signed-in readers
can browse Discover; no target title or owner identity is disclosed. Request
access is deferred until there is an owner approval workflow.


Landing example (2026-10-07): the example is a miniature of the real reader —
hub context, title, description, tags, ordered headings, two external links with
hostnames and one collection reference — so the first screen shows the product's
guide structure honestly. It stays labelled “Example” and links nowhere. Sign in
beside Save your first link is a secondary button; the typed question is an
accent-colored subhead with no control.
