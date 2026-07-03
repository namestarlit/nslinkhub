// Opaque keyset-pagination cursors: base64url-encoded JSON. Clients must
// treat cursors as opaque tokens; the payload shape is a server detail.

export function encodeCursor(payload: Record<string, unknown>): string {
  return Buffer.from(JSON.stringify(payload), 'utf8').toString('base64url');
}

export function decodeCursor<T extends Record<string, unknown>>(
  cursor: string,
): T | null {
  try {
    const parsed: unknown = JSON.parse(
      Buffer.from(cursor, 'base64url').toString('utf8'),
    );
    if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
      return parsed as T;
    }
    return null;
  } catch {
    return null;
  }
}
