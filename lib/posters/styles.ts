import type { GroupElement, PosterDesign, PosterElement, TextElement } from "./design";
import { colorsBehind, contrastRatio, requiredRatio } from "./contrast";
import { posterFont } from "./fonts";

// Style variations for poster templates: Minimal, Midnight, Neon, Vintage,
// Pastel. A style re-themes a design rather than replacing it: background,
// text colours and fonts by role (title / label / body), shape, icon and
// photo-overlay colours. Text, photos and layout are kept.
//
// Two safeguards keep a restyled poster tidy:
//   * readability — each text is re-checked against what's behind it and
//     switched to the style's light or dark text if contrast falls short;
//   * fit — a wider font is shrunk by the width difference so titles don't
//     re-wrap into the next line (text is never enlarged).
// Unit-tested across every template, style and size in tests/unit/poster-editor.test.ts.

export interface PosterStyle {
  key: "minimal" | "midnight" | "neon" | "vintage" | "pastel";
  name: string;
  description: string;
  background: PosterDesign["background"];
  /** Laid over background/photo slots so text on photos stays readable. */
  overlay: { color: string; opacity: number };
  shapeFill: string;
  stroke: string;
  icon: string;
  title: string;
  body: string;
  muted: string;
  label: string;
  /** Fallback text colours for the readability check (light, dark). */
  light: string;
  dark: string;
  titleFont: string;
  titleWeight: TextElement["fontWeight"];
  titleUpper?: boolean;
  bodyFont: string;
  titleGlow?: string;
}

export const POSTER_STYLES: readonly PosterStyle[] = [
  {
    key: "minimal",
    name: "Minimal",
    description: "White, near-black, one accent",
    background: { color: "#ffffff" },
    overlay: { color: "#ffffff", opacity: 0.8 },
    shapeFill: "#2f5dff",
    stroke: "#2f5dff",
    icon: "#2f5dff",
    title: "#111111",
    body: "#1f2937",
    muted: "#4b5563",
    label: "#2f5dff",
    light: "#ffffff",
    dark: "#111111",
    titleFont: "DM Sans",
    titleWeight: 800,
    bodyFont: "DM Sans",
  },
  {
    key: "midnight",
    name: "Midnight",
    description: "Navy, white and gold, serif titles",
    background: { color: "#0f1a33", gradient: { from: "#1b2a4a", to: "#0b1020", angle: 160 } },
    overlay: { color: "#0b1020", opacity: 0.74 },
    shapeFill: "#c9aa6a",
    stroke: "#c9aa6a",
    icon: "#c9aa6a",
    title: "#ffffff",
    body: "#f1f5f9",
    muted: "#cbd5e1",
    label: "#e2cda0",
    light: "#ffffff",
    dark: "#0b1020",
    titleFont: "Playfair Display",
    titleWeight: 700,
    bodyFont: "Manrope",
  },
  {
    key: "neon",
    name: "Neon",
    description: "Black with glowing pink and cyan",
    background: { color: "#07070d" },
    overlay: { color: "#07070d", opacity: 0.78 },
    shapeFill: "#ff3dbb",
    stroke: "#22d3ee",
    icon: "#22d3ee",
    title: "#ffffff",
    body: "#f5f3ff",
    muted: "#e9d5ff",
    label: "#22d3ee",
    light: "#ffffff",
    dark: "#07070d",
    titleFont: "League Spartan",
    titleWeight: 900,
    titleUpper: true,
    bodyFont: "Montserrat",
    titleGlow: "#ff3dbb",
  },
  {
    key: "vintage",
    name: "Vintage",
    description: "Cream, brown and classic serif",
    background: { color: "#f3e9d2" },
    overlay: { color: "#f3e9d2", opacity: 0.82 },
    shapeFill: "#b45309",
    stroke: "#7c2d12",
    icon: "#9a3412",
    title: "#3e2a14",
    body: "#3e2a14",
    muted: "#5c4326",
    label: "#9a3412",
    light: "#fffaf0",
    dark: "#2b1d0e",
    titleFont: "DM Serif Display",
    titleWeight: 400,
    bodyFont: "Lora",
  },
  {
    key: "pastel",
    name: "Pastel",
    description: "Soft lavender, plum and gentle script",
    background: { color: "#f3e8ff", gradient: { from: "#f3e8ff", to: "#fce7f3", angle: 180 } },
    overlay: { color: "#f5f3ff", opacity: 0.82 },
    shapeFill: "#d8b4fe",
    stroke: "#a855f7",
    icon: "#9333ea",
    title: "#4a1d5e",
    body: "#4a1d5e",
    muted: "#6b3a7d",
    label: "#7e22ce",
    light: "#ffffff",
    dark: "#3b0764",
    titleFont: "Dancing Script",
    titleWeight: 700,
    bodyFont: "Raleway",
  },
];

export type PosterStyleKey = PosterStyle["key"];

export function posterStyle(key: string | null | undefined): PosterStyle | undefined {
  return POSTER_STYLES.find((s) => s.key === key);
}

