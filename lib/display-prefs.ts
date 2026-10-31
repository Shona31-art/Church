// Reading comfort settings: text size and high contrast. Like the theme
// (lib/theme.ts) they're a per-device display choice, kept in localStorage and
// applied to <html> before first paint by the script in app/layout.tsx.

export const TEXT_SIZE_KEY = "text-size";
export const CONTRAST_KEY = "contrast";

export const TEXT_SIZES = [
  { value: "standard", label: "Standard", scale: "100%" },
  { value: "large", label: "Large", scale: "112.5%" },
  { value: "larger", label: "Extra large", scale: "125%" },
] as const;
export type TextSize = (typeof TEXT_SIZES)[number]["value"];

function read(key: string): string | null {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

function write(key: string, value: string | null) {
  try {
    if (value === null) localStorage.removeItem(key);
    else localStorage.setItem(key, value);
  } catch {
    // Storage blocked (private mode): the choice still applies for this visit.
  }
}

export function readTextSize(): TextSize {
  const saved = read(TEXT_SIZE_KEY);
  return TEXT_SIZES.some((t) => t.value === saved) ? (saved as TextSize) : "standard";
}

export function applyTextSize(size: TextSize) {
  const root = document.documentElement;
  if (size === "standard") delete root.dataset.textSize;
  else root.dataset.textSize = size;
  write(TEXT_SIZE_KEY, size === "standard" ? null : size);
}

export function readHighContrast(): boolean {
  return read(CONTRAST_KEY) === "high";
}

export function applyHighContrast(on: boolean) {
  const root = document.documentElement;
  if (on) root.dataset.contrast = "high";
  else delete root.dataset.contrast;
  write(CONTRAST_KEY, on ? "high" : null);
}

/** Inline script for app/layout.tsx: restores both settings before the page paints. */
export const displayPrefsScript = `try{var s=localStorage.getItem(${JSON.stringify(TEXT_SIZE_KEY)});if(s==="large"||s==="larger")document.documentElement.dataset.textSize=s;if(localStorage.getItem(${JSON.stringify(CONTRAST_KEY)})==="high")document.documentElement.dataset.contrast="high"}catch(e){}`;
