import { AsyncLocalStorage } from "node:async_hooks";
import {
  configure,
  dispose,
  getConsoleSink,
  getJsonLinesFormatter,
  getLogfmtFormatter,
  getLogger,
  type Sink,
} from "@logtape/logtape";
import { getSentrySink } from "@logtape/sentry";
import type { LoggerService } from "@nestjs/common";
import * as Sentry from "@sentry/bun";
import { type TelemetryConfig, telemetryConfig } from "../../config/telemetry";
import {
  errorClass,
  eventNames,
  safeErrorEvent,
  safeProperties,
  safeRecord,
  safeSpan,
  safeTransaction,
} from "./privacy";

export const telemetryContext = new AsyncLocalStorage<Record<string, unknown>>();
let initialization: Promise<void> | undefined;
let runtimeProperties: Record<string, unknown> = { "service.name": "api" };

export function initializeTelemetry(
  config: TelemetryConfig = telemetryConfig(),
  testSinks?: Sink[],
): Promise<void> {
  initialization ??= (async () => {
    runtimeProperties = {
      "service.name": "api",
      environment: config.environment,
      release: config.release,
    };
    if (config.dsn)
      Sentry.init({
        dsn: config.dsn,
        environment: config.environment,
        release: config.release,
        sendDefaultPii: false,
        enableLogs: true,
        tracesSampleRate: config.sampleRate,
        // Manual spans only. No console/body/SQL/URL auto-capture, no duplicate
        // incoming span. Process failures are handled by the entrypoint.
        defaultIntegrations: false,
        beforeSend: safeErrorEvent,
        beforeSendTransaction: safeTransaction,
        beforeSendSpan: safeSpan,
        beforeSendLog: (log) =>
          eventNames.has(String(log.message))
            ? {
                ...log,
                message: String(log.message),
                attributes: safeProperties(log.attributes ?? {}),
              }
            : null,
        beforeSendMetric: (metric) => {
          if (!["api.http.requests", "api.http.duration_ms"].includes(metric.name)) return null;
          const attributes = safeProperties(metric.attributes ?? {});
          // SDK metrics also inherit user/scope attributes. Keep only bounded
          // dimensions; request and trace IDs belong in correlation metadata.
          return {
            ...metric,
            attributes: Object.fromEntries(
              Object.entries(attributes).filter(
                ([key]) => key.startsWith("http.") && key !== "http.duration_ms",
              ),
            ),
          };
        },
      });
    const sinks = testSinks ?? [
      getConsoleSink({
        formatter:
          config.environment === "development"
            ? getLogfmtFormatter({ timeZone: null })
            : getJsonLinesFormatter({ properties: "flatten" }),
      }),
    ];
    if (config.dsn)
      sinks.push(
        getSentrySink({
          // LogTape sends structured logs only. The exception boundary owns issues,
          // so an error-level completion log cannot create a second issue.
          sentry: { ...Sentry, captureMessage: () => "", captureException: () => "" },
          logs: { level: "info" },
          breadcrumbs: false,
        }),
      );
    const wrapped = Object.fromEntries(
      sinks.map((sink, i) => [
        String(i),
        ((record) => {
          try {
            sink(safeRecord(record));
          } catch {
            /* Telemetry is never an application failure. */
          }
        }) satisfies Sink,
      ]),
    );
    await configure({
      reset: true,
      sinks: wrapped,
      contextLocalStorage: telemetryContext,
      loggers: [
        { category: ["api"], lowestLevel: "info", sinks: Object.keys(wrapped) },
        { category: ["logtape", "meta"], lowestLevel: null, sinks: [] },
      ],
    });
  })();
  return initialization;
}

export function emitEvent(
  event: string,
  properties: Record<string, unknown> = {},
  level: "info" | "warn" | "error" = "info",
): void {
  if (!initialization || !eventNames.has(event)) return;
  try {
    getLogger(["api"])[level](
      event,
      safeProperties({ ...runtimeProperties, ...telemetryContext.getStore(), ...properties }),
    );
  } catch {}
}

export function captureFailure(error: unknown, properties: Record<string, unknown> = {}): void {
  const context = safeProperties({
    ...telemetryContext.getStore(),
    ...properties,
    "error.class": errorClass(error),
  });
  try {
    Sentry.withScope((scope) => {
      scope.setTags(context);
      // Capture the original stack only into the SDK's local pipeline; the
      // beforeSend allowlist strips messages, paths, snippets and variables.
      Sentry.captureException(
        error instanceof Error ? error : new Error("Unexpected application failure"),
      );
    });
  } catch {}
}

export async function shutdownTelemetry(timeoutMs = 2000): Promise<boolean> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      Promise.all([Sentry.close(timeoutMs), dispose()]).then(([flushed]) => flushed),
      new Promise<boolean>((resolve) => {
        timer = setTimeout(() => resolve(false), timeoutMs);
      }),
    ]);
  } catch {
    return false;
  } finally {
    if (timer) clearTimeout(timer);
    initialization = undefined;
  }
}

// Nest may include connection strings and arbitrary exception text in any
// overload. Keep only the event class, not message/context/stack parameters.
export class TelemetryNestLogger implements LoggerService {
  log(_message: unknown) {
    emitEvent("nest.log");
  }
  error(_message: unknown) {
    emitEvent("nest.error", {}, "error");
  }
  warn(_message: unknown) {
    emitEvent("nest.warning", {}, "warn");
  }
  debug(_message: unknown) {
    emitEvent("nest.debug");
  }
  verbose(_message: unknown) {
    emitEvent("nest.trace");
  }
}