// Approximate average character width of each font (in ems). Used only to
// shrink text when a style swaps in a wider font, so it keeps its line breaks.
const WIDTH: Record<string, number> = {
  Manrope: 0.56, Montserrat: 0.62, Raleway: 0.56, "League Spartan": 0.6, "DM Sans": 0.55,
  Oswald: 0.43, "Bebas Neue": 0.4, Anton: 0.46,
  "Playfair Display": 0.53, Cinzel: 0.72, Lora: 0.53, "Cormorant Garamond": 0.46, "DM Serif Display": 0.5,
  "Dancing Script": 0.45, "Great Vibes": 0.42, Pacifico: 0.58,
};
const widthOf = (font: string, upper: boolean) => (WIDTH[font] ?? 0.55) * (upper ? 1.18 : 1);

type Role = "title" | "label" | "body";
const TITLE_NAMES = new Set(["title", "series title", "headline", "couple's names", "years", "name"]);
const LABEL_NAMES = new Set(["label", "church name", "families line", "year", "reference"]);
/** Purely decorative text (watermarks, quote marks): an accent colour, kept faint where it was faint, no readability rule. */
const DECORATIVE_NAMES = new Set(["series number", "quote mark"]);

function roleOf(e: TextElement): Role {
  const name = (e.name ?? "").toLowerCase();
  if (TITLE_NAMES.has(name)) return "title";
  if (LABEL_NAMES.has(name) || (e.uppercase && e.letterSpacing > 0)) return "label";
  return "body";
}

function nearestWeight(font: string, weight: number): TextElement["fontWeight"] {
  const options = posterFont(font).weights;
  return options.reduce((best, w) => (Math.abs(w - weight) < Math.abs(best - weight) ? w : best), options[0]) as TextElement["fontWeight"];
}

function restyleText(e: TextElement, style: PosterStyle): TextElement {
  const role = roleOf(e);
  const font = role === "title" ? style.titleFont : style.bodyFont;
  const upper = role === "title" ? Boolean(style.titleUpper) || e.uppercase : e.uppercase;
  const shrink = Math.min(1, widthOf(e.fontFamily, e.uppercase) / widthOf(font, upper));
  const weight = role === "title" ? style.titleWeight : role === "label" ? 700 : e.fontWeight;
  const color = role === "title" ? style.title : role === "label" ? style.label : e.fontWeight >= 700 ? style.body : style.muted;
  return {
    ...e,
    fontFamily: font,
    fontWeight: nearestWeight(font, weight),
    fontSize: Math.round(e.fontSize * shrink * 10) / 10,
    uppercase: upper,
    fill: color,
    italic: role === "title" ? false : e.italic,
    shadow: role === "title" && style.titleGlow ? { color: style.titleGlow, blur: Math.round(e.fontSize * 0.25), offsetX: 0, offsetY: 0, opacity: 0.9 } : undefined,
    stroke: undefined,
  };
}

function restyleNonText<E extends Exclude<PosterElement, TextElement | GroupElement>>(e: E, style: PosterStyle): E {
  if (e.type === "shape") return { ...e, fill: e.fill ? style.shapeFill : null, stroke: e.stroke ? style.stroke : null };
  if (e.type === "icon") return { ...e, fill: style.icon };
  if (e.type === "image")
    return { ...e, overlay: e.overlay ? style.overlay : undefined, border: e.border ? { ...e.border, color: style.stroke } : undefined };
  return e;
}

/** Picks the style's colour if readable, otherwise its light or dark text colour, whichever reads best. */
function readable(text: TextElement, behind: string[], style: PosterStyle, shortSide: number): string {
  const need = requiredRatio(text.fontSize, text.fontWeight, shortSide);
  const worst = (c: string) => Math.min(...behind.map((b) => contrastRatio(c, b)));
  if (worst(text.fill) >= need) return text.fill;
  return [style.light, style.dark].sort((a, b) => worst(b) - worst(a))[0];
}

/** Applies a style to a whole design. Returns a new design; text, photos and positions are untouched. */
export function applyStyle(design: PosterDesign, key: PosterStyleKey): PosterDesign {
  const style = posterStyle(key);
  if (!style) return design;
  const shortSide = Math.min(design.width, design.height);
  const background: PosterDesign["background"] = {
    ...style.background,
    ...(design.background.image ? { image: { ...design.background.image, overlay: style.overlay } } : {}),
  };
  const restyled: PosterDesign = { ...design, background, elements: [] };

  // Restyle in drawing order so each text's readability check sees the restyled things beneath it.
  for (const e of design.elements) {
    if (e.type === "text" && DECORATIVE_NAMES.has((e.name ?? "").toLowerCase())) {
      restyled.elements.push({ ...e, fill: style.shapeFill, opacity: e.name === "Series number" ? 0.22 : e.opacity, shadow: undefined, stroke: undefined });
    } else if (e.type === "text") {
      const t = restyleText(e, style);
      const behind = colorsBehind(restyled, { x: t.x + t.width / 2, y: t.y + t.height / 2 }, restyled.elements);
      restyled.elements.push({ ...t, fill: readable(t, behind, style, shortSide) });
    } else if (e.type === "group") {
      const children: GroupElement["children"] = [];
      for (const c of e.children) {
        if (c.type === "text") {
          const t = restyleText(c, style);
          const behind = colorsBehind(restyled, { x: e.x + t.x + t.width / 2, y: e.y + t.y + t.height / 2 }, restyled.elements);
          children.push({ ...t, fill: readable(t, behind, style, shortSide) });
        } else {
          children.push(restyleNonText(c, style));
        }
      }
      restyled.elements.push({ ...e, children });
    } else {
      restyled.elements.push(restyleNonText(e, style));
    }
  }
  return restyled;
}
