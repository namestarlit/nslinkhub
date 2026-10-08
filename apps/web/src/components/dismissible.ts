"use client";
import { type RefObject, useEffect } from "react";

// A <details> menu closes on a click outside it or on Escape (focus returns to
// its summary). Without JavaScript it is still a plain disclosure.
export function useDismissible(menu: RefObject<HTMLDetailsElement | null>) {
  useEffect(() => {
    const outside = (event: PointerEvent) => {
      if (event.target instanceof Node && menu.current && !menu.current.contains(event.target))
        menu.current.open = false;
    };
    const onEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape" && menu.current?.open) {
        menu.current.open = false;
        menu.current.querySelector("summary")?.focus();
      }
    };
    document.addEventListener("pointerdown", outside);
    document.addEventListener("keydown", onEscape);
    return () => {
      document.removeEventListener("pointerdown", outside);
      document.removeEventListener("keydown", onEscape);
    };
  }, [menu]);
}
