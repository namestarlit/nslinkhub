import type { ApiErrorPayload } from "./errors.js";

// The API response envelope. Every endpoint returns exactly one of these
// (see docs/design-docs/conventions.md). Timestamps in payloads are ISO 8601
// strings — the JSON wire format, not the backend's in-memory Date.

export type IsoTimestamp = string;

export interface CursorMeta {
  limit: number;
  nextCursor: string | null;
}

export interface EtagMeta {
  etag: string;
}

export interface ApiSuccess<T, M = undefined> {
  data: T;
  meta?: M;
}

export interface ApiError {
  error: ApiErrorPayload;
}

export type ApiResponse<T, M = undefined> = ApiSuccess<T, M> | ApiError;

export function isApiError<T, M>(response: ApiResponse<T, M>): response is ApiError {
  return (response as ApiError).error !== undefined;
}

// How a person appears anywhere in the product: their hub handle always, their
// name only when they chose "Show my name on my hub". Clients link it to /h/:hubId.
export interface PersonRef {
  hubId: string;
  handle: string;
  name: string | null;
}
