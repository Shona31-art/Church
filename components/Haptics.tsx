"use client";

import { useEffect } from "react";
import { haptic, type HapticKind } from "@/lib/haptics";

/**
 * Vibration feedback for any control inside an element marked
 * data-haptic="tap" | "success" | "warning" — works in server components too
 * (e.g. <form data-haptic="success"> around "I prayed"). One listener for the app.
 */
export function HapticClicks() {
  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      const el = (e.target as HTMLElement).closest<HTMLElement>("[data-haptic]");
      if (el && (e.target as HTMLElement).closest("button, a, [role=button], input[type=submit]")) haptic((el.dataset.haptic as HapticKind) || "tap");
    };
    document.addEventListener("click", onClick);
    return () => document.removeEventListener("click", onClick);
  }, []);
  return null;
}

/** A buzz when this appears, e.g. "Thank you for your gift". */
export function HapticOnMount({ kind = "success" }: { kind?: HapticKind }) {
  useEffect(() => haptic(kind), [kind]);
  return null;
}
