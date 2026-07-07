# Identity & Access Management Direction (ns series) — nsauth

Direction document, recorded 2026-07-03; reframed toward IAM foundations
2026-07-04. Not scheduled work — this shapes how NSLinkHub's auth must stay
structured so the later centralization is an integration, not a rewrite.

## Framing: build an IAM, ship an auth slice

**nsauth is an IAM (Identity & Access Management) system, not merely a login
service.** Its first implementation will ship only the authentication + SSO
slice — "Continue with namestarlit" across ns products — but the data model,
service boundaries, and contracts are designed for the full IAM scope from the
start, so richer authorization, organization support, and identity federation
are later *upgrades*, never a redesign.

Why commit to IAM framing now, before needing most of it:

- A login service that stores users, authenticates them, supports SSO, issues
  tokens, manages roles/permissions, and federates external identity providers
  *is* an IAM — teams just call it an "auth service" because they start with
  the authentication corner (Keycloak, Auth0, Okta are IAM platforms used
  mostly for AuthN + SSO). Designing as IAM from the outset avoids the rewrite
  when the other corners are needed.
- The experience transfers. The ns series is the author's personal proving
  ground for distributed-systems patterns that later carry into company
  products; an IAM foundation is worth getting right once and reusing.

The four IAM pillars, and what ships when:

```txt
IAM (nsauth)
├── Authentication            ── FIRST SLICE
│   ├── Login (email+password today; namestarlit account)
│   ├── MFA                   ── foundation now, enable later
│   └── SSO / OIDC            ── FIRST SLICE (the button)
├── Authorization             ── foundation now, mostly later
│   ├── Global roles          (e.g. platform-admin) — identity-scoped only
│   ├── Permissions           — coarse, cross-product
│   └── Policies              — optional policy-query surface
├── Identity Management       ── FIRST SLICE (basics) + foundation
│   ├── Users                 (global identity, immutable subject)
│   ├── Groups                ── foundation now, later
│   └── Service accounts      ── foundation now, later
└── Federation                ── foundation now, later
    ├── Google
    ├── Microsoft
    └── GitHub
```

"Foundation now" means: the schema and boundaries leave room for it (no
assumptions that block it), even though no feature ships yet. It does **not**
mean building it.

### ns-series scope: users + SSO, deliberately bounded (resolved 2026-07-04)

The IAM lens above earns the boundary discipline and the personal/company
split — but the ns series' *realized* ambition is intentionally small. **The ns
products are for individuals** (they solve the author's own problems, with
individual-level impact), so nsauth only ever needs **users, SSO, profile, and
MFA** — the Authentication + Identity(users) + SSO/federated-login corners. It
does **not** model **organizations, tenants, or business entities**; the
Authorization(orgs), Groups, and Service-Accounts pillars are the **company**
path (hashikome / Zitadel — see `pigfarm/ref/note-from-nslinkhub-iam-direction.md`),
not the ns path. This is exactly why the ns IdP is Better-Auth (light) and the
company IdP is Zitadel (org-first-class): matching the tool to the realized
scope, not the theoretical ceiling.

Two consequences:

- **Product-level authorization stays in the product.** NSLinkHub is a
  Google-Drive model: one hub (space) per user, no memberships or hub roles;
  collaboration is per-collection reader/editor sharing owned by the product's
  authorization — *not* organizations, and *not* something nsauth models. "No
  orgs" at the IdP is consistent with the product having no shared tenants at
  all.
- **Cross-service identity propagation is webhook-shaped, not broker-shaped.**
  The rare signals a product needs from nsauth — account disabled/deleted,
  email changed, identity-wide logout — are a handful of low-frequency HTTP
  callbacks, not an event stream. So the ns series very likely **never needs a
  message broker** (NATS is a company/pigfarm concern); intra-product async
  stays on the existing job queue (BullMQ/Redis).

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
published for others) will multiply, and every product needs identity. The
known consumers so far: **nslinkhub** (this repo) and **nsworklog**
(github.com/namestarlit/nsworklog — a work-logging tool; Flask-era today, same
modernization candidate). Instead of each product owning credentials:

- One self-hosted IAM — **nsauth** — owns identity and credentials, and every
  ns product offers **"Continue with namestarlit"**.
- **SSO authenticates identity; it does not enroll.** Unlike Google (where a
  Google account implicitly belongs to every Google service), a namestarlit
  account grants membership to nothing. Each product runs its own explicit
  sign-up the first time a user continues into it; users opt in per product
  and can leave per product.
