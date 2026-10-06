"use client";
import { useEffect, useState } from "react";

// A native document GET keeps rechecking functional without JavaScript. The
// enhancement honors throttling and hides stale status during navigation.
export function StatusCheck({ retry, seconds }: { retry: boolean; seconds: number }) {
  const [enhanced, setEnhanced] = useState(false);
  const [left, setLeft] = useState(seconds);
  const [pending, setPending] = useState(false);
  useEffect(() => {
    setEnhanced(true);
    if (!seconds) return;
    const deadline = Date.now() + seconds * 1000;
    const timer = setInterval(
      () => setLeft(Math.max(0, Math.ceil((deadline - Date.now()) / 1000))),
      1000,
    );
    return () => clearInterval(timer);
  }, [seconds]);
  return (
    <div>
      <form
        action="/status"
        onSubmit={() => {
          setPending(true);
          document.documentElement.dataset.revalidating = "true";
          window.dispatchEvent(new Event("reader:suspend"));
        }}
      >
        <button type="submit" className="button" disabled={left > 0 || pending}>
          {pending
            ? "Checking…"
            : left
              ? `Try again in ${left}s`
              : retry
                ? "Try again"
                : "Check again"}
        </button>
      </form>
      {seconds > 0 && !enhanced && (
        <p>
          Wait {seconds} seconds, then <a href="/status">check the service again</a>.
        </p>
      )}
    </div>
  );
}
