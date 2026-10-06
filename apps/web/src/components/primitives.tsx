import type { Collection, Resource } from "@nslinkhub/types";
import { permalink } from "../lib/http";

export function Tags({ tags }: { tags: string[] }) {
  return tags.length ? (
    <ul className="tags" aria-label="Tags">
      {tags.map((tag) => (
        <li key={tag}>{tag}</li>
      ))}
    </ul>
  ) : null;
}
export function CollectionRow({ item }: { item: Collection }) {
  return (
    <li className="collection-row">
      <h2>
        <a href={permalink(item.id)}>{item.title}</a>
      </h2>
      {item.description && <p className="preview">{item.description}</p>}
      <div className="row-meta">
        <Tags tags={item.tags} />
        <span>
          Updated{" "}
          <time dateTime={item.updatedAt}>
            {new Date(item.updatedAt).toLocaleDateString("en-GB", {
              day: "numeric",
              month: "short",
              year: "numeric",
              timeZone: "UTC",
            })}
          </time>
        </span>
      </div>
    </li>
  );
}
export function ResourceRow({
  item,
  titles,
  token,
}: {
  item: Resource;
  titles: Record<string, string>;
  token?: string;
}) {
  if (item.kind === "collection_link")
    return (
      <li className="resource-row">
        <span className="meta">Section</span>
        <h2>
          {item.linkedCollectionId ? (
            <a href={permalink(item.linkedCollectionId, token)}>
              {item.titleOverride || titles[item.linkedCollectionId] || "Open section"}{" "}
              <span aria-hidden="true">→</span>
            </a>
          ) : (
            "Section unavailable"
          )}
        </h2>
        <Tags tags={item.tags} />
      </li>
    );
  let url: URL | undefined;
  try {
    const value = new URL(item.url ?? "");
    if (["http:", "https:"].includes(value.protocol)) url = value;
  } catch {}
  return (
    <li className="resource-row">
      <h2>
        {url ? (
          <a href={url.href} rel="noreferrer" referrerPolicy="no-referrer">
            {item.titleOverride || url.href} <span aria-hidden="true">↗</span>
          </a>
        ) : (
          item.titleOverride || "Link unavailable"
        )}
      </h2>
      {url && <p className="meta hostname">{url.hostname}</p>}
      <Tags tags={item.tags} />
    </li>
  );
}
export function Skeleton() {
  return (
    <section aria-busy="true" aria-label="Loading collection content" className="skeleton">
      <p className="sr-only">Loading…</p>
      <div aria-hidden="true" className="skeleton-title" />
      {[1, 2, 3].map((i) => (
        <div key={i} aria-hidden="true" className="skeleton-row" />
      ))}
    </section>
  );
}
