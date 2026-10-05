import { afterAll, beforeAll, describe, expect, it } from "bun:test";
import type { Server } from "node:http";
import type { LogRecord } from "@logtape/logtape";
import * as Sentry from "@sentry/bun";
import express from "express";
import { telemetryConfig } from "../../config/telemetry";
import { requestIdMiddleware } from "../middleware/request-id";
import { httpTelemetry, requestRoute } from "./http-telemetry";
import { safeErrorEvent, safeProperties } from "./privacy";
import {
  captureFailure,
  emitEvent,
  initializeTelemetry,
  shutdownTelemetry,
  TelemetryNestLogger,
  telemetryContext,
} from "./telemetry";

describe("telemetry privacy boundary", () => {
  it("drops arbitrary context and SDK payloads rather than guessing sensitive words", () => {
    expect(
      safeProperties({
        title: "Private collection",
        "http.route": "/raw-private-handle",
        "request.id": "caller-secret",
        userId: "00000000-0000-0000-0000-000000000000",
      }),
    ).toEqual({ "http.route": "<unmatched>" });
    const result = safeErrorEvent({
      type: undefined,
      message: "private",
      user: { email: "private@example.com" },
      request: { url: "https://example.com/?s=private" },
      extra: { password: "private" },
      breadcrumbs: [{ message: "private" }],
      exception: {
        values: [
          {
            type: "private",
            value: "private",
            stacktrace: {
              frames: [
                { filename: "/home/private/file.ts", vars: { password: "private" }, lineno: 12 },
              ],
            },
          },
        ],
      },
    });
    expect(JSON.stringify(result)).not.toContain("private");
    expect(result.exception?.values?.[0]?.stacktrace?.frames?.[0]?.lineno).toBe(12);
  });

  it("validates telemetry configuration without reflecting values", () => {
    expect(telemetryConfig({})).toEqual({
      environment: "development",
      dsn: undefined,
      release: undefined,
      sampleRate: 0.1,
    });
    for (const env of [
      { SENTRY_DSN: "private-value" },
      { SENTRY_TRACES_SAMPLE_RATE: "2" },
      { SENTRY_TRACES_SAMPLE_RATE: " " },
      { RELEASE_SHA: "private-value" },
    ]) {
      expect(() => telemetryConfig(env)).toThrow();
      try {
        telemetryConfig(env);
      } catch (error) {
        expect(String(error)).not.toContain("private-value");
      }
    }
  });
});

