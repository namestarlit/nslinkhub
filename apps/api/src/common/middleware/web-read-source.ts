import { createHmac, timingSafeEqual } from "node:crypto";
import { isIP } from "node:net";

// Only the web connection boundary can mint this short-lived attribution.
// Invalid/absent proofs leave the ordinary socket/trusted-proxy budget intact.
export function verifiedWebReadSource(
  proof: string | undefined,
  secret: string | undefined,
  now = Date.now(),
): string | undefined {
  if (!secret || !proof || proof.length > 512) return;
  const [payload, signature, extra] = proof.split(".");
  if (!payload || !signature || extra !== undefined) return;
  const expected = createHmac("sha256", secret)
    .update(`web-read-source:${payload}`)
    .digest("base64url");
  if (
    Buffer.byteLength(signature) !== Buffer.byteLength(expected) ||
    !timingSafeEqual(Buffer.from(signature), Buffer.from(expected))
  )
    return;
  try {
    const [version, source, issued] = JSON.parse(Buffer.from(payload, "base64url").toString());
    if (
      version === 1 &&
      typeof source === "string" &&
      isIP(source) &&
      Number.isSafeInteger(issued) &&
      issued <= now + 5000 &&
      now - issued <= 30000
    )
      return source;
  } catch {}
}
