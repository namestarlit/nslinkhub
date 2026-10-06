import type { CursorMeta } from "@nslinkhub/types";
import { isApiErrorCode } from "@nslinkhub/types";

export type ApiPath = `/api/v1/${string}`;
export type Failure = { ok: false; code: string; status: number; retryAfter: number };
export type Result<T> = { ok: true; data: T; meta?: CursorMeta } | Failure;

export function failure(code = "unavailable", status = 0, retryAfter = 0): Failure {
  return { ok: false, code, status, retryAfter };
}

export function safePath(path: ApiPath): string {
  const parsed = new URL(path, "http://internal.invalid");
  if (
    parsed.origin !== "http://internal.invalid" ||
    !parsed.pathname.startsWith("/api/v1/") ||
    /[\\\r\n#]/.test(path) ||
    /%2f|%5c/i.test(parsed.pathname)
  )
    throw new Error("Invalid API path");
  return parsed.pathname + parsed.search;
}

export async function readJson<T>(
  url: string,
  options: {
    headers?: HeadersInit;
    timeout: number;
    signal?: AbortSignal;
    fetcher?: typeof fetch;
  },
): Promise<Result<T>> {
  const timeout = AbortSignal.timeout(options.timeout);
  const signal = options.signal ? AbortSignal.any([timeout, options.signal]) : timeout;
  try {
    const response = await (options.fetcher ?? fetch)(url, {
      headers: options.headers,
      signal,
      redirect: "error",
      cache: "no-store",
      credentials: "same-origin",
    });
    const payload = await response.json();
    if (!response.ok) {
      const retry = response.headers.get("retry-after");
      const seconds =
        retry && /^\d+$/.test(retry)
          ? Number(retry)
          : Math.ceil((Date.parse(retry ?? "") - Date.now()) / 1000);
      return failure(
        isApiErrorCode(payload?.error?.code) ? payload.error.code : "unavailable",
        response.status,
        Number.isFinite(seconds) ? Math.max(0, seconds) : 0,
      );
    }
    if (!payload || typeof payload !== "object" || !("data" in payload)) return failure();
    return { ok: true, data: payload.data as T, meta: payload.meta };
  } catch {
    return failure(signal.aborted ? "request_timeout" : "unavailable");
  }
}

export function withCursor(path: ApiPath, cursor?: string | null): ApiPath {
  const url = new URL(path, "http://internal.invalid");
  url.searchParams.set("limit", "20");
  if (cursor) url.searchParams.set("cursor", cursor);
  return safePath((url.pathname + url.search) as ApiPath) as ApiPath;
}
// Only @-prefixed route segments belong to public hubs. The API remains the
// identity and authorization authority after this URL-shape validation.
// Next's dynamic segment payload percent-encodes @. Decode exactly once;
// route validation below still rejects separators and double-encoded input.
export function routeSegment(value: string): string {
  try {
    return decodeURIComponent(value);
  } catch {
    return "";
  }
}
export function routeHandle(segment: string): string | undefined {
  return /^@[a-z0-9-]{3,60}$/.test(segment) ? segment.slice(1) : undefined;
}
export function hubPath(handle: string): string {
  return `/@${encodeURIComponent(handle)}`;
}
export function prettyPath(handle: string, slug: string): string {
  return `${hubPath(handle)}/${encodeURIComponent(slug)}`;
}
export function collectionPath(id: string): ApiPath {
  return `/api/v1/collections/${encodeURIComponent(id)}`;
}
export function permalink(id: string, token?: string): string {
  return `/c/${encodeURIComponent(id)}${token ? `?s=${encodeURIComponent(token)}` : ""}`;
}
export function queryValue(value: string | string[] | undefined, max = 4096): string | undefined {
  return typeof value === "string" && value.length <= max ? value : undefined;
}
export function sessionCookie(raw: string): string {
  return raw
    .split(";")
    .map((v) => v.trim())
    .filter((v) => /^(?:__Secure-)?better-auth\.session_token=[^;\r\n]+$/.test(v))
    .join("; ");
}
