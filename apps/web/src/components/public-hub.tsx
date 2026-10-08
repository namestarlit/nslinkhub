import { webServerConfig } from "@nslinkhub/config/web-server";
import type { HubPage } from "@nslinkhub/types";
import { SharePanel } from "./copy-link";
import { PaginatedList } from "./paginated-list";

export function PublicHub({
  data,
  nextCursor,
  preview = false,
}: {
  data: HubPage;
  nextCursor?: string | null;
  preview?: boolean;
}) {
  const { hub, collections } = data;
  const ownerName = hub.ownerName?.trim();
  return (
    <section data-reader className="reader collection-browser public-hub">
      <div className="page-heading hub-heading">
        <div className="hub-introduction">
          <h1>{hub.name}</h1>
          {/* The handle is the hub's; "by Name" only when the owner shows it. */}
          <p className="hub-identity meta">
            <span className="person-handle">@{hub.handle}</span>
            {ownerName && (
              <>
                {" by "}
                <span className="person-name">{ownerName}</span>
              </>
            )}
          </p>
          {hub.description && <p className="description">{hub.description}</p>}
          <div className="hub-share-actions">
            <SharePanel
              id={hub.id}
              kind="hub"
              title={hub.name}
              origin={webServerConfig().publicOrigin}
            />
          </div>
        </div>
      </div>
      <div className="hub-collections-heading">
        <h2>Published collections</h2>
        <span className="meta">{hub.publishedCollectionCount}</span>
      </div>
      <PaginatedList
        kind="collections"
        path={`/api/v1/hubs/${encodeURIComponent(hub.id)}`}
        initial={collections}
        nextCursor={nextCursor}
        publicHub={{ handle: hub.handle, preview }}
      />
    </section>
  );
}
