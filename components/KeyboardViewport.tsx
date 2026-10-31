"use client";

import { useEffect } from "react";

/**
 * Tracks the on-screen keyboard on phones. Sets two things on <html>:
 *   --vvh            the height actually visible above the keyboard
 *   data-keyboard    "open" while a keyboard covers part of the screen
 * iPhone Safari doesn't shrink the page when the keyboard opens (Android does,
 * via interactive-widget in app/layout.tsx), so screens with an input pinned
 * at the bottom — chat — size themselves with --vvh instead of 100dvh.
 */
export function KeyboardViewport() {
  useEffect(() => {
    const vv = window.visualViewport;
    if (!vv) return;
    const root = document.documentElement;
    const update = () => {
      root.style.setProperty("--vvh", `${Math.round(vv.height)}px`);
      // A keyboard takes well over a quarter of the screen; browser toolbars sliding don't.
      const open = vv.height < window.innerHeight * 0.75 && document.activeElement?.matches("input, textarea, [contenteditable]");
      if (open) root.dataset.keyboard = "open";
      else delete root.dataset.keyboard;
    };
    update();
    const later = () => setTimeout(update, 50);
    vv.addEventListener("resize", update);
    document.addEventListener("focusin", update);
    document.addEventListener("focusout", later);
    return () => {
      vv.removeEventListener("resize", update);
      document.removeEventListener("focusin", update);
      document.removeEventListener("focusout", later);
    };
  }, []);
  return null;
}
