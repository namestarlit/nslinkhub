"use client";
import { useState } from "react";
import { permalink } from "../lib/http";

export function CopyLink({ id, token }: { id: string; token?: string }) {
  const [message, setMessage] = useState("");
  const [fallback, setFallback] = useState("");
  async function copy(shared = false) {
    const link = new URL(permalink(id, shared ? token : undefined), window.location.origin).href;
    try {
      await navigator.clipboard.writeText(link);
      setMessage("Link copied");
      setFallback("");
    } catch {
      setFallback(link);
      setMessage("Copy this link");
    }
  }
  return (
    <div className="copy-link">
      <button type="button" className="button" onClick={() => void copy()}>
        Copy link
      </button>
      {token && (
        <button type="button" className="text-button" onClick={() => void copy(true)}>
          Copy shared access link
        </button>
      )}
      <span role="status">{message}</span>
      {fallback && (
        <label>
          <span className="sr-only">Copy this link</span>
          <input readOnly value={fallback} onFocus={(event) => event.currentTarget.select()} />
        </label>
      )}
    </div>
  );
}
