import type { Collection, HubPage } from "@nslinkhub/types";
import { notFound } from "next/navigation";
import { CollectionReader } from "../../../components/collection-reader";
import { Feedback } from "../../../components/feedback";
import { failure, prettyPath, queryValue, routeHandle, routeSegment } from "../../../lib/http";
import { serverRead } from "../../../lib/server-api";

export const dynamic = "force-dynamic";
export default async function Page({
  params,
  searchParams,
}: {
  params: Promise<{ handle: string; slug: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const route = await params;
  const segment = routeSegment(route.handle);
  const slug = routeSegment(route.slug);
  if (!segment.startsWith("@")) notFound();
  const handle = routeHandle(segment);
  if (!handle || !/^[a-z0-9-]{2,120}$/.test(slug))
    return <Feedback collection error={failure("not_found", 404)} />;
  // Hub discovery never receives collection access tokens.
  const hub = await serverRead<HubPage>(
    `/api/v1/hubs/by-handle/${encodeURIComponent(handle)}?limit=1`,
  );
  if (!hub.ok) return <Feedback collection error={hub} />;
  const query = await searchParams;
  const token = queryValue(query.s, 512);
  const result = await serverRead<Collection>(
    `/api/v1/hubs/${encodeURIComponent(hub.data.hub.id)}/collections/${encodeURIComponent(slug)}`,
    token,
  );
  if (!result.ok) return <Feedback collection error={result} />;
  const resetPath = prettyPath(handle, slug) + (token ? `?s=${encodeURIComponent(token)}` : "");
  return (
    <CollectionReader
      collection={result.data}
      query={query}
      hub={hub.data.hub}
      resetPath={resetPath}
    />
  );
}
