"use client";
import { useEffect } from "react";

// Document navigation avoids the router cache. Never restore an old authorized
// DOM from bfcache or a background tab before a fresh server authorization.
export function FreshDocument() {
  useEffect(() => {
    const hide = () => {
      document.documentElement.dataset.revalidating = "true";
      window.dispatchEvent(new Event("reader:suspend"));
    };
    const resume = () => window.location.reload();
    const navigate = (event: MouseEvent) => {
      if (
        event.defaultPrevented ||
        event.button !== 0 ||
        event.metaKey ||
        event.ctrlKey ||
        event.altKey ||
        event.shiftKey
      )
        return;
      const anchor = event.target instanceof Element ? event.target.closest("a") : null;
      if (!anchor || anchor.target || anchor.hasAttribute("download")) return;
      const url = new URL(anchor.href);
      if (
        url.origin === window.location.origin &&
        (url.pathname !== window.location.pathname || url.search !== window.location.search)
      )
        hide();
    };
    window.addEventListener("click", navigate);
    const visibility = () => {
      if (document.hidden) hide();
      else resume();
    };
    const pageshow = (event: PageTransitionEvent) => {
      if (event.persisted) {
        hide();
        resume();
      }
    };
    window.addEventListener("pagehide", hide);
    window.addEventListener("pageshow", pageshow);
    document.addEventListener("visibilitychange", visibility);
    return () => {
      window.removeEventListener("click", navigate);
      window.removeEventListener("pagehide", hide);
      window.removeEventListener("pageshow", pageshow);
      document.removeEventListener("visibilitychange", visibility);
    };
  }, []);
  return (
    <div className="navigation-loading">
      <p role="status">Loading page…</p>
      <p>If loading stops, reload this page to try again.</p>
      <button type="button" className="button" onClick={() => window.location.reload()}>
        Reload this page
      </button>
      <div className="skeleton-title" aria-hidden="true" />
      <div className="skeleton-row" aria-hidden="true" />
      <div className="skeleton-row" aria-hidden="true" />
    </div>
  );
}
