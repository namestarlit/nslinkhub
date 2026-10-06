import type { Collection, Resource } from "@nslinkhub/types";
import { CopyLink } from "../../../components/copy-link";
import { Feedback } from "../../../components/feedback";
import { PaginatedList } from "../../../components/paginated-list";
import { Tags } from "../../../components/primitives";
import { collectionPath, failure, permalink, queryValue, withCursor } from "../../../lib/http";
import { serverRead } from "../../../lib/server-api";

export const dynamic = "force-dynamic";
type Props = {
  params: Promise<{ id: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};
async function Reader({ params, searchParams }: Props) {
  const { id } = await params;
  if (!/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i.test(id))
    return <Feedback collection error={failure("not_found", 404)} />;
  const query = await searchParams;
  const token = queryValue(query.s, 512);
  const path = collectionPath(id);
  const result = await serverRead<Collection>(path, token);
  if (!result.ok) return <Feedback collection error={result} />;
  const collection = result.data;
  const [resources, children, parent] = await Promise.all([
    serverRead<Resource[]>(withCursor(`${path}/resources`, queryValue(query.cursor)), token),
    serverRead<Collection[]>(`${path}/children`, token),
    collection.parentCollectionId
      ? serverRead<Collection>(collectionPath(collection.parentCollectionId), token)
      : Promise.resolve(null),
  ]);
  if (!resources.ok)
    return <Feedback collection error={resources} resetPath={permalink(id, token)} />;
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
export default function Page(props: Props) {
  return Reader(props);
}
