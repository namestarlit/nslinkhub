# Web product experience

Status: public reading, email-code sign-in, account settings, Save a link,
collection details editing, discussion, attribution/History and service
operations are implemented. Planned journeys are listed below;
[PRODUCT.md](../../PRODUCT.md#11-delivery) owns delivery status and order.
The [interface system](web-interface-system.md) owns components and interaction;
[DESIGN.md](../../DESIGN.md) owns visual tokens.

## People and purpose

A reader arrives through a shared link or Discover, understands a collection,
and opens a useful resource. An owner maintains their library and shares durable
references. A collaborator works on a specific collection without joining a hub.
The experience should feel like a dependable personal library: legible titles,
clear destinations and visible structure, with most space given to reading.
Never invent counts, covers, recommendations or social proof to fill a page.

The implemented account has a hub and people appear by its `@handle`.
The accepted [people-and-hubs design](people-and-hubs.md) introduces person
usernames, optional hubs and subscriptions. Its routes and hub-creation behavior
are planned, not part of the implemented journeys below.

## Navigation and entry

The lowercase `nslinkhub` wordmark links to the signed-in person's `/h/<hubId>`
or `/` when signed out. Discover stays in the header beside account controls.
Signed-in visitors also have Save a link, the appearance control and an
avatar-only account menu: Notifications, Settings, Service operations when
authorized, and Sign out. Signed-out navigation keeps **Sign in**.

The landing pairs **Save your first link** with **Sign in**. Its discovery copy
is “Someone already found your next good read.” followed by “Discover the links
someone kept.” A labelled, noninteractive example shows a real collection's
structure: hub context, title, description, tags, headings, external links and
a collection reference. No control promises an unbuilt action.

| Surface | Route and data | Main action |
| --- | --- | --- |
| Landing | `/` | Save your first link; Sign in; Discover |
| Discover | `/discover`; `GET /api/v1/discover` | Open a collection |
| Hub | `/@handle` or `/h/<hubId>`; hub lookup and authorized collection list | Open a collection |
| Collection | `/c/<id>`; collection, resources and discussion APIs | Open a resource or referenced collection |
| Pretty collection URL | `/@handle/<slug>`; handle then hub/slug resolution | Read the same collection |
| Capture | `/capture`, `/capture/<draftId>` | Save one or two links |
| Collection details | `/c/<id>/edit` | Owner edits title, description and tags |
| History | `/c/<id>/history` | Owner/editor reads authorized activity |
| Account | `/settings`, `/notifications` | Edit profile/hub; read invitation notices |
| Service operations | `/ops` and its sections | Authorized account/moderation work |

Share controls copy immutable `/c/<id>` or `/h/<hubId>` addresses. An explicit
**Share access link** may include the supplied collection token. Never attach
it to an external URL, pretty browse link or referenced collection. A failed
optional hub lookup must not hide an otherwise authorized collection read.

## Discover and hubs

Discover shows the API's recency-ordered publications. Collection rows include
title, up to two description lines, hub context and update time. Do not imply
ranking quality or popularity; text/tag search is planned.

Hub pages show the hub's independent name, `@handle`, description and optional
“@handle by Owner Name” attribution. Never substitute email for a missing name.
Visitors see published collections; the authenticated owner sees their own
collections, including private ones. The API authorizes both lists. Settings
alone offers **View your public hub** with `?view=public`, always using public
queries. `/hub` is a signed-in shortcut, not a shared address.

Desktop lists fit complete rows in the available frame with Previous/Next.
Mobile has explicit More collections; native cursor links work without
JavaScript. Hide pagination when everything fits. Empty Discover says “No
published collections yet.” Empty public hubs say “No published collections
here yet.” Empty owner hubs offer first-link capture.

## Collections and discussion

The reader is one sheet: hub context and actions, title, text description,
tags, owner/contributor/update metadata, then ordered headings and resources.
The owner sees **Add a link** in the top bar. API capabilities control Edit and
History; a session alone never proves permission. Narrow screens fold History
and Edit into an in-place More disclosure.

External links show their server-resolved page title, falling back to a readable
address, then hostname, external-link glyph and tags. References use the readable
destination's title and immutable permalink; unreadable targets are neutral
unavailable entries. Headings group resources without creating access boundaries.
There are no title overrides, parent breadcrumbs, remote thumbnails or favicon
fetches. Preserve backend ordering and ordinary anchor/modified-click behavior.
Descriptions render as text with line breaks; do not inject API strings as HTML.

Owners edit title, description and tags together through a native form. Validation
failures retain the draft. Version conflicts show current values and require a
deliberate retry. Resource organization controls, notes and preview cards are
planned; see [collections and resources](collections-and-resources.md).

Discussion appears beside the reader on wide screens and after resources on
narrow screens. Posting, replies, editing/deleting one's own words, contributor
moderation and accepted answers follow the [discussion contract](discussion.md).
Signed-out readers can sign in and return to the open composer. Drafts survive
closing disclosures. Contributor badges describe capability, never access grants.

## Save a link

Capture accepts one or two public addresses with optional tags; titles come from
the pages. `/capture/<draftId>` resumes a 30-minute encrypted HttpOnly draft.
Up to three drafts coexist. URLs never enter navigation strings or client
storage. Existing collections require a destination choice; a new collection is
private. Backend transactions and retry receipts prevent duplicate saves.

When verification is needed, the form says “Verify your email to save this
link.” Ordinary verification submits the saved intent; invitation verification
never does. Save failure keeps both session and draft for a deliberate retry.
The implemented signup creates the hub; creation on first save is the planned
[people-and-hubs](people-and-hubs.md) behavior.

## Account and appearance

Settings shows Profile and Hub directly. Profile edits full name and the
**Show my name on my hub** switch; email and member-since are read-only. Hub
edits name, handle and description and shows its immutable ID. Copy hub link
precedes View your public hub. Autosave retains newer drafts and provides
Saving/Saved or retry feedback; a noscript Save changes button preserves native
editing. Handle availability is advisory; backend validation decides the write.
Name visibility affects hub attribution, never the stored name or authorization.

The header avatar resolves through a chosen image, server-proxied Gravatar for
the verified email, then a generated SVG. No upload field appears in Settings.
Appearance lives only in the header: System → Light → Dark → System. Signed-out
visitors follow the system preference; saved appearance applies only with a
valid session. The footer has copyright, “an ns series product”, Discover and
Support. Readiness is API monitoring, with no client status page.

Notifications currently lists service invitations as expandable messages,
unread first. Opening it resets the badge; Clear all hides existing entries.
Invitation acceptance begins from the emailed link. Status pages and notices
point to that email; they never authorize acceptance themselves.

## Service operations

The implemented console has Accounts, Collections, Team (admin only) and Audit
at `/ops`. It uses tables, filters and explicit row actions with required
reasons. It never grants private-content access or exposes private previews.
New invitation recipients consent before account creation; every recipient
verifies a fresh invitation-bound code before a role activates.

Sensitive actions require recent verification. **Confirm it's you** sends
nothing until requested, then resumes the waiting action once for its original
account and operation ID. The [verification contract](email-verification.md)
and [operator contract](service-operations.md) own the details. The planned
platform route is `/platform`; the owner-only [Manage](manage-workspace.md)
workspace is separate.

## Failures and acceptance

Missing, private and removed collections all say “This collection isn't
available. It may be private or no longer exist.” Offer Discover and, when
signed out, sign-in with the permalink or pretty destination and supplied share
token preserved. Reveal no title, owner or existence information. Request access
awaits the owner approval workflow.

Show service failures where they interrupt the task, with retry or return.
Never expose dependency names, connection details or raw exceptions. Session
changes clear private rendered state; request failures retain safe drafts and
never trigger mutation retry loops. Backend authorization applies to every
request; hidden controls are not a security boundary.

Prove journeys with keyboard, narrow screens and no JavaScript. Permalinks
survive handle/slug changes and collection transfers. Revocation and unpublishing
remove access on revalidation; private responses never enter shared caches.
Browser verification and source checks are described in the
[verification runbook](../runbooks/verification.md); live provider and deployment
acceptance remain [release requirements](../runbooks/release.md).

## Planned journeys

| Journey | Contract |
| --- | --- |
| People and hubs | Person usernames/profiles; optional hub on first save; subscriptions to hubs |
| Home | Separate My collections, Shared with me, Saved and Subscriptions views |
| Dormant saves | Keep the saved-list title and date with “Currently unavailable”; suppress tags/previews, allow removal, restore opening on republish |
| Organizing items | Sections, references, reorder and keyboard alternatives; preview/details and notes |
| Sharing and publishing | Per-collection viewer/contributor grants, access requests and invitations; explain publication without implying reference access |
| Manage | Hub-wide collections, comments, access, subscribers/blocking, import/export and activity |
| Bulk import | Reviewed drafts with per-row validation, folder destinations and deliberate partial commits |
| Downloads | Markdown/PDF/Word, optional reference expansion, zip for several collections |
| Notifications | Broader inbox kinds and per-kind/per-hub preferences |
| Email change | Confirm current address then verify new address; completion revokes sessions; API exists, web screens pending |
| Account deletion | Verified proof, export/transfer opportunity and explicit retention workflow; currently disabled |

Focused designs own these details; planned routes must not appear as working
navigation before their complete journeys exist.
