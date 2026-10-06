# Web product experience

Status: W3 design contract. The first explore-to-resource slice is implemented;
later entry points and account/editing journeys remain separate slices. Read alongside
[the system design](../SYSTEM_DESIGN.md), [adoption gates](adoption-decisions.md)
and [interface system](web-interface-system.md). Product behavior stays owned
by [PRODUCT.md](../../PRODUCT.md).

## People, jobs and feeling

A reader arrives through a link or explores recently updated collections,
understands what a collection covers, then opens a useful resource. A curator
returns to their own hub to maintain links and share one durable reference.
A collaborator reads or edits a specific collection; they do not join a hub.

The interface should feel like a dependable personal library: legible titles,
clear destinations and visible structure. Reading earns the most space.
Counts, decorative covers, recommendations and social proof must not be
invented to fill a page. Product copy uses “collection”, “section”, “resource”
and “your hub”; there is no workspace or organization switcher.

Physical scene: someone opens a colleague's collection on a phone beside a
bright window, scans several links, then continues on a laptop. Use a light
canvas with dark text and restrained accents, readable in daylight. A single
light theme ships first; a theme switch waits for a complete second palette.

## Reading journeys: one complete slice at a time

The first implemented navigation is the lowercase `nslinkhub` wordmark linking
to explore. User direction (2026-10-06): complete explore → collection → section
or external resource as one MLP journey before the next. Public hub/pretty-URL
browsing and service status are subsequent slices; add their navigation only
when they work end to end. The route table below is the complete reading target,
not a claim that every entry point is implemented. Add account navigation
only when a working sign-in/session journey exists. No disabled search box,
“New collection” button, empty account menu or links to future pages.

| Surface | Route and data | Main action |
| --- | --- | --- |
| Explore | `/`; `GET /api/v1/explore` | Open a collection |
| Public hub | `/@handle`; `GET /api/v1/hubs/by-handle/:handle` | Open a collection |
| Collection | `/c/<id>`; `GET /api/v1/collections/:id`, then resources | Open a resource or section |
| Pretty collection URL | `/@handle/<slug>`; resolve handle, then hub+slug | Read the same collection view |
| Service status | `/status`; `GET /api/v1/status` | Retry or return to browsing |

Route labels are presentation; the API receives immutable IDs for durable
references. Link and share controls always copy `/c/<id>`. When the visitor
arrived using a valid share token, copying that shared access link preserves
the token only through an explicit sharing action. Never append a token to
external resource URLs or pretty browse URLs. Nested collections use the same
permalink shape; there is no extra section route.

### Explore and hub pages

Explore leads with “Explore collections” and a short description of the
recency list. Use a vertical list with a generous title, up to two lines of
description, tags and an updated date. The first slice does not claim
popularity, recommendation quality or an exact total. Ship the API's existing
recency order; ranking beyond recency remains Phase E. Do not expose a sort
selector with one option.

The hub page leads with `@handle`, optional hub description and its published
collections. Its API does not supply a public display name or avatar; do not
borrow private profile data or fabricate either. A signed-in owner's editing
surface will be distinct from the public hub page.

Use cursor pagination with a visible “More collections” control, not infinite
scroll. Preserve position when appending results; keep focus on the control
and announce the number loaded. A URL-based next-page fallback must work
without JavaScript. Empty explore says “No published collections yet.” An
empty hub says “No published collections here yet.” Neither names private
collections or promises an action that has not shipped.

### Collection reading

Hierarchy: context/back link, title, description, tags, ordered resources.
Show “Copy link” as a secondary action beside the title. Do not infer whether
the visitor is an editor from the presence of a session. Future edit controls
must use an API-owned capability contract and still handle rejected writes.

External resources are rows: title override when present, otherwise a readable
URL; destination hostname beneath it, optional tags, and a clear external-link
affordance. Long titles and URLs wrap. Resource order is the backend's position
order; do not resort by title or host. No remote thumbnails or favicon fetches
in the first slice. Open links with ordinary anchor behavior; modified clicks
work. An explicit new-tab affordance must be labelled.

A section row uses the linked collection's title only after an authorized read
succeeds. Section links navigate to `/c/<linkedCollectionId>`; inherited share
access must work through that navigation. A parent breadcrumb is rendered only
after an authorized parent read, since direct access to a section does not
necessarily grant parent access. Failed contextual reads must not hide an
otherwise accessible collection or reveal a private parent's title.

Descriptions render as text initially, preserving line breaks. A later rich
description renderer must sanitize its supported markup; never inject API
strings as HTML. An empty collection says “No resources in this collection
yet.” Do not show “Add a link” until the capture journey is implemented.

### Status and failures

Public status displays “All systems ready”, “Some services are limited” or
“Temporarily unavailable”, based on the aggregate readiness value. It does not
repeat dependency names, connection details or exception messages. A degraded
Redis probe does not block browsing. API reachability failure is a separate
“We couldn't check the service” state, with retry.

Private, removed and nonexistent collection URLs share one unavailable view:
“This collection isn't available.” Offer return to explore; offer sign-in only
once the working account journey exists. Do not disclose whether a collection
exists, who owns it or why access failed. Malformed route IDs receive the same
reader-facing unavailable state. Expired sessions clear private rendered state
before showing sign-in; no redirect loop or background repeated retries.

## Later W3 journeys: specified, not first-slice navigation

| Journey | Presentation contract and release condition |
| --- | --- |
| Sign-in | Email first, then emailed code submitted by POST; no direct authentication link. No password signup, sign-in or recovery screens. Gate #3 must prove real delivery before this is advertised. |
| Own hub | Collections, shared with you and saved collections are separate destinations; one personal hub, no switcher. |
| Dormant saves | Keep the saved row in place with “Currently unavailable”. Disable opening/exporting while dormant; allow removal. Restore opening on republish. Do not fetch or preview unavailable contents. |
| Capture/edit | Inline forms and an ordered resource list; backend validates and authorizes. A 409 preserves the unsent draft, fetches current state and asks for a deliberate retry. |
| Publish | Confirm that the collection and its sections become readable, naming the section count; never a generic “Are you sure?” |
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

A person can browse explore, open a hub or stable collection link, follow
ordered resources/sections, and understand empty/unavailable/service states
on keyboard and a narrow phone. Renaming a handle or slug does not break a
copied permalink. Unauthorized and nonexistent resources look alike. Unpublish,
link rotation and account changes invalidate displayed private state on the
next validation; no shared cache retains sensitive responses. The interface
never uses hidden controls as an authorization mechanism.
