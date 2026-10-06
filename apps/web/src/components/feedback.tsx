"use client";
import { useEffect, useState } from "react";
import type { Failure } from "../lib/http";

export function Retry({ seconds = 0, action }: { seconds?: number; action?: () => void }) {
  const [left, setLeft] = useState(seconds);
  useEffect(() => {
    const deadline = Date.now() + seconds * 1000;
    setLeft(seconds);
    const timer = setInterval(
      () => setLeft(Math.max(0, Math.ceil((deadline - Date.now()) / 1000))),
      1000,
    );
    return () => clearInterval(timer);
  }, [seconds]);
  return (
    <button
      type="button"
      className="button"
      disabled={left > 0}
      onClick={action ?? (() => window.location.reload())}
    >
      {left ? `Try again in ${left}s` : "Try again"}
    </button>
  );
}
export function Feedback({
  error,
  collection = false,
  hub = false,
  resetPath = "/",
}: {
  error: Failure;
  collection?: boolean;
  hub?: boolean;
  resetPath?: string;
}) {
  const cursor = error.code === "invalid_cursor";
  const hidden = (collection || hub) && !cursor && [400, 401, 403, 404].includes(error.status);
  return (
    <section className="feedback" data-reader>
      <h1>
        {hidden
          ? hub
            ? "This hub isn't available."
            : "This collection isn't available."
          : cursor
            ? "This list has changed."
            : "We couldn't load this page."}
      </h1>
      <p>
        {hidden
          ? "Explore other collections to find something useful."
          : cursor
            ? "Reload the list to see the latest results."
            : error.status === 429
              ? "There have been too many requests. Please wait before trying again."
              : "Check your connection and try again."}
      </p>
      {hidden || cursor ? (
        <a className="button" href={cursor ? resetPath : "/"}>
          {cursor
            ? collection
              ? "Reload collection"
              : "Reload collections"
            : "Explore collections"}
        </a>
      ) : (
        <Retry seconds={error.retryAfter} />
      )}
    </section>
  );
}
