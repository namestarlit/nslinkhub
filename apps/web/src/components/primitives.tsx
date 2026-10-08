import type { Collection, PersonRef, Resource } from "@nslinkhub/types";
import { hubPath, permalink, prettyPath } from "../lib/http";
import { Updated } from "./local-time";

export function Tags({ tags }: { tags: string[] }) {
  return tags.length ? (
    <ul className="tags" aria-label="Tags">
      {tags.map((tag) => (
        <li key={tag}>{tag}</li>
      ))}
    </ul>
  ) : null;
}
export function CollectionRow({ item, handle }: { item: Collection; handle?: string }) {
  return (
    <li className="collection-row">
      <h2>
        <a href={handle ? prettyPath(handle, item.slug) : permalink(item.id)}>{item.title}</a>
      </h2>
      {item.description && <p className="preview">{item.description}</p>}
      <CollectionMeta item={item} handle={handle} compact />
    </li>
  );
}
// A person, the same way everywhere: their @handle, linking to their hub (where
// their name shows, if they choose).
export function Person({ person }: { person: PersonRef }) {
  return (
    <a className="person" href={`/h/${encodeURIComponent(person.hubId)}`}>
      <span className="person-handle">@{person.handle}</span>
    </a>
  );
}
export function CollectionMeta({
  item,
  handle,
  compact = false,
}: {
  item: Collection;
  handle?: string;
  compact?: boolean;
}) {
  const owner: PersonRef | null = item.hub ? { hubId: item.hub.id, handle: item.hub.handle } : null;
  const creator =
    // Only when the owner is known and the creator is someone else.
    !compact && item.hub && item.creator && item.creator.hubId !== item.hub.id
      ? item.creator
      : null;
  // Contributors, GitHub-style: "Paul John · 2 contributors · Updated …", shown
  // when anyone besides the owner has shaped the collection.
  const contributors = item.contributors;
  const ownerShaped = contributors?.people.some((person) => person.hubId === item.hubId) ?? false;
  const others = compact || !contributors ? 0 : contributors.total - (ownerShaped ? 1 : 0);
  return (
    <div className="row-meta">
      {owner ? (
        <Person person={owner} />
      ) : (
        handle && (
          <a className="person" href={hubPath(handle)}>
            <span className="person-handle">@{handle}</span>
          </a>
        )
      )}
      {creator && (
        <span>
          Created by <Person person={creator} />
        </span>
      )}

      {others > 0 && contributors && (
        <span className="contributors">{contributors.total} contributors</span>
      )}
      <span>
        Updated <Updated at={item.updatedAt} />
      </span>
      {compact && !item.published && <span className="row-badge">Private</span>}
      {compact && item.tags.length > 0 && (
        <span className="row-tags">
          {item.tags
            .slice(0, 3)
            .map((tag) => `#${tag}`)
            .join(" ")}
        </span>
      )}
    </div>
  );
}
export function ResourceRow({ item }: { item: Resource }) {
  if (item.kind === "heading")
    return (
      <li className="resource-heading">
        <h2>{item.title}</h2>
      </li>
    );
  if (item.kind === "collection_link")
    return (
      <li className={`resource-row${item.linkedCollection ? "" : " resource-unavailable"}`}>
        <h2>
          {item.linkedCollection ? (
            <a href={permalink(item.linkedCollection.id)}>
              {item.title || item.linkedCollection.title}
            </a>
          ) : (
            "Collection unavailable"
          )}
        </h2>
        <div className="meta resource-meta">
          {item.linkedCollection ? (
            <>
              <CollectionIcon />
              <span className="resource-kind">Collection</span>
            </>
          ) : (
            <span>This collection may be private or no longer available.</span>
          )}
          <Tags tags={item.tags} />
        </div>
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
            {item.title || url.href}
          </a>
        ) : (
          item.title || "Link unavailable"
        )}
      </h2>
      {url ? (
        <div className="meta hostname resource-meta">
          <span>{url.hostname.replace(/^www\./, "")}</span>
          <ExternalIcon />
          <Tags tags={item.tags} />
        </div>
      ) : (
        <Tags tags={item.tags} />
      )}
    </li>
  );
}
// One stroke-icon family (1.5px, round joins) shared with the header controls.
function ExternalIcon() {
  return (
    <svg
      width="13"
      height="13"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M7 17 17 7M9 7h8v8" />
    </svg>
  );
}
function CollectionIcon() {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      className="resource-kind"
    >
      <rect x="3" y="7" width="14" height="14" rx="2.5" />
      <path d="M7 3h11.5A2.5 2.5 0 0 1 21 5.5V17" />
    </svg>
  );
}