- Account management follows **Meta's Accounts Center philosophy, not
  Google's full account console**: one lightweight central place for shared
  concerns — credentials, password, MFA, active sessions, basic profile
  (name, avatar, email), federated logins, and a "connected services" list
  with revocation. Everything product-specific (hubs, collections, worklogs,
  settings, data) stays in the product. The center manages the account, never
  the products.

## The Shape

```txt
nsauth (its own repo/product, later) — the IAM / Identity Provider
  self-hosted better-auth acting as an OpenID Connect Provider (the AuthN+SSO
  slice of a larger IAM)
  owns: identity (users, subject), credentials, MFA, recovery, identity
        sessions, consent, the Accounts-Center surface
  foundation for: groups, service accounts, global roles, federation, an
        optional policy-query surface

ns products (nslinkhub, nsworklog, future ns*)
  OIDC relying parties: the "Continue with namestarlit" button
  own: product user record, product sessions, DOMAIN authorization
       (hubs/memberships/shares/collection policy), onboarding (e.g. personal
       hub), all product data
```

Token-trust architecture (standard IAM/microservices pattern, to grow into):

```txt
        +-----------------------------+
        |  nsauth (IAM / IdP)         |
        |  AuthN · SSO · MFA          |
        |  identity · groups · roles  |
        |  OIDC / OAuth2              |
        +--------------+--------------+
                       | signed token (identity + coarse claims)
        +--------------+--------------+
        |              |              |
   nslinkhub       nsworklog      future ns*
   (trusts token; makes DOMAIN authorization decisions from claims,
    or consults a policy surface if it ever chooses to delegate)
```

Each product trusts nsauth to authenticate and to issue signed tokens, then
uses the claims (or its own domain data) to authorize. Fine-grained decisions
stay in the product; nsauth provides identity and coarse, identity-scoped
claims.

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
4. **Domain authorization never centralizes; identity-scoped authorization
   may.** Roles, memberships, shares, and collection policy that are *about a
   product's domain* (nslinkhub's hubs) stay product-owned — the IdP never
   decides who may edit a collection. What nsauth *may* own, as it grows, is
   **identity-scoped** authorization: global roles (platform-admin), group
   membership, service accounts, and MFA policy, delivered as signed-token
   claims (or an optional policy-query endpoint a product can choose to
   consult). The grain is the boundary: coarse and cross-product → IAM;
   fine-grained and domain-specific → product.
5. **Account linking is explicit.** If a product user already exists with the
   same verified email (e.g. NSLinkHub's current local accounts), SSO sign-in
   links to it only through verified-email match or an explicit authenticated
   linking step — no duplicate identities, no silent takeover.
6. **Identity Management is first-class, not an afterthought.** Users, and
   later groups and service accounts, are modeled as durable identity objects
   with lifecycle (create, disable, delete, recover) — not implied by the
   existence of credentials. This is what lets "has this account been
   disabled?" and "which service accounts can this microservice use?" be
   answerable later without a schema rewrite.

## Implementation Candidates (verify in a spike, pigfarm-style adoption gate)

better-auth is already the auth dependency on both sides, and covers the
**authentication + SSO slice** of the IAM:

- IdP side: better-auth **OIDC Provider plugin** (nsauth issues authorization
  codes / ID tokens; consent screen = the per-product opt-in).
- Product side: better-auth **generic OAuth / SSO plugins** register nsauth
  as a provider next to the existing email+password.

better-auth is likely sufficient for AuthN, SSO, MFA, and basic identity. The
richer IAM pillars — groups, service accounts, cross-product roles, a policy
surface, broad federation — may exceed what better-auth offers and could want
dedicated modeling or a complementary component in nsauth. Decide that at
nsauth build time; do not pre-build it.

Before committing, run a focused spike proving: the provider plugin's
maturity, PKCE + refresh behavior, account-linking flow with existing local
users, bearer-token behavior for the extension, and that the product-side
integration preserves the existing NestJS pipeline (the same gate pigfarm
imposes on auth adoption). The plugin landscape moves — re-verify versions at
implementation time rather than trusting this document.

## What This Means For NSLinkHub Now

Nothing blocks the hub upgrade or Track W, and nothing should be built for SSO
or IAM yet — but a few cheap constraints keep the door open:

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
4. Keep NSLinkHub's authorization firmly domain-scoped (hub roles,
   `CollectionPolicyService`) so that if nsauth later supplies identity-scoped
   claims (a global platform-admin, say), they augment product decisions
   rather than needing product authorization to be untangled from identity.

When nsauth exists, NSLinkHub's integration is: add the provider button, map
`sub` → existing user by verified email or linking step, run the same
onboarding for new users, and (optionally, later) read identity-scoped claims.
The hub/collection model is untouched.
