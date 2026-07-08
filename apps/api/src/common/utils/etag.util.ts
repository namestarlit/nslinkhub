import type { Request, Response } from "express";

export function toVersionEtag(version: number | string) {
  return `W/"v${String(version)}"`;
}

// Conditional-GET handling shared by every ETag-bearing read: sets the
// validator headers and answers whether the caller should reply 304 (the
// response status is already set when it returns true).
export function conditionalGetHit(
  req: Request | undefined,
  res: Response | undefined,
  etag: string,
  lastModified: string,
): boolean {
  if (res) {
    res.setHeader("ETag", etag);
    res.setHeader("Last-Modified", lastModified);
  }

  const header = req?.headers["if-none-match"];
  const value = Array.isArray(header) ? header.join(",") : header;
  if (ifNoneMatchHit(value, etag) && res) {
    res.status(304);
    return true;
  }
  return false;
}

export function ifNoneMatchHit(headerValue: string | undefined, etag: string) {
  if (!headerValue) {
    return false;
  }

  if (headerValue.trim() === "*") {
    return true;
  }

  return headerValue
    .split(",")
    .map((value) => value.trim())
    .includes(etag);
}

export function parseIfMatchVersion(headerValue: string | undefined) {
  if (!headerValue) {
    return null;
  }

  const trimmed = headerValue.trim();
  const versionTagMatch = trimmed.match(/v(\d+)/);
  if (versionTagMatch) {
    return Number(versionTagMatch[1]);
  }

  const numericMatch = trimmed.match(/(\d+)/);
  if (numericMatch) {
    return Number(numericMatch[1]);
  }

  return null;
}
