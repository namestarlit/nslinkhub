// The one share-token transport contract: the x-share-token header, with the
// browser-friendly ?s= query as fallback. Every controller resolves it here.
export function shareTokenFrom(
  headerToken: string | undefined,
  req?: { query: Record<string, unknown> },
): string | undefined {
  return headerToken ?? (req?.query.s as string | undefined);
}
