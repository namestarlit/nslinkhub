# System Design

The authoritative design for NSLinkHub: tenancy, identity, sharing, discovery,
the web URL scheme, export, and the workspace. This document states the system
**as it is decided and built now** (the Google-Drive individual model), not its
history. Where it and `PRODUCT.md` agree, both are canonical; `PRODUCT.md`
holds the product-facing framing and acceptance criteria, this holds the
architectural model and rules. The root `ARCHITECTURE.md` stays the short
stable map; focused satellite designs live in `docs/design-docs/`.

Related documents:

- `PRODUCT.md` — product definition, capabilities, acceptance criteria.
- `docs/design-docs/identity-sso.md` — ns-series identity (nsauth, "Continue
  with namestarlit"), deliberately bounded to users + SSO (no orgs).
- `docs/design-docs/conventions.md` — API/persistence casing and envelope.
- [Service operations](design-docs/service-operations.md) — implemented:
  operator authority, account restrictions, public-content holds and audit.
- `docs/design-docs/transactional-email.md`, `observability.md` — local email
  delivery and telemetry foundations, with separate live rollout requirements.
- `docs/design-docs/infra-deployment.md` — namestarlit VPS + Dokploy.
- `docs/exec-plans/completed/drive-model-tenancy.md` — the decision log behind
  the Google-Drive individual model defined here.

## The model in one line

```txt
User (1:1) Hub → Collections → Resources
```

Each **user** owns exactly **one hub** — their personal space, like a Google
Drive or a Tailscale tailnet. A hub owns **collections**; collections contain
**resources**: external links, collection references and headings. There are **no memberships,
invitations, hub roles, or usernames**. Collaboration is per-collection sharing
only; a hub is never a space others "join".

## Principles

1. **Immutable IDs are the only identity.** Every entity keys on an immutable
   UUIDv7 (`userId`, `hubId`, `collectionId`, `resourceId`). Human-facing
   values — the hub **handle**, the **display name**, emails — are mutable
   attributes and never appear in authorization rules, foreign keys, or durable
   route contracts. A durable link uses `hubId`/`collectionId`; renaming a
   handle never breaks a saved reference.
2. **One hub per user.** The hub is the tenant root and is 1:1 with its owner
   (`hub.ownerUserId`, unique). Every hub-owned query carries `hubId`; a route
   id never proves access. A user has no domain data except through their hub.
3. **Ownership is a transferable relationship, not identity.** A collection's
   owner is its `hubId`; a resource belongs to its collection. Transferring a
   collection reassigns the owning hub; the immutable **creator**
   (`collection.creatorUserId`) never changes.
4. **Collaboration is per-collection, Drive-style.** The only ways a non-owner
   gains access are a direct share (reader/editor), an active share link, or
   publication. There is no hub membership or content-admin bypass. The hub
   owner manages their space, subject to service availability
   restrictions; operator authority never grants collection access.
5. **Collections are independent.** A grant applies to one collection and its
   resources. Referencing another collection grants no authority over it. There
   are no parent/child relationships or recursive ownership operations.
6. **Backend authority.** Business rules, validation, authorization, and
   derived state live in the API. Clients are replaceable delivery surfaces; a
   hidden control is not a permission check.
7. **Auth boundary.** better-auth owns credentials, sessions, and verification
   primitives; the product owns identity, authorization, and workflows. Session
   resolution goes through `resolveSessionUser`; services consume `AuthUser`.
   Sign-up onboarding (personal-hub creation) is an app-owned service callable
   from any auth path, so the later SSO integration is an integration, not a
   rewrite.
8. **Stable envelopes.** Success `{ data, meta? }`; failure
   `{ error: { code, message, requestId, details } }`; every response carries a
   server-generated PII-free `X-Request-Id`. Growth-prone lists paginate by
   opaque cursor.
9. **Naming boundaries.** Product branding stays out of schemas, table/column
   names, API fields, and env-var names.

Conventions in place and unchanged: Bun toolchain + runtime; Prisma as the
backend-only persistence boundary behind a Nest `PrismaService`; PostgreSQL 18
with `app_uuid_v7()` defaults; `timestamptz` UTC; camelCase API / snake_case
DB; global `ValidationPipe`; self-hosted better-auth with email codes; Biome; `bun test`; committed `bun.lock`.

## Domain model

```txt
User            — global identity (better-auth). userId immutable; name (the
                  full name), email, image mutable. No
                  username, no role column.
Hub             — the user's one personal space. hubId immutable; ownerUserId
                  (unique FK, 1:1); handle (unique, mutable) — the public
                  identity; name and description.
Collection      — belongs to a hub (hubId = owner). creatorUserId immutable
                  (provenance). slug (unique per hub), title, description,
                  published, linkSharingEnabled, share_token_hash, version.
Resource        — an item in a collection; the smallest unit of content.
                  kind = external_link (its own canonical `url`, one per
                  collection) | collection_link (linkedCollectionId) | heading.
                  titleOverride (a link's server-resolved page title, or a
                  heading's text — never editable), tags (text[]), position,
                  version. What belongs to an item (address, resolved title,
                  target, heading text) is fixed; only what people add (tags,
                  position; notes planned) is editable. No shared tables.
CollectionShare — (collectionId, userId, role reader|editor, source
                  direct|link). Per-collection access without any hub
                  membership. Feeds the shared/ surface.
CollectionSave  — (collectionId, userId, savedAt). A social-style bookmark of a
                  published collection. Feeds the saved/ surface.
```

(No export entity: exports are synchronous and stateless — see Export below.)

## Identity and handles

- **Handle** — a hub's public, mutable, unique identity (YouTube-handle style,
  lowercase `[a-z0-9-]`, 3–60 chars, reserved words blocked). It is a *handy
  way to reach a known hub* — `/@handle` resolves to the hub's page — never a
  key. The durable key is `hubId`; a handle rename breaks nothing.
