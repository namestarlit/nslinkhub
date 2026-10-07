// Fetches a public web page's title for a saved link, defensively: the URL is
// user-supplied, so this is an SSRF surface. Only http(s) on default ports,
// only public unicast addresses (checked after DNS and pinned for the
// connection, so a rebinding answer cannot redirect it), manual redirects that
// are re-checked, a short deadline and a small body cap. Any doubt → no title.
import { lookup as dnsLookup } from "node:dns/promises";
import http from "node:http";
import https from "node:https";
import { BlockList, isIP } from "node:net";

const blocked = new BlockList();
for (const [net, prefix] of [
  ["0.0.0.0", 8],
  ["10.0.0.0", 8],
  ["100.64.0.0", 10],
  ["127.0.0.0", 8],
  ["169.254.0.0", 16],
  ["172.16.0.0", 12],
  ["192.0.0.0", 24],
  ["192.0.2.0", 24],
  ["192.168.0.0", 16],
  ["198.18.0.0", 15],
  ["198.51.100.0", 24],
  ["203.0.113.0", 24],
  ["224.0.0.0", 4],
  ["240.0.0.0", 4],
] as const)
  blocked.addSubnet(net, prefix, "ipv4");
for (const [net, prefix] of [
  ["::", 128],
  ["::1", 128],
  ["64:ff9b::", 96],
  ["100::", 64],
  ["2001:db8::", 32],
  ["fc00::", 7],
  ["fe80::", 10],
  ["ff00::", 8],
] as const)
  blocked.addSubnet(net, prefix, "ipv6");

export function isPublicAddress(address: string) {
  // IPv4-mapped IPv6 (::ffff:a.b.c.d) is judged as the IPv4 address it carries.
  const mapped = /^::ffff:(\d{1,3}(?:\.\d{1,3}){3})$/i.exec(address)?.[1];
  const candidate = mapped ?? address;
  const family = isIP(candidate);
  if (!family) return false;
  if (family === 6 && /^::ffff:/i.test(candidate)) return false;
  return !blocked.check(candidate, family === 4 ? "ipv4" : "ipv6");
}

type Lookup = (host: string) => Promise<{ address: string; family: number }[]>;
const defaultLookup: Lookup = (host) => dnsLookup(host, { all: true, verbatim: true });

const entities: Record<string, string> = {
  amp: "&",
  lt: "<",
  gt: ">",
  quot: '"',
  apos: "'",
  nbsp: " ",
  mdash: "—",
  ndash: "–",
  hellip: "…",
  rsquo: "’",
  lsquo: "‘",
  rdquo: "”",
  ldquo: "“",
};
function decode(text: string) {
  return text.replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (match, code: string) => {
    if (code[0] === "#") {
      const point =
        code[1] === "x" || code[1] === "X" ? parseInt(code.slice(2), 16) : Number(code.slice(1));
      return Number.isInteger(point) && point > 0 && point <= 0x10ffff
        ? String.fromCodePoint(point)
        : match;
    }
    return entities[code.toLowerCase()] ?? match;
  });
}

// og:title, then twitter:title, then <title>; whitespace collapsed, ≤255 chars.
export function extractTitle(html: string): string | null {
  const metas = html.match(/<meta\b[^>]*>/gi) ?? [];
  const meta = (name: string) => {
    for (const tag of metas) {
      const key = /\b(?:property|name)\s*=\s*["']([^"']+)["']/i.exec(tag)?.[1];
      if (key?.toLowerCase() !== name) continue;
      const content = /\bcontent\s*=\s*(?:"([^"]*)"|'([^']*)')/i.exec(tag);
      if (content) return content[1] ?? content[2];
    }
    return undefined;
  };
  const raw =
    meta("og:title") ??
    meta("twitter:title") ??
    /<title\b[^>]*>([\s\S]*?)<\/title>/i.exec(html)?.[1];
  return tidy(raw ? decode(raw) : undefined);
}

function tidy(raw: unknown): string | null {
  const title = typeof raw === "string" ? raw.replace(/\s+/g, " ").trim() : "";
  return title ? title.slice(0, 255) : null;
}

// YouTube puts the title far beyond the body cap (~700 KB into the page) but
// publishes an official oEmbed endpoint that answers with a
// small JSON document. Those hosts are asked there instead, with the same
// address, redirect, deadline and size guards.
const oembedProviders: [RegExp, string][] = [
  [
    /^(?:www\.|m\.|music\.)?youtube\.com$|^youtu\.be$/i,
    "https://www.youtube.com/oembed?format=json&url=",
  ],
  [/^(?:www\.|player\.)?vimeo\.com$/i, "https://vimeo.com/api/oembed.json?url="],
];
function oembedEndpoint(url: string): string | null {
  try {
    const host = new URL(url).hostname;
    const provider = oembedProviders.find(([pattern]) => pattern.test(host));
    return provider ? `${provider[1]}${encodeURIComponent(url)}` : null;
  } catch {
    return null;
  }
}

// Outbound title lookups (and the DNS check behind link previews) are on by
// default; LINK_TITLES=off disables them, and tests run offline unless
// LINK_TITLES=on.
export function linkTitlesEnabled() {
  const setting = process.env.LINK_TITLES;
  return setting !== "off" && (process.env.NODE_ENV !== "test" || setting === "on");
}

interface PageTitleOptions {
  timeoutMs?: number;
  maxBytes?: number;
  maxRedirects?: number;
  lookup?: Lookup;
}

