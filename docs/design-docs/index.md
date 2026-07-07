# Design Documents

Use focused design documents for decisions that are too detailed or likely to
change too frequently for the root `ARCHITECTURE.md`.

## Current Documents

- `conventions.md`: API and persistence conventions — casing (camelCase keys,
  snake-token values, snake_case DB columns via Prisma `@map`) and the
  response envelope.
- `hub-architecture.md`: the authoritative architecture — the Google-Drive
  individual tenancy model (one hub per user), identity/handles, the
  access/inheritance rules, collections/resources, ownership transfer,
  publication/discovery, workspace, and remaining tracks (W3 web, W4 extension).
- `identity-sso.md`: ns-series IAM direction — nsauth built as an IAM system
  (the namestarlit account, "Continue with namestarlit") whose first slice is
  authentication + SSO; the four-pillar scope, the domain-vs-identity
  authorization boundary, and the constraints current auth work must respect.
- `infra-deployment.md`: ns-series deployment — namestarlit VPS, Dokploy
  Stack mode (docker swarm), GHCR images via GitHub Actions, topology-file
  conventions (`compose.yml`, `docker.stack.<env>.yml`), and the
  previews-over-staging environment strategy.
- `transactional-email.md`: Resend provider behind an application adapter,
  backend-owned React Email templates (`packages/email`), PostgreSQL outbox +
  BullMQ worker delivery, signed webhooks, and the better-auth boundary
  (better-auth mints verification/reset tokens; the app only delivers them).
- `observability.md`: Pino JSON logging, Sentry + OpenTelemetry/OTLP + Grafana
  Alloy → Grafana Cloud, the PII allowlist and pseudonymous-reference rules,
  and the request-id foundation already in place.

## Planned Documents (produced by Track W3's design pass)

- `web-product-experience.md`: web users, jobs, product feeling, hierarchy,
  and first journeys.
- `web-interface-system.md`: visual tokens, layouts, components, states,
  accessibility, and responsiveness.
- `web-design-tokens.md`: canonical Tailwind theme token contract.
