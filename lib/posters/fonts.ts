// Fonts available in the poster editor: self-hosted in public/fonts/poster/
// (SIL Open Font License; downloaded by scripts/fetch-poster-fonts.mjs — keep
// the two lists in step). No requests go to Google, and exported posters use
// exactly the fonts shown. Each font loads only when a poster uses it.

export interface PosterFont {
  name: string;
  file: string;
  category: "Modern" | "Headline" | "Serif" | "Script";
  /** Weights the editor offers (variable fonts cover the whole range). */
  weights: readonly number[];
  /** CSS weight range for FontFace, e.g. "100 900" for a variable font. */
  weightRange: string;
  fallback: "sans-serif" | "serif" | "cursive";
}

const range = (from: number, to: number) => [300, 400, 500, 600, 700, 800, 900].filter((w) => w >= from && w <= to);

export const POSTER_FONTS: readonly PosterFont[] = [
  { name: "Manrope", file: "manrope.woff2", category: "Modern", weights: range(200, 800), weightRange: "200 800", fallback: "sans-serif" },
  { name: "Montserrat", file: "montserrat.woff2", category: "Modern", weights: range(100, 900), weightRange: "100 900", fallback: "sans-serif" },
  { name: "Raleway", file: "raleway.woff2", category: "Modern", weights: range(100, 900), weightRange: "100 900", fallback: "sans-serif" },
  { name: "League Spartan", file: "league-spartan.woff2", category: "Modern", weights: range(100, 900), weightRange: "100 900", fallback: "sans-serif" },
  { name: "DM Sans", file: "dm-sans.woff2", category: "Modern", weights: range(100, 1000), weightRange: "100 1000", fallback: "sans-serif" },
  { name: "Oswald", file: "oswald.woff2", category: "Headline", weights: range(200, 700), weightRange: "200 700", fallback: "sans-serif" },
  { name: "Bebas Neue", file: "bebas-neue.woff2", category: "Headline", weights: [400], weightRange: "400", fallback: "sans-serif" },
  { name: "Anton", file: "anton.woff2", category: "Headline", weights: [400], weightRange: "400", fallback: "sans-serif" },
  { name: "Playfair Display", file: "playfair-display.woff2", category: "Serif", weights: range(400, 900), weightRange: "400 900", fallback: "serif" },
  { name: "Cinzel", file: "cinzel.woff2", category: "Serif", weights: range(400, 900), weightRange: "400 900", fallback: "serif" },
  { name: "Lora", file: "lora.woff2", category: "Serif", weights: range(400, 700), weightRange: "400 700", fallback: "serif" },
  { name: "Cormorant Garamond", file: "cormorant-garamond.woff2", category: "Serif", weights: range(300, 700), weightRange: "300 700", fallback: "serif" },
  { name: "DM Serif Display", file: "dm-serif-display.woff2", category: "Serif", weights: [400], weightRange: "400", fallback: "serif" },
  { name: "Dancing Script", file: "dancing-script.woff2", category: "Script", weights: range(400, 700), weightRange: "400 700", fallback: "cursive" },
  { name: "Great Vibes", file: "great-vibes.woff2", category: "Script", weights: [400], weightRange: "400", fallback: "cursive" },
  { name: "Pacifico", file: "pacifico.woff2", category: "Script", weights: [400], weightRange: "400", fallback: "cursive" },
];

export const DEFAULT_FONT = "Manrope";

export function posterFont(name: string): PosterFont {
  return POSTER_FONTS.find((f) => f.name === name) ?? POSTER_FONTS[0];
}

/** The CSS font-family to draw with: the self-hosted face plus a generic fallback. */
export function cssFontFamily(name: string): string {
  const font = posterFont(name);
  return `"${font.name}", ${font.fallback}`;
}

const loading = new Map<string, Promise<void>>();

/**
 * Loads fonts (browser only) so the canvas measures and draws text with them.
 * Safe to call repeatedly; a font that fails to load falls back to the generic
 * family rather than breaking the editor.
 */
export function loadFonts(names: Iterable<string>): Promise<void> {
  if (typeof document === "undefined" || typeof FontFace === "undefined") return Promise.resolve();
  const jobs = [...new Set(names)].map((name) => {
    const font = posterFont(name);
    let job = loading.get(font.name);
    if (!job) {
      const face = new FontFace(font.name, `url(/fonts/poster/${font.file}) format("woff2")`, { weight: font.weightRange, display: "swap" });
      job = face
        .load()
        .then((loaded) => {
          document.fonts.add(loaded);
        })
        .catch((error) => {
          console.error(`[posters] font ${font.name} failed to load:`, error);
          loading.delete(font.name); // allow a retry later
        });
      loading.set(font.name, job);
    }
    return job;
  });
  return Promise.all(jobs).then(() => undefined);
}

/** Every font family a design uses (top level and inside groups). */
export function fontsInDesign(elements: readonly { type: string; fontFamily?: string; children?: readonly { type: string; fontFamily?: string }[] }[]): string[] {
  const names = new Set<string>();
  for (const e of elements) {
    if (e.type === "text" && e.fontFamily) names.add(e.fontFamily);
    for (const c of e.children ?? []) if (c.type === "text" && c.fontFamily) names.add(c.fontFamily);
  }
  return [...names];
}
