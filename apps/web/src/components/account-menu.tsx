"use client";
import { useEffect, useRef, useState } from "react";
import { Avatar } from "./avatar";
export function AccountMenu({
  userId,
  name,
  email,
  operator,
  unreadNotifications,
}: {
  userId: string;
  name: string;
  email: string;
  operator: boolean;
  unreadNotifications: number;
}) {
  const menu = useRef<HTMLDetailsElement>(null);
  const [displayName, setDisplayName] = useState(name);
  const [unread, setUnread] = useState(unreadNotifications);
  useEffect(() => {
    const updated = (event: Event) => {
      const name = (event as CustomEvent<{ name?: string }>).detail?.name;
      if (typeof name === "string") setDisplayName(name);
    };
    window.addEventListener("profile:updated", updated);
    const seen = () => setUnread(0);
    window.addEventListener("notifications:seen", seen);
    const outside = (event: PointerEvent) => {
      if (event.target instanceof Node && !menu.current?.contains(event.target) && menu.current)
        menu.current.open = false;
    };
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape" && menu.current?.open) {
        menu.current.open = false;
        menu.current.querySelector("summary")?.focus();
      }
    };
    document.addEventListener("pointerdown", outside);
    document.addEventListener("keydown", closeOnEscape);
    return () => {
      window.removeEventListener("profile:updated", updated);
      window.removeEventListener("notifications:seen", seen);
      document.removeEventListener("pointerdown", outside);
      document.removeEventListener("keydown", closeOnEscape);
    };
  }, []);
  return (
    <details className="account-menu" ref={menu}>
      <summary aria-label="Account menu">
        <Avatar userId={userId} />
      </summary>
      <div className="account-menu-panel">
        <div className="account-menu-identity">
          {displayName && <strong>{displayName}</strong>}
          <span>{email}</span>
        </div>
        <nav aria-label="Account navigation">
          <a
            href="/notifications"
            className="notifications-link"
            aria-label={unread ? `Notifications, ${unread} new` : "Notifications"}
          >
            Notifications
            {unread > 0 && <span className="notification-count">{unread}</span>}
          </a>
          <a href="/settings">Settings</a>
          {operator && <a href="/ops">Service operations</a>}
        </nav>
        <form action="/forms/sign-out" method="post">
          <button type="submit">Sign out</button>
        </form>
      </div>
    </details>
  );
}
