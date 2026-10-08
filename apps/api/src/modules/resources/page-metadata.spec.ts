import { describe, expect, it, spyOn } from "bun:test";
import http from "node:http";
import { extractMetadata, fetchPageMetadata, isPublicAddress } from "./page-metadata";

describe("page metadata for saved links", () => {
  it("prefers og:title, then twitter:title, then <title>, decoded and collapsed", () => {
    expect(
      extractMetadata(
        `<head><title>Fallback</title><meta content="Open &amp; Graph" property="og:title"></head>`,
      ).title,
    ).toBe("Open & Graph");
    expect(extractMetadata(`<meta name='twitter:title' content='Card title'>`).title).toBe(
      "Card title",
    );
    expect(
      extractMetadata("<title>\n  Practical  Typography &#8212; Butterick\n</title>").title,
    ).toBe("Practical Typography — Butterick");
    expect(extractMetadata("<p>No title here</p>").title).toBeNull();
    expect(extractMetadata(`<title>${"x".repeat(400)}</title>`).title?.length).toBe(255);
  });

  it("reads description and site name as text, never images", () => {
    expect(
      extractMetadata(
        `<head><title>T</title><meta name="description" content="Plain">` +
          `<meta property="og:description" content="Graph &amp; more">` +
          `<meta property="og:site_name" content=" MDN  Web Docs ">` +
          `<meta property="og:image" content="https://cdn.example/x.png"></head>`,
      ),
    ).toEqual({ title: "T", description: "Graph & more", siteName: "MDN Web Docs" });
    expect(extractMetadata(`<meta name="description" content="Fallback">`).description).toBe(
      "Fallback",
    );
    expect(extractMetadata(`<meta name="application-name" content="App">`).siteName).toBe("App");
    expect(
      extractMetadata(`<meta name="description" content="${"d".repeat(900)}">`).description?.length,
    ).toBe(500);
    expect(extractMetadata("<p>nothing</p>")).toEqual({
      title: null,
      description: null,
      siteName: null,
    });
  });

  it("only treats public unicast addresses as reachable", () => {
    for (const address of [
      "127.0.0.1",
      "10.1.2.3",
      "172.20.0.1",
      "192.168.1.1",
      "169.254.169.254",
      "100.64.0.1",
      "0.0.0.0",
      "::1",
      "fd00::1",
      "fe80::1",
      "::ffff:127.0.0.1",
      "not-an-ip",
    ])
      expect(isPublicAddress(address)).toBe(false);
    for (const address of ["93.184.216.34", "1.1.1.1", "2606:4700:4700::1111"])
      expect(isPublicAddress(address)).toBe(true);
  });

  it("refuses private targets, rebinding answers, odd ports and non-http schemes without connecting", async () => {
    let lookups = 0;
    const lookup = async () => {
      lookups++;
      return [
        { address: "93.184.216.34", family: 4 },
        { address: "127.0.0.1", family: 4 },
      ];
    };
    expect(await fetchPageMetadata("http://127.0.0.1/", { lookup })).toBeNull();
    expect(await fetchPageMetadata("http://[::1]/", { lookup })).toBeNull();
    expect(await fetchPageMetadata("http://metadata.internal/", { lookup })).toBeNull();
    expect(lookups).toBe(1);
    expect(await fetchPageMetadata("http://example.com:8080/", { lookup })).toBeNull();
    expect(await fetchPageMetadata("ftp://example.com/", { lookup })).toBeNull();
    expect(await fetchPageMetadata("http://user:pass@example.com/", { lookup })).toBeNull();
    expect(lookups).toBe(1);
  });
});

it("ends a stalled DNS lookup without starting a request after expiry", async () => {
  let release: (addresses: { address: string; family: number }[]) => void = () => {};
  const pending = new Promise<{ address: string; family: number }[]>((resolve) => {
    release = resolve;
  });
  const requestSpy = spyOn(http, "request");
  try {
    const start = Date.now();
    expect(
      await fetchPageMetadata("http://public.example/", { timeoutMs: 40, lookup: () => pending }),
    ).toBeNull();
    expect(Date.now() - start).toBeLessThan(500);
    release([{ address: "93.184.216.34", family: 4 }]);
    await Bun.sleep(20);
    expect(requestSpy).not.toHaveBeenCalled();
  } finally {
    requestSpy.mockRestore();
  }
});

it("aborts a streaming socket at a single deadline across redirects", async () => {
  const sockets = new Set<import("node:net").Socket>();
  const server = http.createServer((req, res) => {
    if (req.url === "/redirect") {
      setTimeout(() => {
        if (!res.destroyed) {
          res.writeHead(302, { location: "/slow" });
          res.write("redirect body that never ends");
        }
      }, 50);
      return;
    }
    res.writeHead(200, { "content-type": "text/html" });
    res.write("<head><title>Unfinished</title>");
    const interval = setInterval(() => res.write(" "), 10);
    res.on("close", () => clearInterval(interval));
  });
  server.on("connection", (socket) => {
    sockets.add(socket);
    socket.on("close", () => sockets.delete(socket));
  });
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const address = server.address();
  if (!address || typeof address === "string") throw new Error("Missing listener");
  const original = http.request;
  // Redirect only the transport to a loopback fixture after SSRF validation.
  const requestSpy = spyOn(http, "request").mockImplementation(((
    target: URL,
    options: http.RequestOptions,
    callback: (res: http.IncomingMessage) => void,
  ) =>
    original(
      {
        ...options,
        hostname: "127.0.0.1",
        port: address.port,
        path: target.pathname,
        lookup: undefined,
      },
      callback,
    )) as typeof http.request);
  try {
    const start = Date.now();
    expect(
      await fetchPageMetadata("http://public.example/redirect", {
        timeoutMs: 140,
        lookup: async () => [{ address: "93.184.216.34", family: 4 }],
      }),
    ).toBeNull();
    expect(Date.now() - start).toBeLessThan(400);
    await Bun.sleep(30);
    expect(sockets.size).toBe(0);
    expect(requestSpy).toHaveBeenCalledTimes(2);
  } finally {
    requestSpy.mockRestore();
    for (const socket of sockets) socket.destroy();
    await new Promise<void>((resolve) => server.close(() => resolve()));
  }
});