export async function fetchPageTitle(
  url: string,
  {
    timeoutMs = 3000,
    maxBytes = 256 * 1024,
    maxRedirects = 3,
    lookup = defaultLookup,
  }: PageTitleOptions = {},
): Promise<string | null> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  const oembed = oembedEndpoint(url);
  try {
    if (oembed) {
      const body = await fetchWithinDeadline(
        oembed,
        controller.signal,
        64 * 1024,
        maxRedirects,
        lookup,
        "json",
      );
      try {
        return body ? tidy(JSON.parse(body).title) : null;
      } catch {
        return null;
      }
    }
    const html = await fetchWithinDeadline(
      url,
      controller.signal,
      maxBytes,
      maxRedirects,
      lookup,
      "html",
    );
    return html ? extractTitle(html) : null;
  } finally {
    clearTimeout(timer);
  }
}

// DNS lookup itself is not cancellable, but expiry releases our wait and no
// late answer can start a connection. The same signal follows every redirect.
function untilAborted<T>(promise: Promise<T>, signal: AbortSignal): Promise<T> {
  return new Promise((resolve, reject) => {
    const abort = () => reject(signal.reason);
    if (signal.aborted) {
      reject(signal.reason);
      return;
    }
    signal.addEventListener("abort", abort, { once: true });
    promise.then(resolve, reject).finally(() => signal.removeEventListener("abort", abort));
  });
}

async function fetchWithinDeadline(
  url: string,
  signal: AbortSignal,
  maxBytes: number,
  maxRedirects: number,
  lookup: Lookup,
  kind: BodyKind,
): Promise<string | null> {
  let target: URL;
  try {
    target = new URL(url);
  } catch {
    return null;
  }
  for (let hop = 0; hop <= maxRedirects; hop++) {
    if (signal.aborted) return null;
    if (!["http:", "https:"].includes(target.protocol) || target.username || target.password)
      return null;
    if (target.port && target.port !== (target.protocol === "https:" ? "443" : "80")) return null;
    const host = target.hostname.replace(/^\[|\]$/g, "");
    let addresses: { address: string; family: number }[];
    try {
      addresses = isIP(host)
        ? [{ address: host, family: isIP(host) }]
        : await untilAborted(lookup(host), signal);
    } catch {
      return null;
    }
    // Every answer must be public; the connection is pinned to the first one.
    if (!addresses.length || !addresses.every((entry) => isPublicAddress(entry.address)))
      return null;
    const pinned = addresses[0];
    if (signal.aborted) return null;
    const result = await request(target, pinned, signal, maxBytes, kind);
    if (!result) return null;
    if (result.location) {
      try {
        target = new URL(result.location, target);
      } catch {
        return null;
      }
      continue;
    }
    return result.body ?? null;
  }
  return null;
}

type BodyKind = "html" | "json";
const accepted: Record<BodyKind, [string, RegExp]> = {
  html: ["text/html,application/xhtml+xml;q=0.9", /text\/html|application\/xhtml\+xml/i],
  json: ["application/json", /application\/(?:json|\+json)|\+json/i],
};

function request(
  target: URL,
  pinned: { address: string; family: number },
  signal: AbortSignal,
  maxBytes: number,
  kind: BodyKind,
): Promise<{ location?: string; body?: string } | null> {
  return new Promise((resolve) => {
    if (signal.aborted) {
      resolve(null);
      return;
    }
    const finish = (result: { location?: string; body?: string } | null) => {
      signal.removeEventListener("abort", abort);
      resolve(signal.aborted ? null : result);
    };
    const abort = () => {
      finish(null);
      req.destroy();
    };
    const client = target.protocol === "https:" ? https : http;
    const req = client.request(
      target,
      {
        method: "GET",
        signal,
        headers: {
          accept: accepted[kind][0],
          "user-agent": "nslinkhub-link-title/1.0 (+title lookup for saved links)",
        },
        // Pin the vetted address; TLS still verifies the original host name.
        lookup: (_host, options, callback) => {
          if ((options as { all?: boolean }).all)
            (callback as (e: null, a: { address: string; family: number }[]) => void)(null, [
              pinned,
            ]);
          else
            (callback as (e: null, a: string, f: number) => void)(
              null,
              pinned.address,
              pinned.family,
            );
        },
      },
      (res) => {
        const status = res.statusCode ?? 0;
        if (status >= 300 && status < 400 && res.headers.location) {
          finish({ location: res.headers.location });
          res.destroy();
          return;
        }
        const type = String(res.headers["content-type"] ?? "");
        if (status !== 200 || !accepted[kind][1].test(type)) {
          finish(null);
          res.destroy();
          return;
        }
        let size = 0;
        const chunks: Buffer[] = [];
        res.on("data", (chunk: Buffer) => {
          chunks.push(chunk.subarray(0, Math.max(0, maxBytes - size)));
          size += chunk.length;
          // The head is enough; stop at the cap or once </head> has arrived.
          if (size >= maxBytes || (kind === "html" && chunk.includes("</head>"))) res.destroy();
        });
        const done = () =>
          finish({ body: Buffer.concat(chunks).subarray(0, maxBytes).toString("utf8") });
        res.on("end", done);
        res.on("close", done);
        res.on("error", () => finish(null));
      },
    );
    signal.addEventListener("abort", abort, { once: true });
    req.on("error", () => finish(null));
    req.end();
  });
}