- **Hub display name** — free-form `hub.name`, the public name of the hub,
  independent of its owner, email and handle. It is neither unique nor a lookup key.
- **Hub description** — optional `hub.description`, shown on the public hub and
  edited in Account → Hub. The profile API uses `hubDescription`; historical
  `User.bio` values remain stored but are neither edited nor published.
- **Full name** — `user.name`, the account holder’s name (exposed as `displayName`
  in the existing profile API). Published collections may attribute their current
  owner by this name when `user.showNameOnHub` is enabled (default true).
  Opting out returns null owner attribution on public hubs and collections; the
  private profile retains the name. Email is never public attribution.
- **Login direction: code-first, from the get-go.** The primary sign-in is
  Substack-style passwordless — continue with email → enter the emailed code
  (email codes only; no direct authentication links or passwords). There is no
  username. "Continue with namestarlit" SSO can join later without reshaping
  this. The **flow** is decided here; the
  **presentation** (screens, segmented code boxes, copy) is shaped by the W3
  Impeccable design pass — Impeccable may restyle it, not reorder it.
  Code delivery now has a local backend implementation; web presentation and
  live provider acceptance remain separate. Optional TOTP/recovery codes follow
  the core delivery milestone.
- **Account/hub handover** is done by **changing the account email**, not a
  transfer model — a hub is 1:1 with its account, so handing over the account
  hands over the hub. The locally implemented flow is double-verified:
  1. the signed-in owner sets the new email;
  2. a **confirmation** goes to the **current** address, naming the target
     address — nothing changes unless it is confirmed (email code);
  3. on confirmation, a **verification** goes to the **new** address;
  4. on verification the change applies, **all sessions are revoked**, and the
     account signs in with the new email.
  Templates for both steps exist in `packages/email`; the backend workflow is
  documented in `docs/design-docs/auth-delivery-integration.md`. Web screens and
  live provider acceptance remain outstanding.
- **nsauth SSO** is bounded to users + SSO + profile (no orgs); see
  `identity-sso.md`. Products keep their own userId authoritative and their own
  authorization; the IdP never decides who may edit a collection.

### Web URL scheme (W3 contract)

Durable references carry only the immutable id of the thing itself; every
mutable attribute — handle, slug, owning hub — lives in the payload, never
the address. The public URL shapes are:

