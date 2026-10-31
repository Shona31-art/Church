// A short vibration as feedback on phones that support it (most Android
// phones; iPhones ignore it). Never essential: every action also shows
// on screen. Skipped when the person prefers reduced motion.

const PATTERNS = {
  tap: 10,
  success: [12, 60, 18],
  warning: [30, 50, 30],
} as const;

export type HapticKind = keyof typeof PATTERNS;

export function haptic(kind: HapticKind = "tap") {
  if (typeof navigator === "undefined" || typeof navigator.vibrate !== "function") return;
  if (window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) return;
  try {
    navigator.vibrate(PATTERNS[kind] as number | number[]);
  } catch {
    // Some browsers block vibration without a recent tap; that's fine.
  }
}
