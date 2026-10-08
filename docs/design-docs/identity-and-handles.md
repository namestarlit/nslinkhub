# Identity and handles

Status: implemented (web email-change screens pending). Hub identity, the
account's name, passwordless sign-in, email change and the web URL
scheme. Settled in [ADR-0002](../engineering-decisions/0002-immutable-identities.md)
and [ADR-0004](../engineering-decisions/0004-passwordless-email-codes.md).

## Identity

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
  in the existing profile API). It appears only on the person's own hub page,
  as "@handle by Name", when `user.showNameOnHub` is enabled (default true) —
  otherwise the hub is identified by its handle alone; everywhere else —
  collections, comments, contributors, history, notifications, audits — people
  appear by their @handle, and the API never sends the name there. Opting out
  leaves the name a private profile detail. Email is never public attribution.
- **Login direction: code-first, from the get-go.** The primary sign-in is
  Substack-style passwordless — continue with email → enter the emailed code
  (email codes only; no direct authentication links or passwords). There is no
  username. ns-series single sign-on (a centralized IAM) can join later without reshaping
  this. The web presents it as one verification flow (see [email-verification.md](email-verification.md)): a single code field that accepts pasted spaces or
  dashes. Live provider acceptance remains before release. Optional
  TOTP/recovery codes are a later follow-up.
- **Email change** is only ever the same person updating their address — never
  a way to hand over a hub. A hub is never transferred (it is its owner's
  fingerprint); collections are. It is double-verified:
  1. the signed-in owner sets the new email;
  2. a **confirmation** goes to the **current** address, naming the target
     address — nothing changes unless it is confirmed (email code);
  3. on confirmation, a **verification** goes to the **new** address;
  4. on verification the change applies, **all sessions are revoked**, and the
     account signs in with the new email.
  Templates for both steps exist in `packages/email`; the backend workflow is
  documented in `auth-delivery-integration.md`. Web screens and
  live provider acceptance remain outstanding.
- **nsauth SSO** is bounded to users + SSO + profile (no orgs); see
  `identity-sso.md`. Products keep their own userId authoritative and their own
  authorization; the IdP never decides who may edit a collection.

## Web URL scheme

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
hub ID before selecting the owner list endpoint. `/hub` is the signed-in
shortcut to the viewer's own `/h/<hubId>`. Settings provides an explicit `?view=public` preview,
which always uses public queries. This view choice never grants API access.

Rules that keep it drift-proof:

- Collection references navigate directly to `/c/<id>` with no parent context.
- **"Copy link" / share buttons always emit the `/c/<id>` permalink**, never
  the slug URL. Slug URLs are for address bars and link previews only.
- Pretty URLs have exactly a handle and slug. Bare `/handle` paths are unsupported.

## Account deletion (planned)

Self-service, confirmed with an email code. Before deleting, the account is
offered a download of all its collections and prompted to transfer collections
others edit. A 14-day grace period allows changing one's mind; then the hub and
its collections are deleted and the handle released, the person's comments read
"[deleted]", activity entries keep only an anonymous actor, and shares and
follows end.
