import type { Collection } from "@nslinkhub/types";
import { CollectionReader } from "../../../components/collection-reader";
import { Feedback } from "../../../components/feedback";
import { collectionPath, failure, queryValue } from "../../../lib/http";
import { serverRead } from "../../../lib/server-api";

export const dynamic = "force-dynamic";
export default async function Page({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { id } = await params;
  if (!/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i.test(id))
    return <Feedback collection error={failure("not_found", 404)} />;
  const query = await searchParams;
  const result = await serverRead<Collection>(collectionPath(id), queryValue(query.s, 512));
  if (!result.ok) return <Feedback collection error={result} />;
  return <CollectionReader collection={result.data} query={query} />;
}
