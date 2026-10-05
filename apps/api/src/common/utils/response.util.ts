import type { ApiSuccess } from "@nslinkhub/types";

export function apiOk<T, M = undefined>(data: T, meta?: M): ApiSuccess<T, M> {
  return { data, ...(meta ? { meta } : {}) };
}
