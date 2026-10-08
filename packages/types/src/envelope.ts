import type { ApiErrorPayload } from "./errors.js";

// The API response envelope. Every endpoint returns exactly one of these
// (see docs/design-docs/conventions.md). Timestamps in payloads are ISO 8601
// strings — the JSON wire format, not the backend's in-memory Date.

export type IsoTimestamp = string;

export interface CursorMeta {
  limit: number;
  nextCursor: string | null;
}

export interface ApiSuccess<T, M = undefined> {
  data: T;
  meta?: M;
}

export interface ApiError {
  error: ApiErrorPayload;
}

export type ApiResponse<T, M = undefined> = ApiSuccess<T, M> | ApiError;

// How a person appears anywhere in the product: their @handle, linking to
// their hub (/h/:hubId). A name appears only on their own hub page, and only
// when they chose "Show my name on my hub"; it is never sent elsewhere.
export interface PersonRef {
  hubId: string;
  handle: string;
}
