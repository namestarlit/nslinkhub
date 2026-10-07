"use client";
import { useEffect, useState } from "react";
import { NativeForm } from "./native-form";

// A new code is available once the server's resend gap has passed. The server
// renders the remaining wait; the countdown keeps it current. Without
// JavaScript, reloading after the wait enables the button.
export function ResendCode({ remaining }: { remaining: number }) {
  const [left, setLeft] = useState(remaining);
  useEffect(() => {
    const deadline = Date.now() + remaining * 1000;
    setLeft(remaining);
    if (remaining <= 0) return;
    const timer = window.setInterval(() => {
      const next = Math.max(0, Math.ceil((deadline - Date.now()) / 1000));
      setLeft(next);
      if (!next) window.clearInterval(timer);
    }, 250);
    return () => window.clearInterval(timer);
  }, [remaining]);
  return (
    <NativeForm action="/forms/code-resend">
      <button type="submit" className="text-button" disabled={left > 0}>
        Send a new code
      </button>
      {left > 0 && (
        <p className="field-help" aria-live="off">
          You can request another code in {left}s.
        </p>
      )}
    </NativeForm>
  );
}
