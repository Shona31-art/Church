// Fonts available in the poster editor. A design stores the friendly name
// ("Manrope"); the canvas needs the real CSS family the browser loaded.
//
// Step 2 of the plan uses the two fonts the app already self-hosts through
// next/font (app/layout.tsx), read from their CSS variables. Step 3 adds the
// full self-hosted set in public/fonts/poster/ (docs/plans/poster-editor.md).

export interface PosterFont {
  name: string;
  /** CSS variable holding the loaded family (next/font gives hashed names). */
  cssVariable: string;
  fallback: "sans-serif" | "serif";
  weights: readonly number[];
}

export const POSTER_FONTS: readonly PosterFont[] = [
  { name: "Manrope", cssVariable: "--font-sans", fallback: "sans-serif", weights: [400, 500, 600, 700, 800] },
  { name: "Playfair Display", cssVariable: "--font-display", fallback: "serif", weights: [600, 700] },
];

export const DEFAULT_FONT = "Manrope";

/** The CSS font-family to draw with (browser only). Unknown names fall back safely. */
export function cssFontFamily(name: string): string {
  const font = POSTER_FONTS.find((f) => f.name === name) ?? POSTER_FONTS[0];
  if (typeof document === "undefined") return font.fallback;
  const loaded = getComputedStyle(document.documentElement).getPropertyValue(font.cssVariable).trim();
  return loaded ? `${loaded}, ${font.fallback}` : font.fallback;
}

/** Resolves once the page's fonts are ready, so text is measured with the right font. */
export async function fontsReady(): Promise<void> {
  if (typeof document !== "undefined" && "fonts" in document) await document.fonts.ready;
}