| URL | Job |
| --- | --- |
| `/c/<collectionId>` | **Permalink** — any collection. Survives slug renames and ownership transfers. Backed by `GET /api/v1/collections/:id`. |
| `/h/<hubId>` | Stable hub page, backed by `GET /api/v1/hubs/:hubId`. Survives handle and owner changes. |
| `/@handle` | Hub page. Backed by `GET /api/v1/hubs/by-handle/:handle`. |
| `/@handle/<slug>` | **Pretty browse URL** — human-readable, *allowed to break* on rename/transfer (Drive path vs file id). Backed by `GET /api/v1/hubs/:hubId/collections/:slug` after handle resolution. Slugs are unique per hub. |

Owners see their own collections at both hub address forms; visitors see only
published collections. The web resolves the authenticated profile's immutable
hub ID before selecting the owner list endpoint. `/hub` is a compatibility
redirect to `/h/<hubId>`. Settings provides an explicit `?view=public` preview,
which always uses public queries. This view choice never grants API access.

Rules that keep it drift-proof:

- Collection references navigate directly to `/c/<id>` with no parent context.
- **"Copy link" / share buttons always emit the `/c/<id>` permalink**, never
  the slug URL. Slug URLs are for address bars and link previews only.
- Pretty URLs have exactly a handle and slug. Bare `/handle` paths are unsupported.

## Access model

A single policy service (`CollectionPolicyService`) is the one source of truth.
For a collection it resolves the strongest independent grant:

1. **Owner** — owns the collection's hub: read, write content and manage.
2. **Direct share** — reader or editor on that collection.
3. **Active link** — its valid token or recorded link share while enabled.
4. **Published** — the collection itself is published: read.

