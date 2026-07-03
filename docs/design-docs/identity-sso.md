# Identity & SSO Direction (ns series)

Direction document, recorded 2026-07-03. Not scheduled work — this shapes how
NSLinkHub's auth must stay structured so the later centralization is an
integration, not a rewrite.

## Naming (resolved 2026-07-03)

The ns series consists of **personal projects** belonging to the author's
personal brand — they have no company affiliation.

The consumer-facing account brand is **namestarlit** — always lowercase, as a
wordmark, even at the start of a sentence. It is the author's personal brand:
the username on all social platforms and the domain namestarlit.com. (The
etymology — "name is starlit" — is trivia now, the way facebook stopped being
a book of faces.) The button reads **"Continue with namestarlit"** and the
account is a **namestarlit account**.
Rationale: the ns prefix in every product name already points at namestarlit —
it is the publisher umbrella, which is exactly what "Meta account" is to Meta
products: the publisher brand, not any single product (rejected: branding
identity as NSLinkHub would read oddly on nsworklog, inherit product renames,
and clash with "hubs" being a concept inside the product).

**nsauth** remains the internal working name for the service/repo. Branding
stays configurable, so the label lives in configuration and copy — never in
schemas, contracts, or operational identifiers.

## The Goal

The ns series (namestarlit products — solutions to the author's own problems,
published for others) will multiply, and every product needs auth. The known
consumers so far: **nslinkhub** (this repo) and **nsworklog**
(github.com/namestarlit/nsworklog — a work-logging tool for documenting daily
work for future reference; Flask-era today, same modernization candidate).
Instead of each product owning credentials:

- One self-hosted identity service — **nsauth** — owns credentials, and every
  ns product offers **"Continue with namestarlit"**.
- **SSO authenticates identity; it does not enroll.** Unlike Google (where a
  Google account implicitly belongs to every Google service), a namestarlit
  account grants membership to nothing. Each product runs its own explicit
  sign-up the first time a user continues into it; users opt in per product
  and can leave per product.
- Account management follows **Meta's Accounts Center philosophy, not
  Google's full account console**: one lightweight central place for shared
  concerns — credentials, password, MFA, active sessions, basic profile
  (name, avatar, email), and a "connected services" list with revocation.
  Everything product-specific (hubs, collections, worklogs, settings, data)
  stays in the product. The center manages the account, never the products.

## The Shape

```txt
nsauth (its own repo/product, later)
  self-hosted better-auth acting as an OpenID Connect Provider
  owns: credentials, MFA, recovery, identity sessions, consent,
        the Accounts-Center surface

ns products (nslinkhub, nsworklog, future ns*)
  OIDC relying parties: the "Continue with namestarlit" button
  own: product user record, product sessions, authorization
       (hubs/memberships/shares), onboarding (e.g. personal hub),
       all product data
```

Rules, consistent with the decisions already adopted from pigfarm
(`docs/design-docs/hub-architecture.md`, `pigfarm/docs/design-docs/auth-sessions.md`):

1. **Products keep their own immutable userId.** The nsauth subject (`sub`)
   is stored as a one-to-one linked identity on the product user — never as
   the product's primary key, never in product FKs. Same principle as
   "usernames are mutable attributes": external identity is an attribute of
   product identity, not the identity itself.
2. **First SSO continue = product sign-up.** The product creates its user
   record + runs onboarding (personal hub, etc.) only after the user
   completes that product's sign-up step. No silent enrollment, mirroring the
   hub-invitation principle: never attach a user to anything implicitly.
3. **Products keep their own sessions.** The IdP authenticates; the product
   issues its own session/bearer afterwards (better-auth on the product side
   already does this). Product logout ≠ identity logout; the Accounts Center
   is where identity-wide session revocation lives.
4. **Authorization never centralizes.** Roles, memberships, shares, and
   policy are product-owned. The IdP knows who you are, not what you may do
   in a product.
5. **Account linking is explicit.** If a product user already exists with the
   same verified email (e.g. NSLinkHub's current local accounts), SSO sign-in
   links to it only through verified-email match or an explicit authenticated
   linking step — no duplicate identities, no silent takeover.

## Implementation Candidates (verify in a spike, pigfarm-style adoption gate)

better-auth is already the auth dependency on both sides, and has plugins for
both roles:

- IdP side: better-auth **OIDC Provider plugin** (nsauth issues authorization
  codes / ID tokens; consent screen = the per-product opt-in).
- Product side: better-auth **generic OAuth / SSO plugins** register nsauth
  as a provider next to the existing email+password.

Before committing, run a focused spike proving: the provider plugin's
maturity, PKCE + refresh behavior, account-linking flow with existing local
users, bearer-token behavior for the extension, and that the product-side
integration preserves the existing NestJS pipeline (the same gate pigfarm
imposes on auth adoption). The plugin landscape moves — re-verify versions at
implementation time rather than trusting this document.

## What This Means For NSLinkHub Now

Nothing blocks the hub upgrade, and nothing should be built for SSO yet — but
three cheap constraints keep the door open:

1. Keep session resolution behind the existing single point
   (`resolveSessionUser` in `src/common/guards/auth.guard.ts`); services and
   controllers must keep consuming `AuthUser`, never better-auth types.
2. Keep the product userId authoritative everywhere (already decision 1 of
   the hub plan) so a linked nsauth `sub` slots in as just another mutable
   attribute of the user row.
3. Treat NSLinkHub's local email+password as a first-class citizen that later
   *coexists* with the SSO button — do not weld flows to the assumption that
   local credentials are the only path (e.g. keep sign-up onboarding —
   personal hub creation — in an app-owned service callable from any auth
   path, not hard-wired to one better-auth hook).

When nsauth exists, NSLinkHub's integration is: add the provider button, map
`sub` → existing user by verified email or linking step, run the same
onboarding for new users. The hub/collection model is untouched.
