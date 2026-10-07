import type { HubPage } from "@nslinkhub/types";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Feedback } from "../../components/feedback";
import { OwnedHub } from "../../components/owned-hub";
import { PublicHub } from "../../components/public-hub";
import {
  failure,
  hubPath,
  queryValue,
  routeHandle,
  routeSegment,
  withCursor,
} from "../../lib/http";
import { serverRead } from "../../lib/server-api";
import { readOwnProfile } from "../../lib/session";

export const dynamic = "force-dynamic";
export async function generateMetadata({
  params,
}: {
  params: Promise<{ handle: string }>;
}): Promise<Metadata> {
  const handle = routeHandle(routeSegment((await params).handle));
  const result = handle
    ? await serverRead<HubPage>(`/api/v1/hubs/by-handle/${encodeURIComponent(handle)}?limit=1`)
    : null;
  return { title: result?.ok ? result.data.hub.name : "Hub" };
}
export default async function Page({
  params,
  searchParams,
}: {
  params: Promise<{ handle: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const segment = routeSegment((await params).handle);
  if (!segment.startsWith("@")) notFound();
  const handle = routeHandle(segment);
  if (!handle) return <Feedback hub error={failure("not_found", 404)} />;
  const query = await searchParams;
  const profile = queryValue(query.view) === "public" ? null : await readOwnProfile();
  const path = `/api/v1/hubs/by-handle/${encodeURIComponent(handle)}` as const;
  // Resolve the immutable identity before applying an owner's list cursor.
  let result = await serverRead<HubPage>(
    withCursor(path, profile ? undefined : queryValue(query.cursor)),
  );
  if (!result.ok) return <Feedback hub error={result} resetPath={hubPath(handle)} />;
  if (profile?.hubId === result.data.hub.id)
    return <OwnedHub profile={profile} cursor={queryValue(query.cursor)} />;
  if (profile && queryValue(query.cursor))
    result = await serverRead<HubPage>(withCursor(path, queryValue(query.cursor)));
  if (!result.ok) return <Feedback hub error={result} resetPath={hubPath(handle)} />;
  return (
    <PublicHub
      data={result.data}
      nextCursor={result.meta?.nextCursor}
      preview={queryValue(query.view) === "public"}
    />
  );
}
