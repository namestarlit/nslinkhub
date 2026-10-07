import { webServerConfig } from "@nslinkhub/config/web-server";
import type { Collection, Profile } from "@nslinkhub/types";
import { withCursor } from "../lib/http";
import { operatorRead } from "../lib/operator-read";
import { SharePanel } from "./copy-link";
import { Feedback } from "./feedback";
import { PaginatedList } from "./paginated-list";
export async function OwnedHub({ profile, cursor }: { profile: Profile; cursor?: string }) {
  const result = await operatorRead<Collection[]>(
    withCursor(`/api/v1/hubs/${profile.hubId}/collections`, cursor),
    `/h/${profile.hubId}`,
  );
  if (!result.ok) return <Feedback error={result} resetPath={`/h/${profile.hubId}`} />;
  const hub = profile;
  const ownerName = hub.showNameOnHub ? hub.displayName.trim() : "";
  return (
    <section className="reader collection-browser own-hub" data-reader>
      <div className="page-heading hub-heading">
        <div className="hub-introduction">
          <h1>{hub.hubName ?? "Your hub"}</h1>
          <p className="hub-identity meta">
            {ownerName && <span className="person-name">{ownerName}</span>}
            {hub.handle && <span className="person-handle">@{hub.handle}</span>}
          </p>
          {hub.hubDescription && <p className="description">{hub.hubDescription}</p>}
          {hub.hubId && (
            <div className="hub-share-actions">
              <SharePanel
                id={hub.hubId}
                kind="hub"
                title={hub.hubName ?? "My hub"}
                origin={webServerConfig().publicOrigin}
              />
            </div>
          )}
        </div>
      </div>
      <div className="hub-collections-heading">
        <h2>Your collections</h2>
      </div>
      {result.data.length ? (
        <PaginatedList
          kind="collections"
          path={`/api/v1/hubs/${profile.hubId}/collections`}
          initial={result.data}
          nextCursor={result.meta?.nextCursor}
        />
      ) : (
        <div className="empty">
          <h2>Your first collection starts with a link</h2>
          <p>Save something worth coming back to. We'll keep it private.</p>
          <a className="button primary" href="/capture">
            Save your first link
          </a>
        </div>
      )}
    </section>
  );
}
