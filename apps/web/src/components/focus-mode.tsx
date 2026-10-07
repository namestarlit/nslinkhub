"use client";
import { useEffect } from "react";

// Focus rings are for keyboard navigation. After a pointer press (mouse or
// touch) the page records pointer mode on <html>, which hides control rings,
// including the one Chromium redraws when a window regains focus. Moving focus
// with the keyboard (Tab, arrows, F6) leaves pointer mode so rings return.
// Nothing is blurred, and text fields keep their own focused border.
const navigationKeys = new Set(["Tab", "F6", "ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight"]);

export function FocusMode() {
  useEffect(() => {
    const root = document.documentElement;
    const pointer = () => {
      root.dataset.focusInput = "pointer";
    };
    const keyboard = (event: KeyboardEvent) => {
      if (navigationKeys.has(event.key)) delete root.dataset.focusInput;
    };
    document.addEventListener("pointerdown", pointer, true);
    document.addEventListener("keydown", keyboard, true);
    return () => {
      document.removeEventListener("pointerdown", pointer, true);
      document.removeEventListener("keydown", keyboard, true);
    };
  }, []);
  return null;
}
