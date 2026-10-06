import type { HubPage } from "@nslinkhub/types";
import { notFound } from "next/navigation";
import { Feedback } from "../../components/feedback";
import { PaginatedList } from "../../components/paginated-list";
import {
  failure,
  hubPath,
  queryValue,
  routeHandle,
  routeSegment,
  withCursor,
} from "../../lib/http";
import { serverRead } from "../../lib/server-api";

export const dynamic = "force-dynamic";
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
  const result = await serverRead<HubPage>(
    withCursor(
      `/api/v1/hubs/by-handle/${encodeURIComponent(handle)}`,
      queryValue((await searchParams).cursor),
    ),
  );
  if (!result.ok) return <Feedback hub error={result} resetPath={hubPath(handle)} />;
  const { hub, collections } = result.data;
  return (
    <section data-reader className="reader">
      <nav className="context" aria-label="Hub context">
        <a href="/">← Explore</a>
      </nav>
      <div className="page-heading">
        <h1>@{hub.handle}</h1>
        {hub.description && <p className="description">{hub.description}</p>}
        <p>Published collections</p>
      </div>
      <PaginatedList
        kind="collections"
        path={`/api/v1/hubs/${encodeURIComponent(hub.id)}`}
        initial={collections}
        nextCursor={result.meta?.nextCursor}
        publicHub={{ handle: hub.handle }}
      />
    </section>
  );
}
