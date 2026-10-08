"use client";
import { useEffect, useRef, useState } from "react";
import { permalink } from "../lib/http";
import { useDismissible } from "./dismissible";
import { showToast } from "./toast";

type Kind = "collection" | "hub";
const sharePath = (id: string, kind: Kind, token?: string) =>
  kind === "hub" ? `/h/${encodeURIComponent(id)}` : permalink(id, token);

async function copyText(link: string) {
  try {
    await navigator.clipboard.writeText(link);
    showToast("Link copied");
    return true;
  } catch {
    return false;
  }
}

// Settings keeps a plain "copy my hub link" action; reading surfaces share one panel.
export function CopyHubLink({ hubId }: { hubId: string }) {
  const [fallback, setFallback] = useState("");
  async function copy() {
    const link = new URL(sharePath(hubId, "hub"), window.location.origin).href;
    setFallback((await copyText(link)) ? "" : link);
  }
  return (
    <div className="copy-link">
      <button type="button" className="button" onClick={() => void copy()}>
        Copy hub link
      </button>
      {fallback && (
        <label>
          <span className="sr-only">Copy this link</span>
          <input readOnly value={fallback} onFocus={(event) => event.currentTarget.select()} />
        </label>
      )}
    </div>
  );
}

type ShareProps = { id: string; origin: string; title: string; token?: string; kind?: Kind };

// Sharing is the goal; copying is one way to do it. One row of plain links:
// LinkedIn, X, WhatsApp, and Share link, which copies the address and confirms
// beneath the row (or shows the address to copy by hand if the clipboard is
// unavailable). The app links work without JavaScript; so does the address.
export function SharePanel({ id, origin, title, token, kind = "collection" }: ShareProps) {
  const link = new URL(sharePath(id, kind), origin).href;
  const [copied, setCopied] = useState(false);
  const [manual, setManual] = useState("");
  async function share(target: string) {
    try {
      await navigator.clipboard.writeText(target);
      setManual("");
      setCopied(true);
    } catch {
      setCopied(false);
      setManual(target);
    }
  }
  const text = kind === "hub" ? `${title} on nslinkhub` : `${title} — a collection on nslinkhub`;
  const encoded = encodeURIComponent(link);
  const destinations = [
    ["LinkedIn", `https://www.linkedin.com/sharing/share-offsite/?url=${encoded}`],
    ["X", `https://x.com/intent/post?text=${encodeURIComponent(text)}&url=${encoded}`],
    ["WhatsApp", `https://wa.me/?text=${encodeURIComponent(`${text} ${link}`)}`],
  ] as const;
  return (
    <div className="share-panel">
      <p className="share-title">{kind === "hub" ? "Share this hub" : "Share this collection"}</p>
      <ul className="share-links" aria-label="Share to">
        {destinations.map(([name, href]) => (
          <li key={name}>
            <a href={href} target="_blank" rel="noreferrer noopener">
              {name}
            </a>
          </li>
        ))}
        <li>
          <button type="button" className="share-link-button" onClick={() => void share(link)}>
            Share link
          </button>
        </li>
        {token && kind === "collection" && (
          <li>
            <button
              type="button"
              className="share-link-button"
              onClick={() => void share(new URL(permalink(id, token), origin).href)}
            >
              Share access link
            </button>
          </li>
        )}
      </ul>
      <p className="share-status" role="status">
        {copied ? "Link copied to clipboard." : ""}
      </p>
      {manual && (
        <label className="share-address">
          <span>Copy this link</span>
          <input readOnly value={manual} onFocus={(event) => event.currentTarget.select()} />
        </label>
      )}
      <noscript>
        <p className="share-address-static">{link}</p>
      </noscript>
    </div>
  );
}

const ShareIcon = () => (
  <svg
    width="16"
    height="16"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.8"
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden="true"
  >
    <path d="M12 3v12M7 8l5-5 5 5M5 13v6a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-6" />
  </svg>
);

// Compact disclosure for collections below the wide layout.
export function ShareMenu(props: ShareProps) {
  const menu = useRef<HTMLDetailsElement>(null);
  useDismissible(menu);
  return (
    <details className="share-menu" ref={menu}>
      <summary className="button">
        <ShareIcon />
        Share
      </summary>
      <SharePanel {...props} />
    </details>
  );
}

// Wide screens: sharing sits permanently beside the collection.
export function ShareAside(props: ShareProps) {
  return (
    <aside className="share-aside" aria-label="Share">
      <SharePanel {...props} />
    </aside>
  );
}
