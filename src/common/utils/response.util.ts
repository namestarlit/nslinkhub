export type ApiMeta = Record<string, unknown>;

export function apiOk<T>(data: T, meta?: ApiMeta) {
  return {
    data,
    ...(meta ? { meta } : {}),
  };
}
