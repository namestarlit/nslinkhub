"use client";
import { useEffect } from "react";
import { postFormAction } from "../lib/http";

// Opening Notifications resets the badge. The page renders "New" markers from
// the state before this runs, so they stay visible for this visit.
export function MarkNotificationsSeen({ unread }: { unread: number }) {
  useEffect(() => {
    if (!unread) return;
    void postFormAction("notifications-seen").then((ok) => {
      if (ok) window.dispatchEvent(new CustomEvent("notifications:seen"));
    });
  }, [unread]);
  return null;
}