Otherwise the collection is **not found** (404, so callers cannot probe for
things they can't access). Reads that fail resolve to 404; writes a viewer may
not perform resolve to 403.

- **Manage** (publish, share, delete, settings, rename) is **owner-only**.
- **Editor** scope is content-only: resources, tags, imports within the shared
  collection. Editors never manage.
- A link grant is recorded against the opened collection only.
- Collection-reference metadata and exports authorize the destination separately.
  A source share token is never forwarded to another collection.

## Service operations

The [service-operator contract](design-docs/service-operations.md) adds explicit
product authority for account lookup, suspension/reactivation, all-session
revocation, public-content distribution holds and operator audit. Grants use
immutable user IDs, separate from collection roles. Startup invites an initial
admin; emailed-token consent creates only new recipients' named accounts/hubs.
Every recipient then verifies a fresh invitation-bound email OTP, including
matching signed-in sessions. Only successful verification creates the role and
session, atomically with proof consumption and audit. Admins invite/revoke
operators, whose verified acceptance is also required. Emergency zero-admin
recovery issues a fresh invitation instead of granting access. No private-content inspection, impersonation or credential override.

Account/collection restrictions are evaluated before the access grants
above, and on list/export/auth paths. A suspended owner cannot authenticate and
their hub's content is unavailable to others. A held collection remains
available to its active owner for correction, but unavailable to non-owners;
publication, sharing and transfer cannot bypass the hold. References confer no access.
Recovery preserves owner settings without restoring revoked sessions/grants.
Actions and audit are atomic. The linked contract owns concurrency, authority
lifecycle, privacy and retention details; these behaviors are not yet in code.

## Collections and resources

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

Reference edits, reorders and removal require only source write access. The
viewer-filtered `linkedCollection` payload is `{ id, title }` or null; it never
reveals an unreadable destination's title. Deleting a target nulls its reference
FK and leaves an unavailable resource. No nest/children endpoints, hierarchy
trigger, parent field, compatibility aliases or inherited-grant backfills remain.
Resources carry no summary. Titles and tags clarify links; headings organize guides.

## Collection discussion

`collection_comments` hangs off one collection (cascade on delete): `parent_id`
for one level of replies, `state` visible/hidden/deleted, at most one `accepted`
reply per question (partial unique index), `author_user_id` set null if the
account goes. `collections.comments_enabled` (default true) is the owner's
switch. Access is the collection policy, unchanged: reading the discussion
requires `canRead`; posting additionally requires a session, comments on and no
active hold; hiding and marking answers require `canWriteContent` (owner or
direct editor); edit/delete require authorship. Routes:
`GET|POST /api/v1/collections/:id/comments` (share token accepted, cursor over
questions newest first) and `PATCH|DELETE /api/v1/comments/:id`,
`POST /api/v1/comments/:id/{hide,show,accept,unaccept}`.

## Ownership transfer

- **Collection transfer** (`POST /collections/:id/transfer`): an owner transfers
  one collection to an existing editor. The collection moves to their hub;
  its resource references keep pointing to unchanged destinations. Recipient
  shares on this collection are removed, the previous owner receives editor
  access, and the immutable creator is untouched. Self-transfer and destination
  slug collisions are rejected.
- **Account/hub transfer** is not a model — see "Identity and handles" (email
  change).

## Publication and discovery

- **Publish** puts a collection on the product-wide **explore** surface
  (`GET /discover`, public, cursor-paginated, recency-ordered initially). Anyone
  can view; account holders **save** into their **saved/** surface. Saving
  requires publication; a save goes dormant on unpublish and revives on
  republish.
- **Publication is independent.** Only explicitly published collections appear
  in public lists. A published source does not expose any referenced collection.
  Its unreadable references remain neutral unavailable entries.
- **Discovery is tags + text — not handles.** In explore, the true north is
  searching by **tags and text**; the handle is *not* a global search facet.
  If you already know the hub you want, you go to it directly (`/@handle`) and
  search *within* that hub's publications. When you open a published
  collection, you can see **which hub published it** and follow that to explore
  more of their collections. So the handle serves direct navigation and
  attribution/click-through, while explore serves open discovery by tag/text.
- **shared/ vs saved/** — never mixed. shared/ is access *granted to you*
  (`CollectionShare`); saved/ is what *you chose to keep* from the public
  surface (`CollectionSave`). A share grants access; a save grants nothing.

## Tags

Optional labels stored **directly on** a collection or resource as a normalized
`text[]` (lowercase, de-duplicated, capped at write time) — set as part of
create/update, not a separate attach/detach step. There is no shared tag table,
no global namespace, and no "click a tag → everything tagged it" view: that
global machinery added complexity without value for a single-user tool.
Cross-library retrieval is a full-text search concern (Phase E), covering
titles, tags, and text together. Keep tags flat — no hierarchies or governance.

## Export

Export one or more collections as Markdown, PDF, or Word — synchronously.
`POST /exports { format, collectionIds[], expand? }` authorizes every id up
front and responds with the file itself (a zip when several collections are
selected, one document per collection). By default (`expand: false`), references
stay immutable `/c/<id>` hyperlinks using the configured web origin. The title
is H1 with its description below, and ordered heading resources become H2.
Explicit `expand: true` includes readable referenced collections as H2 sections;
headings inside them become H3. Their references, and self references, stay links.
Every destination is individually authorized without propagating source tokens.
Unreadable or deleted targets produce a generic unavailable notice, not private
metadata or silent omission. External links remain hyperlinks without fetched content.

All three renderers are programmatic (markdown string-building, `pdfkit`,
`docx`) — milliseconds even for large collections — so no format needs a job
queue, no artifacts are stored server-side, and there is nothing to retain or
clean up. BullMQ/Redis dispatch email delivery from the PostgreSQL outbox to a
separate worker; exports do not use that queue.

## Workspace and client surfaces

A Bun-workspace monorepo:

```txt
apps/
  api/        NestJS backend. Prisma schema/migrations/generated client and
              PrismaService stay inside; clients never touch persistence.
  web/        Next.js — public reading and account navigation; remaining W3 journeys follow.
  extension/  MV3 capture companion (planned, Track W4).
packages/
  types/      @nslinkhub/types — hand-curated API wire contracts.
  config/     shared TypeScript plus separate web server/browser configuration.
tooling/      repository checks (client boundary check).
```

Dependency rules: clients depend on the API contract and `@nslinkhub/types`
only — never Prisma or `apps/api` internals (enforced by
`tooling/check-client-boundaries.ts`). API authorization is the source of
truth; UI hiding is not a security rule. Packages use the `@nslinkhub/*` scope.

Surface roles: **Web** is the full surface (explore, hub page, collections,
resources, tags, sharing, transfer, saves, account). **Extension** is a
constrained capture companion (authenticate, pick collection, capture the tab
or selection via popup/context-menu/shortcut) using the existing
external-resource endpoint; no management surface, no reimplementation of
dedupe or publication rules; bearer-token auth in session-scoped storage.

## Delivery status and remaining tracks

The backend model above is **built and verified** (one hub per user, Drive
independent collection sharing and transfer, cross-hub references, heading
resources, bounded guide exports, tag pruning). Shared contracts
(`@nslinkhub/types`) and the client boundary check are in place. Codes-only auth,
verified email handover, auth audit, encrypted email outbox, BullMQ worker,
capture/Resend adapters and signed webhooks are implemented and verified locally.
No live deployment or provider acceptance is claimed. Release foundations and
auth delivery use additive migrations after `0_init`; follow
`docs/runbooks/migrations.md` for schema changes.

Remaining:

- **Foundation adoption gates.** `docs/design-docs/adoption-decisions.md`
  records the 2026-10 comparison and delivery decisions. Local release
  foundations, isolated verification, safe wire/error contracts and W3 design
  and the reviewed local auth-delivery milestone are complete. W3 web
  implementation proceeds in complete vertical slices; Docker image acceptance belongs to deployment
  preparation. Browser and public-release gates remain open.
- **W3 — Web app.** The three web design documents (`web-product-experience`,
  `web-interface-system`, `web-design-tokens`) are complete. Apply Impeccable
  under those contracts. Explore → collection → referenced collection/external resource is
  the first reviewed slice, committed locally as `d556236` with guide pin
  `9277461` (117 source tests and ten production browser cases passed).
  Public hub → pretty collection URL → reference/resource is implemented and
  reviewed in [the public hub reading ExecPlan](exec-plans/completed/deliver-public-hub-reading.md).
  It reuses the reader and copies immutable ID links. The
  [service-status journey](exec-plans/completed/deliver-service-status.md) is implemented
  and reviewed, including aggregate readiness, bounded failures and native
  rechecks. The service-operator journey now includes reusable email-code
  sign-in/session support, account restrictions, public moderation and audit.
  The web root now introduces the product, with public discovery at `/discover`
  and the signed-in wordmark routing to the current personal hub. Account
  navigation includes profile, notifications and appearance settings; readiness
  remains API-only following the removal of the client status page.
  Later slices include own collections, resource
  capture, sharing + transfer management, shared/ and saved/. Cookie sessions.
- **W4 — Browser extension.** `apps/extension` (MV3) capture companion.
- **Phase E — tracked alongside W3.** Release prerequisites remain
  mandatory before public exposure, separately from deferred product features.
  - nsauth SSO once it exists (users + SSO; see `identity-sso.md`).
  - Collection/auth audit and API LogTape/Sentry foundations are implemented
    locally. Browser instrumentation, worker metrics/tracing and live
    collector/deployment proof remain before public release. Auth delivery has
    local API/worker acceptance; web email-change/account settings and live sender/domain
    and webhook validation remain outstanding. Account deletion stays disabled
    pending its verified ownership and retention workflow.
  - Explore discovery by **tags + text** (search) beyond the initial recency
    list; full-text search across collections/resources.
  - Pending shares for unregistered emails (invitation-style, activated on
    sign-up).
  - Resource-level saves — evaluate after collection saves prove the loop.

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


## Discussion continuation

`GET /api/v1/collections/:id/comments` paginates questions with `cursor` and
`limit`. Each question includes `repliesNextCursor`; continue one question's
replies by supplying `replyTo=<question id>` and `replyCursor=<cursor>` alongside
the same question-page cursor. Reply cursors are bound to the question and
access is rechecked on every read. Each thread returns at most 100 readable
replies, with its readable accepted answer pinned first; other replies continue
in creation order. The native reader's More replies link preserves the question
page and share token, and works without JavaScript.
