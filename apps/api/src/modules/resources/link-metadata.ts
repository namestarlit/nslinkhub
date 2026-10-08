import type { Prisma } from "src/generated/prisma/client";

// Page metadata for public web addresses, one row per canonical address,
// shared by every item that links to it. A pending row is the durable lookup
// job: written inside the save's transaction (the outbox shape), relayed and
// claimed by the worker (`link-metadata-lookup.ts`). Text only — never images.

export interface LinkMeta {
  title: string | null;
  description: string | null;
  siteName: string | null;
}
const empty: LinkMeta = { title: null, description: null, siteName: null };

/** Ready metadata is looked up again when read after this long. */
export const METADATA_REFRESH_MS = 30 * 86400_000;
/** A failed lookup becomes due again this long after giving up. */
export const FAILED_RETRY_MS = 86400_000;

const retryNow = () => ({ state: "pending", attempts: 0, availableAt: new Date() });

type Db = Pick<Prisma.TransactionClient, "linkMetadata">;

// Called inside the saving transaction: a lookup is requested for every new
// address; one whose earlier lookup failed is tried again (saving it is a
// fresh signal); ready or pending addresses are left alone.
export async function requestLinkMetadata(db: Db, urls: string[]) {
  const unique = [...new Set(urls)];
  if (!unique.length) return;
  await db.linkMetadata.createMany({ data: unique.map((url) => ({ url })), skipDuplicates: true });
  await db.linkMetadata.updateMany({
    where: { url: { in: unique }, state: "failed" },
    data: retryNow(),
  });
}

// Stored metadata for a page of items, plus a nudge for what's missing or
// stale: addresses saved before lookups existed, ready metadata not refreshed
// for 30 days, and failed lookups older than a day (a site that was down).
// The nudge only marks rows pending; the worker does the fetching.
export async function readLinkMetadata(db: Db, urls: string[]): Promise<Map<string, LinkMeta>> {
  const unique = [...new Set(urls)];
  const found = new Map<string, LinkMeta>();
  if (!unique.length) return found;
  const rows = await db.linkMetadata.findMany({
    where: { url: { in: unique } },
    select: {
      url: true,
      title: true,
      description: true,
      siteName: true,
      state: true,
      fetchedAt: true,
      availableAt: true,
    },
  });
  const stale: string[] = [];
  const refreshBefore = Date.now() - METADATA_REFRESH_MS;
  for (const row of rows) {
    found.set(row.url, { title: row.title, description: row.description, siteName: row.siteName });
    if (
      (row.state === "ready" && row.fetchedAt && row.fetchedAt.getTime() < refreshBefore) ||
      (row.state === "failed" && row.availableAt.getTime() <= Date.now())
    )
      stale.push(row.url);
  }
  const missing = unique.filter((url) => !found.has(url));
  await requestLinkMetadata(db, missing);
  if (stale.length)
    await db.linkMetadata.updateMany({
      where: { url: { in: stale }, state: { in: ["ready", "failed"] } },
      data: retryNow(),
    });
  return found;
}

export function metadataFor(map: Map<string, LinkMeta>, url: string | null | undefined): LinkMeta {
  return (url && map.get(url)) || empty;
}
