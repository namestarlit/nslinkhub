import * as Sentry from "@sentry/bun";
import type { Request, RequestHandler } from "express";
import type { RequestWithId } from "../middleware/request-id";
import { registerRouteTemplate, safeMethod } from "./privacy";
import { emitEvent, telemetryContext } from "./telemetry";

export function requestRoute(request: Request): string {
  // Express's route.path is the server-declared template, not req.path/url or
  // baseUrl (which can contain mounted parameters). All current routes are
  // mounted on the application, including the literal better-auth catch-all.
  const template = request.route?.path;
  return typeof template === "string" ? registerRouteTemplate(template) : "<unmatched>";
}

export const httpTelemetry: RequestHandler = (request, response, next) => {
  const requestId = (request as RequestWithId).requestId;
  const method = safeMethod(request.method);
  const started = performance.now();
  const context: Record<string, unknown> = { "request.id": requestId, "http.method": method };
  Sentry.withIsolationScope((scope) =>
    telemetryContext.run(context, () => {
      let finished = false;
      let span: Sentry.Span | undefined;
      let finishSpan: (() => void) | undefined;
      const complete = (aborted: boolean) => {
        if (finished) return;
        finished = true;
        const route = requestRoute(request);
        const status = response.statusCode;
        const result = aborted
          ? "canceled"
          : status >= 500
            ? "failed"
            : status >= 400
              ? "rejected"
              : "succeeded";
        const fields = {
          ...context,
          "http.route": route,
          "http.status_code": status,
          "http.duration_ms": Math.round((performance.now() - started) * 100) / 100,
          "http.result": result,
          "http.aborted": aborted,
        };
        Sentry.withIsolationScope(scope, () =>
          telemetryContext.run(context, () => {
            try {
              scope.setTags(fields);
              span?.updateName(`${method} ${route}`);
              span?.setAttributes(fields);
              span?.setStatus(
                aborted
                  ? { code: 2, message: "cancelled" }
                  : Sentry.getSpanStatusFromHttpCode(status),
              );
              emitEvent("http.request", fields);
              if (Sentry.isInitialized()) {
                const attributes = {
                  "http.method": method,
                  "http.route": route,
                  "http.status_code": status,
                  "http.result": result,
                  "http.aborted": aborted,
                };
                Sentry.metrics.count("api.http.requests", 1, { attributes });
                Sentry.metrics.distribution("api.http.duration_ms", fields["http.duration_ms"], {
                  attributes,
                  unit: "millisecond",
                });
              }
            } catch {
            } finally {
              finishSpan?.();
            }
          }),
        );
      };
      response.once("finish", () => complete(false));
      response.once("close", () => complete(!response.writableFinished));
      if (!Sentry.isInitialized()) return next();
      Sentry.startSpanManual(
        { name: "http.request", op: "http.server", kind: 1, attributes: { "http.method": method } },
        (active, finish) => {
          span = active;
          finishSpan = finish;
          context["trace.id"] = span.spanContext().traceId;
          scope.setTags(context as Record<string, string>);
          next();
        },
      );
    }),
  );
};
