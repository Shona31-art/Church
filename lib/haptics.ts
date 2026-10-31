// Vibration feedback on phones. Never essential: every action also shows on
// screen. Skipped when the person turns vibration off (My account → Display)
// or prefers reduced motion.
//
// Android: the Vibration API, with a pattern per kind of moment.
// iPhone: Safari has no Vibration API, but since iOS 18 tapping a switch
// control gives a light system tick — so on iPhones we tap a hidden switch.
// That only works straight after a real tap, and iPhones give one strength of
// tick whatever the kind, so it's used for taps and selections only.

const PATTERNS = {
  /** A light touch: buttons, tabs. */
  tap: 10,
  /** Even lighter: ticking a box, choosing an option. */
  select: 6,
  /** Something worked: saved, sent, correct answer. */
  success: [12, 60, 18],
  /** Careful: about to delete or leave. */
  warning: [30, 50, 30],
  /** Something went wrong, or a wrong answer. */
  error: [40, 60, 40, 60, 40],
} as const;

export type HapticKind = keyof typeof PATTERNS;

export const HAPTICS_KEY = "haptics";

export function hapticsEnabled(): boolean {
  try {
    return localStorage.getItem(HAPTICS_KEY) !== "off";
  } catch {
    return true;
  }
}

export function setHapticsEnabled(on: boolean) {
  try {
    if (on) localStorage.removeItem(HAPTICS_KEY);
    else localStorage.setItem(HAPTICS_KEY, "off");
  } catch {
    // Storage blocked: the choice applies for this visit only.
  }
}

let iosSwitch: HTMLLabelElement | null = null;

function isIos() {
  return /iPhone|iPad|iPod/.test(navigator.userAgent) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
}

/** iOS 18+: toggling a switch control plays the system haptic. */
function iosTick() {
  if (!iosSwitch) {
    iosSwitch = document.createElement("label");
    iosSwitch.setAttribute("aria-hidden", "true");
    iosSwitch.style.cssText = "position:fixed;left:-9999px;top:0;width:1px;height:1px;overflow:hidden;opacity:0;pointer-events:none";
    const input = document.createElement("input");
    input.type = "checkbox";
    input.setAttribute("switch", "");
    input.tabIndex = -1;
    iosSwitch.appendChild(input);
    document.body.appendChild(iosSwitch);
  }
  iosSwitch.click();
}

export function haptic(kind: HapticKind = "tap") {
  if (typeof window === "undefined" || !hapticsEnabled()) return;
  if (window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) return;
  try {
    if (typeof navigator.vibrate === "function") navigator.vibrate(PATTERNS[kind] as number | number[]);
    else if (isIos() && (kind === "tap" || kind === "select")) iosTick();
  } catch {
    // Some browsers block vibration without a recent tap; that's fine.
  }
}
