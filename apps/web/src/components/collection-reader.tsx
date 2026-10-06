import type { Collection, HubPage, HubSummary, Resource } from "@nslinkhub/types";
import { collectionPath, hubPath, permalink, queryValue, withCursor } from "../lib/http";
import { serverRead } from "../lib/server-api";
import { CopyLink } from "./copy-link";
import { Feedback } from "./feedback";
import { PaginatedList } from "./paginated-list";
import { Tags } from "./primitives";

export async function CollectionReader({
  collection,
  query,
  hub,
  resetPath,
}: {
  collection: Collection;
  query: Record<string, string | string[] | undefined>;
  hub?: HubSummary;
  resetPath?: string;
}) {
  const { id } = collection;
  const path = collectionPath(id);
  const token = queryValue(query.s, 512);
  const [resources, children, parent, hubResult] = await Promise.all([
    serverRead<Resource[]>(withCursor(`${path}/resources`, queryValue(query.cursor)), token),
    serverRead<Collection[]>(`${path}/children`, token),
    collection.parentCollectionId
      ? serverRead<Collection>(collectionPath(collection.parentCollectionId), token)
      : Promise.resolve(null),
    hub?.id === collection.hubId
      ? Promise.resolve({ ok: true as const, data: { hub } })
      : serverRead<HubPage>(`/api/v1/hubs/${encodeURIComponent(collection.hubId)}?limit=1`),
  ]);
  if (!resources.ok)
    return <Feedback collection error={resources} resetPath={resetPath ?? permalink(id, token)} />;
  // A concurrent revocation must not leave the formerly authorized title visible.
  if (!children.ok && [401, 403, 404].includes(children.status))
    return <Feedback collection error={children} />;
  const titles = Object.fromEntries(
    children.ok ? children.data.map((child) => [child.id, child.title]) : [],
  );
  return (
    <article className="reader" data-reader>
      <nav className="context" aria-label="Collection context">
        <a href="/">← Explore</a>
        {hubResult.ok && (
          <a href={hubPath(hubResult.data.hub.handle)}> @{hubResult.data.hub.handle}</a>
        )}
        {parent?.ok && <a href={permalink(parent.data.id, token)}>{parent.data.title}</a>}
      </nav>
      <div className="page-heading">
        <div className="title-actions">
          <h1>{collection.title}</h1>
          <CopyLink id={id} token={token} />
        </div>
        {collection.description && <p className="description">{collection.description}</p>}
        <Tags tags={collection.tags} />
      </div>
      <PaginatedList
        kind="resources"
        path={`${path}/resources`}
        initial={resources.data}
        nextCursor={resources.meta?.nextCursor}
        token={token}
        titles={titles}
      />
    </article>
  );
}
