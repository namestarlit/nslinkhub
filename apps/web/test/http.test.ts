import { describe, expect, it } from "bun:test";
import { webServerConfig } from "@nslinkhub/config/web-server";
import { permalink, readJson, safePath, sessionCookie } from "../src/lib/http";

describe("web HTTP boundary", () => {
  it("only forwards session cookies and keeps shared links explicit", () => {
    expect(sessionCookie("other=secret; better-auth.session_token=proof; tracking=secret")).toBe(
      "better-auth.session_token=proof",
    );
    expect(permalink("id")).toBe("/c/id");
    expect(permalink("id", "a&b")).toBe("/c/id?s=a%26b");
  });
  it("refuses upstream URL injection and invalid production origins", () => {
    for (const path of ["//evil.test/api/v1/a", "/api/v1/../../evil", "/api/v1/a\\b"])
      expect(() => safePath(path as `/api/v1/${string}`)).toThrow();
    for (const origin of [
      "https://secret@example.com",
      "https://example.com/path",
      "file:///etc/passwd",
    ])
      expect(() => webServerConfig({ API_INTERNAL_ORIGIN: origin })).toThrow();
    expect(() => webServerConfig({ NODE_ENV: "production" })).toThrow();
  });
  it("bounds body reads, refuses redirects and never reflects remote errors", async () => {
    const server = Bun.serve({
      port: 0,
      fetch(req) {
        const path = new URL(req.url).pathname;
        if (path === "/redirect") return Response.redirect("https://example.com");
        if (path === "/slow")
          return new Response(
            new ReadableStream({
              start(c) {
                c.enqueue(new TextEncoder().encode('{"data":'));
              },
              cancel() {},
            }),
            { headers: { "content-type": "application/json" } },
          );
        return Response.json(
          { error: { code: "made_up", message: "SECRET" } },
          { status: 429, headers: { "Retry-After": "2" } },
        );
      },
    });
    try {
      expect(await readJson(`${server.url}slow`, { timeout: 50 })).toMatchObject({
        ok: false,
        code: "request_timeout",
      });
      expect(await readJson(`${server.url}redirect`, { timeout: 500 })).toMatchObject({
        ok: false,
      });
      const failure = await readJson(`${server.url}error`, { timeout: 500 });
      expect(failure).toMatchObject({ ok: false, code: "unavailable", retryAfter: 2 });
      expect(JSON.stringify(failure)).not.toContain("SECRET");
    } finally {
      await server.stop(true);
    }
  });
});
