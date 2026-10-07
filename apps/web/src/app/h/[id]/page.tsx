import type { HubPage } from "@nslinkhub/types";
import type { Metadata } from "next";
import { Feedback } from "../../../components/feedback";
import { OwnedHub } from "../../../components/owned-hub";
import { PublicHub } from "../../../components/public-hub";
import { failure, queryValue, withCursor } from "../../../lib/http";
import { serverRead } from "../../../lib/server-api";
import { readOwnProfile } from "../../../lib/session";
import { isUuid } from "../../../lib/validation";

export const dynamic = "force-dynamic";
export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  const result = isUuid(id) ? await serverRead<HubPage>(`/api/v1/hubs/${id}?limit=1`) : null;
  return { title: result?.ok ? result.data.hub.name : "Hub" };
}
export default async function Page({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { id } = await params;
  if (!isUuid(id)) return <Feedback hub error={failure("not_found", 404)} />;
  const query = await searchParams;
  const profile = queryValue(query.view) === "public" ? null : await readOwnProfile();
  if (profile?.hubId === id)
    return <OwnedHub profile={profile} cursor={queryValue(query.cursor)} />;
  const result = await serverRead<HubPage>(
    withCursor(`/api/v1/hubs/${id}`, queryValue(query.cursor)),
  );
  if (!result.ok) return <Feedback hub error={result} resetPath={`/h/${id}`} />;
  return (
    <PublicHub
      data={result.data}
      nextCursor={result.meta?.nextCursor}
      preview={queryValue(query.view) === "public"}
    />
  );
}
