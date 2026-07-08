# Observability

## Direction

Use a managed, OpenTelemetry-compatible observability stack:

- Sentry for exception tracking, release diagnostics, source-mapped errors, and
  browser-specific debugging context.
- Pino JSON logs for the NestJS API and workers.
- OpenTelemetry and OTLP as the portable telemetry boundary for traces and
  metrics.
- Grafana Alloy as the production collector and forwarding layer.
- Grafana Cloud as the initial managed backend:
  - Loki for centralized logs;
  - Tempo for traces;
  - Mimir or Prometheus-compatible storage for metrics;
  - Grafana for dashboards and alerts.

Do not self-host the full observability stack initially. Keep the OTLP boundary
so the backend can change later without rewriting application instrumentation.

This replaces the current API logging (NestJS's default `Logger`), which is the
"no structured logging pipeline" item in the tech-debt tracker. It lands before
the first production release, not during Track W.

## Current Foundation

Two pieces already respect this direction and must not regress:

- `common/middleware/request-id.ts` mints a server-generated, PII-free
  `req_<random>` id per request and **ignores caller-provided `X-Request-Id`**
  (never trusted, reflected, or logged). Externally logged request IDs stay
  API-generated; a future edge-propagated request ID would require an
  authenticated proxy trust boundary and a reviewed replacement policy.
- `common/filters/all-exceptions.filter.ts` already carries the request ID into
  the error envelope; structured logging replaces its ad-hoc log line, not its
  correlation model.

## Unified Trace And Error Model

Treat Sentry and OpenTelemetry as participants in one observability pipeline,
not as independent backend tracing systems.

```txt
Next.js Sentry SDK (Track W3)
  -> browser errors, source maps, and W3C trace-context propagation

NestJS API and workers
  -> OpenTelemetry spans and metrics
  -> Pino JSON logs to standard output
  -> Sentry SDK for sanitized backend exception events

Grafana Alloy
  -> receives OTLP telemetry and collects container logs
  -> forwards traces and metrics to Grafana Cloud
  -> forwards selected OTLP traces to Sentry
  -> forwards Pino/container logs to Grafana Cloud
```

Backend business and infrastructure spans are OpenTelemetry-owned. Do not
duplicate them with Sentry-specific span instrumentation. The Next.js Sentry SDK
propagates W3C `traceparent` context to approved API origins, and the
OpenTelemetry-instrumented API continues the same distributed trace. Backend
exceptions captured by the Sentry SDK should link to the active OpenTelemetry
trace when runtime support permits. Configure the backend Sentry SDK for
exception capture and correlation without exporting a second set of backend
transactions or spans.

Grafana Alloy remains the routing, batching, filtering, redaction, sampling, and
multi-destination layer. Initially: send traces to Grafana Cloud and selected
traces to Sentry; send metrics to Grafana Cloud; keep the Pino/container log path
to Grafana Cloud; send sanitized exception events directly through the Sentry
SDK. Do not send OTLP logs to Sentry initially.

Before relying on backend exception-to-trace correlation, run a compatibility
spike against the pinned Bun, NestJS, Sentry SDK, and OpenTelemetry versions. The
spike must prove: a Next.js browser action propagates approved W3C trace context
to the API; the API and a worker continue and export the trace through Alloy to
Grafana Cloud and Sentry; a sanitized backend exception links to the active
trace; the backend Sentry SDK does not create duplicate transactions or spans;
Pino JSON structure and standard-output shipping remain unchanged; shutdown
flushes bounded telemetry work without delaying termination indefinitely; and
prohibited PII/sensitive fields are removed before any signal leaves the
application.

If exception-to-trace correlation is not compatible with NestJS on Bun, keep
OpenTelemetry traces and Sentry exception tracking separately functional while
preserving trace IDs as approved correlation context. Document the limitation
instead of adding duplicate backend tracing.

## Log Flow

The API writes structured JSON logs to standard output. The deployment runtime
captures standard output and Grafana Alloy forwards logs centrally. The API must
not write rotating log files or synchronously send every log line to an external
vendor during a request. Use human-readable pretty logs only for interactive
local development.

## Required Log Context

External telemetry uses an allowlist. Include:

- `service.name`, environment, release, and runtime version;
- request ID and trace ID;
- pseudonymous `hub_ref` when needed for operational filtering;
- pseudonymous `actor_ref` and selected `entity_ref` (e.g. collection, resource)
  only when needed to debug a workflow;
- opaque `audit_ref` when an authorized operator may need to inspect the internal
  audit record;
- module, operation, duration, outcome, and error class.

Do not send direct hub, user, collection, resource, or other domain-record IDs
to external telemetry systems. Derive external references with a
telemetry-specific keyed HMAC and a type namespace, such as `hub:<id>` or
`actor:<id>`. Keep the key outside observability providers. Use enough output
entropy to avoid collisions, and version the derivation key so references can be
rotated deliberately.

Pseudonymous references make logs and traces searchable without exposing the
immutable UUIDv7 database IDs. They are still protected data and must follow
access-control, retention, and minimization rules. Keep high-cardinality
references out of metric labels.

## PII And Sensitive Data

External logs, traces, metrics, and Sentry events must not contain PII,
credentials, secrets, or sensitive domain data.

Never send:

- names, email addresses, or other contact details;
- passwords, hashes, tokens, cookies, authorization headers, session tokens,
  share tokens, or API keys;
- raw request or response bodies by default;
- collection titles, resource URLs/notes, or other user-authored content;
- direct hub IDs, user IDs, collection IDs, resource IDs, or other domain-record
  IDs — use approved pseudonymous references only when needed;
- SQL parameters or database rows.

Use explicit serializers and redaction rules before emitting logs or telemetry.
Do not attach arbitrary request objects, error context, or user objects to
Sentry. Disable or scrub headers, cookies, request bodies, and query parameters
(the browser-friendly `?s=<share token>` in particular) unless a reviewed
allowlist permits specific fields.

Operational logs should record event shape and outcome, not business payloads.
For example, record `operation=collection.publish`, `outcome=ok`, with a
`hub_ref` and selected `entity_ref` when needed for investigation. Keep the raw
affected hub, collection, and user identifiers in the internal audit record.

## Internal Audit Logs

Sensitive audit records belong in PostgreSQL, protected by hub-aware access
control, retention rules, and audit access logging (the Phase E audit item in
`docs/SYSTEM_DESIGN.md`). Store the information required to
explain who did what, to which entity, when, and why.

When external telemetry needs to correlate with an internal audit record, emit an
opaque random `audit_ref` rather than the database audit-record ID or sensitive
payload. The application resolves `audit_ref` for authorized operators. Do not
derive `audit_ref` from a database ID.

## Initial Metrics

Track:

- API request count, error rate, and latency;
- database latency and pool pressure;
- background-job success, failure, and duration (exports, email delivery);
- publication and share-link activity counts (aggregate, no identifiers);
- email delivery, bounce, complaint, and suppression counts.

## Initial Traces

Trace:

- browser-to-API requests through approved W3C trace propagation;
- incoming API requests;
- database calls where instrumentation is compatible with the Bun runtime;
- background jobs (export generation, email delivery);
- collection-policy resolution on hot read paths;
- publication and share-link acceptance flows.

## Local Development

Default local development uses Pino pretty output. Add an optional
`compose.yml` observability profile when API instrumentation begins so
contributors can inspect correlated local logs, traces, and metrics without
sending development noise to the production backend. Local logs must follow the
same redaction rules as production; development convenience is not a reason to
print secrets or personal data.

## Bun Compatibility

Verify Sentry, Pino, OpenTelemetry instrumentation, trace-context propagation,
exception-to-trace correlation, and exporters against the pinned Bun version
during the first observability integration. If a package is not compatible,
document the exception and preserve structured logging plus the OTLP boundary
where possible.

## References

- [Sentry and OpenTelemetry working together](https://blog.sentry.io/sentry-opentelemetry-work-together/)
- [Sentry with OpenTelemetry](https://docs.sentry.io/concepts/otlp/sentry-with-otel/)
- [Grafana Alloy application observability](https://grafana.com/docs/opentelemetry/collector/grafana-alloy/)
