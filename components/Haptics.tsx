"use client";

import { useEffect } from "react";
import { haptic, type HapticKind } from "@/lib/haptics";

/**
 * One listener for the whole app:
 *  - anything inside data-haptic="tap|select|success|warning|error" uses that
 *    (works in server components, e.g. <form data-haptic="success"> on "I prayed");
 *  - otherwise: the bottom tabs and main buttons give a light tap, delete-style
 *    buttons a warning buzz, and tick-boxes / options a soft tick.
 * Saved/failed messages buzz from the Toaster; game answers from the games.
 */
export function HapticClicks() {
  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      const marked = target.closest<HTMLElement>("[data-haptic]");
      const control = target.closest<HTMLElement>("button, a, [role=button], [role=tab], [role=menuitem], input[type=submit], summary");
      if (marked && control) return haptic((marked.dataset.haptic as HapticKind) || "tap");
      if (!control) return;
      if (control.matches(".btn-danger, .text-danger, [data-destructive]")) return haptic("warning");
      if (control.closest("[data-tab-bar]") || control.matches(".btn-primary, .btn-amber, .btn-gold, [role=tab], [role=menuitem], summary")) return haptic("tap");
    };
    const onChange = (e: Event) => {
      const input = e.target as HTMLInputElement;
      if (input.matches?.("input[type=checkbox], input[type=radio]") && !input.closest("[aria-hidden=true]")) haptic("select");
    };
    document.addEventListener("click", onClick);
    document.addEventListener("change", onChange);
    return () => {
      document.removeEventListener("click", onClick);
      document.removeEventListener("change", onChange);
    };
  }, []);
  return null;
}

/** A buzz when this appears, e.g. "Thank you for your gift". */
export function HapticOnMount({ kind = "success" }: { kind?: HapticKind }) {
  useEffect(() => haptic(kind), [kind]);
  return null;
}
