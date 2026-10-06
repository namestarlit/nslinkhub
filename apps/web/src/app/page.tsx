import type { Collection } from "@nslinkhub/types";
import { Feedback } from "../components/feedback";
import { PaginatedList } from "../components/paginated-list";
import { queryValue, withCursor } from "../lib/http";
import { serverRead } from "../lib/server-api";

export const dynamic = "force-dynamic";
async function Explore({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const cursor = queryValue((await searchParams).cursor);
  const result = await serverRead<Collection[]>(withCursor("/api/v1/explore", cursor));
  if (!result.ok) return <Feedback error={result} />;
  return (
    <section data-reader className="reader">
      <div className="page-heading">
        <h1>Explore collections</h1>
        <p>Useful links, collected and shared. Browse recently updated collections.</p>
      </div>
      <PaginatedList
        kind="collections"
        path="/api/v1/explore"
        initial={result.data}
        nextCursor={result.meta?.nextCursor}
      />
    </section>
  );
}
export default function Page(props: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  return Explore(props);
}
