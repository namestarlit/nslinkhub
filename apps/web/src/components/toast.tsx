"use client";
import { useEffect, useState } from "react";

type Tone = "success" | "info";
const lifetime = 4500;

function dropNoticeFromUrl() {
  const url = new URL(window.location.href);
  if (!url.searchParams.has("notice")) return;
  url.searchParams.delete("notice");
  url.searchParams.delete("wait");
  window.history.replaceState(window.history.state, "", url);
}

// A server-rendered confirmation (from a ?notice= code). It sits in the fixed
// top region, clears itself and removes the code so a reload doesn't repeat it.
// Without JavaScript a CSS animation still fades it out.
export function Toast({ message, tone = "success" }: { message: string; tone?: Tone }) {
  const [visible, setVisible] = useState(true);
  useEffect(() => {
    // Clearing the code re-renders the route without it, so wait until the
    // toast has had its time on screen.
    const timer = window.setTimeout(() => {
      setVisible(false);
      dropNoticeFromUrl();
    }, lifetime);
    return () => window.clearTimeout(timer);
  }, []);
  if (!visible) return null;
  return (
    <div className="toast-region">
      <output className={`toast ${tone}`}>{message}</output>
    </div>
  );
}

export function showToast(message: string, tone: Tone = "success") {
  window.dispatchEvent(new CustomEvent("app:toast", { detail: { message, tone } }));
}

// Client-side confirmations (for example "Link copied") use the same region.
export function Toaster() {
  const [toast, setToast] = useState<{ id: number; message: string; tone: Tone }>();
  useEffect(() => {
    let timer: number | undefined;
    const show = (event: Event) => {
      const { message, tone } = (event as CustomEvent<{ message: string; tone: Tone }>).detail;
      window.clearTimeout(timer);
      setToast({ id: Date.now(), message, tone });
      timer = window.setTimeout(() => setToast(undefined), lifetime);
    };
    window.addEventListener("app:toast", show);
    return () => {
      window.removeEventListener("app:toast", show);
      window.clearTimeout(timer);
    };
  }, []);
  return (
    <div className="toast-region" aria-live="polite">
      {toast && (
        <output key={toast.id} className={`toast ${toast.tone}`}>
          {toast.message}
        </output>
      )}
    </div>
  );
}
