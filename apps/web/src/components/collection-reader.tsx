import { webServerConfig } from "@nslinkhub/config/web-server";
import type { Collection, CommentThreads, HubPage, HubSummary, Resource } from "@nslinkhub/types";
import { collectionPath, permalink, queryValue, withCursor } from "../lib/http";
import { serverRead } from "../lib/server-api";
import { readSession } from "../lib/session";
import { CollectionFeedback } from "./collection-feedback";
import { CollectionHeading } from "./collection-heading";
import { CollectionMoreMenu } from "./collection-more-menu";
import { Comments } from "./comments";
import { ShareAside, ShareMenu } from "./copy-link";
import { FormNotice } from "./form-notice";
import { PaginatedList } from "./paginated-list";
import { CollectionMeta, Tags } from "./primitives";

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
  const commentCursor = queryValue(query.cc);
  const commentPath = withCursor(`${path}/comments`, commentCursor);
  const replyTo = queryValue(query.rt),
    replyCursor = queryValue(query.rc);
  const replyQuery =
    replyTo && replyCursor ? `&${new URLSearchParams({ replyTo, replyCursor })}` : "";
  const [resources, hubResult, comments, session] = await Promise.all([
    serverRead<Resource[]>(withCursor(`${path}/resources`, queryValue(query.cursor)), token),
    hub?.id === collection.hubId
      ? Promise.resolve({ ok: true as const, data: { hub } })
      : serverRead<HubPage>(`/api/v1/hubs/${encodeURIComponent(collection.hubId)}?limit=1`),
    serverRead<CommentThreads>(`${commentPath}${replyQuery}`, token),
    readSession(),
  ]);
  if (!resources.ok)
    return <CollectionFeedback error={resources} returnTo={resetPath ?? permalink(id, token)} />;
  const shown = { ...collection, ...(hubResult.ok ? { hub: hubResult.data.hub } : {}) };
  const owner = collection.capabilities?.canManage;
  const notice = queryValue(query.notice);
  const discussionNotice = notice?.startsWith("comment") || notice === "comments-off";
  const returnTo = resetPath ?? permalink(id, token);
  const older = comments.ok ? comments.meta?.nextCursor : null;
  const olderHref = older
    ? `${returnTo}${returnTo.includes("?") ? "&" : "?"}${new URLSearchParams({ cc: older })}#comments`
    : undefined;
  return (
    <div className="reader-layout" data-reader>
      <article className="reader collection-sheet">
        {!discussionNotice && <FormNotice code={notice} />}
        <header className="sheet-bar">
          {hubResult.ok ? (
            <nav className="context" aria-label="Collection context">
              <a href={`/h/${encodeURIComponent(hubResult.data.hub.id)}`}>
                {hubResult.data.hub.name}
              </a>
            </nav>
          ) : (
            <span />
          )}
          <div className="collection-actions">
            {/* At the top of the page, so adding a link never needs a scroll. */}
            {owner && (
              <a
                className="button add-resource"
                href={`/capture?collection=${id}`}
                aria-label="Add a link"
              >
                <span aria-hidden="true">+</span>
                <span className="add-label">Add a link</span>
              </a>
            )}
            <ShareMenu
              id={id}
              token={token}
              title={collection.title}
              origin={webServerConfig().publicOrigin}
            />
            {collection.capabilities?.canEdit && (
              <>
                {/* Wide screens show the buttons; narrow ones fold them into More. */}
                <a className="button wide-action" href={`/c/${id}/history`}>
                  History
                </a>
                {owner && (
                  <a className="button wide-action" href={`/c/${id}/edit`}>
                    Edit
                  </a>
                )}
                <CollectionMoreMenu id={id} canManage={Boolean(owner)} />
              </>
            )}
          </div>
        </header>
        <CollectionHeading>
          <h1>{collection.title}</h1>
          {collection.description && (
            <div className="collection-overview">
              <div className="collection-overview-content">
                <p className="description">{collection.description}</p>
              </div>
            </div>
          )}
          <Tags tags={collection.tags} />
          <CollectionMeta item={shown} />
          {collection.restriction && (
            <p className="form-notice">
              Distribution is on hold ({collection.restriction.reason.replaceAll("_", " ")}). You
              can correct your content.{" "}
              <a href={collection.restriction.supportUrl}>Contact support</a> for review.
            </p>
          )}
        </CollectionHeading>
        {/* biome-ignore lint/a11y/noNoninteractiveTabindex: The resource list scrolls under a fixed header on desktop and needs keyboard focus for scrolling. */}
        <section className="sheet-body" aria-label="Resources" tabIndex={0}>
          <PaginatedList
            kind="resources"
            path={`${path}/resources`}
            initial={resources.data}
            nextCursor={resources.meta?.nextCursor}
            token={token}
          />
        </section>
      </article>
      <div className="reader-side">
        <ShareAside
          id={id}
          token={token}
          title={collection.title}
          origin={webServerConfig().publicOrigin}
        />
        <Comments
          collectionId={id}
          threads={comments.ok ? comments.data : null}
          returnTo={returnTo}
          signedIn={Boolean(session)}
          notice={discussionNotice ? notice : undefined}
          olderHref={olderHref}
          commentCursor={commentCursor}
          composerOpen={queryValue(query.compose) === "comment"}
        />
      </div>
    </div>
  );
}
