# Design Documents

Focused satellite designs: decisions that are too detailed or change too
frequently for the root `ARCHITECTURE.md`. The **authoritative system design**
— tenancy, identity, access, URL scheme, export, workspace, tracks — is
`docs/SYSTEM_DESIGN.md`, one level up.

## Current Documents

- `adoption-decisions.md`: pinned foundation comparison, remaining adoption
  decisions, and gates before web implementation, auth delivery, and release.
- `conventions.md`: API and persistence conventions — casing (camelCase keys,
  snake-token values, snake_case DB columns via Prisma `@map`) and the
  response envelope.
- `identity-sso.md`: ns-series IAM direction — nsauth built as an IAM system
  (the namestarlit account, "Continue with namestarlit") whose first slice is
  authentication + SSO; the four-pillar scope, the domain-vs-identity
  authorization boundary, and the constraints current auth work must respect.
- `infra-deployment.md`: ns-series deployment — namestarlit VPS, Dokploy
  Stack mode (docker swarm), GHCR images via GitHub Actions, topology-file
  conventions (`compose.yml`, `docker-stack.<env>.yml`), and the
  previews-over-staging environment strategy.
- `transactional-email.md`: Resend provider behind an application adapter,
  backend-owned React Email templates (`packages/email`), PostgreSQL outbox +
  BullMQ worker delivery, signed webhooks, and the better-auth boundary
  (better-auth mints verification/reset tokens; the app only delivers them).
- `observability.md`: implemented API LogTape/Sentry boundary and future runtime telemetry,
  shared Alloy collection of stdout/dependency metrics, the PII allowlist and
  pseudonymous-reference rules, and the request-id foundation already in place.
- [auth-delivery-integration.md](auth-delivery-integration.md): pinned gate #3
  compatibility evidence, enforced profile/deletion boundaries and the implemented
  transactional better-auth delivery and verified email-change integration.

- [web-product-experience.md](web-product-experience.md): first reading
  journeys, recency discovery, unavailable collections, later account flows
  and dormant-save presentation.
- [web-interface-system.md](web-interface-system.md): layouts, components,
  states, accessibility, responsive behavior and browser/API boundaries.
- [web-design-tokens.md](web-design-tokens.md): canonical Tailwind theme
  variables, light palette, typography, spacing and contrast evidence.

The W3 documents define implementation contracts. The first implemented vertical
slice is explore → collection → section/external resource.
The [public hub reading plan](../exec-plans/completed/deliver-public-hub-reading.md)
records the completed, reviewed hub/pretty-URL journey. Status,
account and editing journeys follow separately under adoption gate #2.
