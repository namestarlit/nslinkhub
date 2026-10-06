import { createHmac } from "node:crypto";
import type { IncomingMessage } from "node:http";
import proxyaddr from "proxy-addr";

// Resolve from the socket toward the client, stopping at the first untrusted
// hop. Never accept an arbitrary leftmost forwarding header as the source.
export function sourceAttribution(secret: string, proxies: string[]) {
  const trust = proxyaddr.compile(proxies);
  return (request: IncomingMessage, now = Date.now()) => {
    const source = proxyaddr(request, trust);
    const payload = Buffer.from(JSON.stringify([1, source, now])).toString("base64url");
    const signature = createHmac("sha256", secret)
      .update(`web-read-source:${payload}`)
      .digest("base64url");
    return `${payload}.${signature}`;
  };
}
