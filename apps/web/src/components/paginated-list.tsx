"use client";
import type { Collection, Resource } from "@nslinkhub/types";
import { useEffect, useRef, useState } from "react";
import { browserRead } from "../lib/browser-api";
import { type ApiPath, type Failure, withCursor } from "../lib/http";
import { Retry } from "./feedback";
import { CollectionRow, ResourceRow } from "./primitives";

type Props = {
  path: ApiPath;
  nextCursor?: string | null;
  token?: string;
  titles?: Record<string, string>;
} & ({ kind: "collections"; initial: Collection[] } | { kind: "resources"; initial: Resource[] });
export function PaginatedList(props: Props) {
  const [items, setItems] = useState<(Collection | Resource)[]>(props.initial);
  const [cursor, setCursor] = useState(props.nextCursor);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<Failure>();
  const [announcement, setAnnouncement] = useState("");
  const active = useRef<AbortController | null>(null);
  const continuation = useRef<HTMLDivElement>(null);
  const restoreFocus = useRef(false);
  useEffect(() => {
    if (!restoreFocus.current) return;
    continuation.current?.querySelector<HTMLElement>("a,button")?.focus({ preventScroll: true });
    if (!pending) restoreFocus.current = false;
  }, [pending]);
  useEffect(() => {
    const stop = () => active.current?.abort();
    window.addEventListener("reader:suspend", stop);
    return () => {
      stop();
      window.removeEventListener("reader:suspend", stop);
    };
  }, []);
  async function more() {
    if (!cursor || active.current) return;
    restoreFocus.current = continuation.current?.contains(document.activeElement) ?? false;
    const controller = new AbortController();
    active.current = controller;
    setPending(true);
    setError(undefined);
    const result = await browserRead<(Collection | Resource)[]>(
      withCursor(props.path, cursor),
      controller.signal,
      props.token,
    );
    if (controller.signal.aborted) return;
    active.current = null;
    setPending(false);
    if (!result.ok) {
      if ([401, 403, 404].includes(result.status)) {
        document.documentElement.dataset.revalidating = "true";
        window.location.reload();
        return;
      }
      setError(result);
      return;
    }
    setItems((current) => [
      ...current,
      ...result.data.filter((item) => !current.some((old) => old.id === item.id)),
    ]);
    setCursor(result.meta?.nextCursor);
    setAnnouncement(`${result.data.length} more ${props.kind} loaded.`);
  }
  const fallback = `?${new URLSearchParams({ cursor: cursor ?? "", ...(props.token ? { s: props.token } : {}) })}`;
  return (
    <>
      <ul className={props.kind === "collections" ? "collection-list" : "resource-list"}>
        {items.map((item) =>
          props.kind === "collections" ? (
            <CollectionRow key={item.id} item={item as Collection} />
          ) : (
            <ResourceRow
              key={item.id}
              item={item as Resource}
              titles={props.titles ?? {}}
              token={props.token}
            />
          ),
        )}
      </ul>
      {!items.length && (
        <p className="empty">
          {props.kind === "collections"
            ? "No published collections yet."
            : "No resources in this collection yet."}
        </p>
      )}
      <p aria-live="polite" className="sr-only">
        {announcement}
      </p>
      <div className="continuation" aria-busy={pending} ref={continuation}>
        {error && (
          <p role="status">
            {error.code === "invalid_cursor"
              ? "This list has changed. Reload to see the latest results."
              : "Couldn't load more. Your current results are still here."}
          </p>
        )}
        {error?.code === "invalid_cursor" ? (
          <a
            className="button"
            href={
              props.kind === "collections"
                ? "/"
                : props.token
                  ? `?s=${encodeURIComponent(props.token)}`
                  : "?"
            }
          >
            Reload list
          </a>
        ) : error ? (
          <Retry seconds={error.retryAfter} action={more} />
        ) : cursor || announcement ? (
          <a
            className="button"
            href={fallback}
            aria-disabled={pending || !cursor}
            onClick={(event) => {
              if (
                event.button !== 0 ||
                event.metaKey ||
                event.ctrlKey ||
                event.shiftKey ||
                event.altKey
              )
                return;
              event.preventDefault();
              void more();
            }}
          >
            {pending ? "Loading…" : cursor ? `More ${props.kind}` : `All ${props.kind} loaded`}
          </a>
        ) : null}
      </div>
    </>
  );
}