describe("real HTTP telemetry and local Sentry capture", () => {
  const records: LogRecord[] = [];
  const envelopes: string[] = [];
  let capture: ReturnType<typeof Bun.serve>;
  let server: Server;
  let origin: string;

  beforeAll(async () => {
    capture = Bun.serve({
      hostname: "127.0.0.1",
      port: 0,
      async fetch(req) {
        envelopes.push(await req.text());
        return new Response("{}", { headers: { "content-type": "application/json" } });
      },
    });
    await initializeTelemetry(
      { environment: "test", dsn: `http://public@127.0.0.1:${capture.port}/1`, sampleRate: 1 },
      [
        (record) => {
          records.push(record);
        },
        () => {
          throw new Error("sink failure");
        },
      ],
    );
    const app = express();
    app.use(requestIdMiddleware, httpTelemetry);
    app.get("/probe/:id", async (req, res) => {
      await Bun.sleep(Number(req.query.delay ?? 0));
      res.json({ id: telemetryContext.getStore()?.["request.id"] });
    });
    app.get("/fail/:id", (req, res) => {
      Sentry.setUser({ email: "never-export@example.com" });
      Sentry.setExtra("content", "never-export-content");
      captureFailure(new TypeError("never-export-content"), {
        "http.route": requestRoute(req),
        "http.status_code": 500,
      });
      new TelemetryNestLogger().error("never-export-content");
      res.sendStatus(500);
    });
    app.get("/abort/:id", (_req, res) => res.destroy());
    server = app.listen(0, "127.0.0.1");
    await new Promise<void>((resolve) => server.once("listening", resolve));
    const address = server.address();
    if (!address || typeof address === "string") throw new Error("No test listener");
    origin = `http://127.0.0.1:${address.port}`;
  });

  afterAll(async () => {
    await shutdownTelemetry();
    server?.closeAllConnections();
    await new Promise<void>((resolve) => server?.close(() => resolve()));
    await capture?.stop(true);
  });

  it("isolates concurrent IDs, resolves templates, and emits once despite finish/close", async () => {
    const replies = await Promise.all(
      Array.from({ length: 8 }, (_, i) =>
        fetch(`${origin}/probe/never-export-content?delay=${8 - i}&s=never-export-token`, {
          headers: {
            "X-Request-Id": "never-export-caller",
            authorization: "Bearer never-export-token",
          },
        }).then(async (res) => ({
          header: res.headers.get("x-request-id"),
          body: await res.json(),
        })),
      ),
    );
    expect(new Set(replies.map((r) => r.header)).size).toBe(8);
    for (const reply of replies) expect(reply.body.id).toBe(reply.header);
    const events = records.filter((r) => r.rawMessage === "http.request");
    expect(events).toHaveLength(8);
    expect(new Set(events.map((e) => e.properties["trace.id"])).size).toBe(8);
    for (const event of events) expect(event.properties["http.route"]).toBe("/probe/:id");
  });

  it("keeps errors, traces, logs and aborted requests sanitized and deduplicated", async () => {
    expect((await fetch(`${origin}/fail/never-export-content`)).status).toBe(500);
    await fetch(`${origin}/abort/never-export-content`).catch(() => undefined);
    await fetch(`${origin}/never-export-content?s=never-export-token`);
    emitEvent("application.stopped");
    expect(await Sentry.flush(3000)).toBe(true);
    const leakedPaths: string[] = [];
    function inspect(value: unknown, path: string) {
      if (typeof value === "string" && value.includes("never-export")) leakedPaths.push(path);
      else if (value && typeof value === "object")
        for (const [key, child] of Object.entries(value)) inspect(child, `${path}.${key}`);
    }
    inspect(records, "records");
    for (const [index, envelope] of envelopes.entries())
      for (const [line, content] of envelope.split("\n").entries()) {
        try {
          inspect(JSON.parse(content), `envelope.${index}.${line}`);
        } catch {}
      }
    expect(leakedPaths).toEqual([]);
    const errorEnvelopes = envelopes.filter((body) => body.includes('"type":"event"'));
    expect(errorEnvelopes).toHaveLength(1);
    expect(errorEnvelopes[0]).toContain("Unexpected application failure");
    expect(envelopes.some((body) => body.includes('"type":"transaction"'))).toBe(true);
    expect(envelopes.some((body) => body.includes('"type":"log"'))).toBe(true);
    const events = records.filter((r) => r.rawMessage === "http.request");
    // Bun may retry an idempotent GET after a socket reset. Every attempt is
    // a distinct incoming request, and each must emit exactly once.
    const abortedEvents = events.filter((r) => r.properties["http.aborted"]);
    expect(abortedEvents.length).toBeGreaterThan(0);
    expect(events).toHaveLength(10 + abortedEvents.length);
    expect(new Set(events.map((r) => r.properties["request.id"])).size).toBe(events.length);
    expect(events.at(-1)?.properties["http.route"]).toBe("<unmatched>");
    const failure = events.find((r) => r.properties["http.status_code"] === 500);
    expect(errorEnvelopes[0]).toContain(String(failure?.properties["request.id"]));
    expect(errorEnvelopes[0]).toContain(String(failure?.properties["trace.id"]));
  });

  it("serves requests during a collector outage and bounds the final flush", async () => {
    await capture.stop(true);
    const response = await fetch(`${origin}/probe/outage`);
    expect(response.status).toBe(200);
    const started = performance.now();
    await shutdownTelemetry(200);
    expect(performance.now() - started).toBeLessThan(1500);
  });
});
