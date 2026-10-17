import { luminance } from "./elements";
import type { PosterDesign, PosterElement } from "./design";

// Colour contrast for poster text (WCAG 2.1): used by the style engine to
// keep restyled text readable. The template tests check the same thing with
// their own independent implementation.

/** WCAG contrast ratio between two #rrggbb colours (1–21). */
export function contrastRatio(a: string, b: string): number {
  const [x, y] = [luminance(a), luminance(b)].sort((p, q) => q - p);
  return (x + 0.05) / (y + 0.05);
}

/** `fg` laid over `bg` at opacity `alpha`, as #rrggbb. */
export function mix(fg: string, bg: string, alpha: number): string {
  const channel = (hex: string, i: number) => parseInt(hex.slice(i, i + 2), 16);
  return "#" + [1, 3, 5].map((i) => Math.round(channel(fg, i) * alpha + channel(bg, i) * (1 - alpha)).toString(16).padStart(2, "0")).join("");
}

/** AA needs 4.5:1 for normal text, 3:1 for large (≥ 48 px, or ≥ 37 px bold, on a 1080-wide poster). */
export function requiredRatio(fontSize: number, fontWeight: number, posterShortSide: number): number {
  const unit = posterShortSide / 1080;
  return fontSize >= 48 * unit || (fontSize >= 37 * unit && fontWeight >= 700) ? 3 : 4.5;
}

/**
 * The colours that could be behind a point on the poster: the background
 * (gradients blended at that height), then each earlier element covering it.
 * Unknown photos are assumed to be anything from mid-grey to white, so the
 * result is a list and text must work on all of them.
 */
export function colorsBehind(design: PosterDesign, point: { x: number; y: number }, below: readonly PosterElement[]): string[] {
  const bg = design.background;
  let behind = [bg.gradient ? mix(bg.gradient.to, bg.gradient.from, point.y / design.height) : bg.color];
  if (bg.image?.overlay) behind = ["#9aa0aa", "#ffffff"].map((photo) => mix(bg.image!.overlay!.color, photo, bg.image!.overlay!.opacity));
  for (const s of below) {
    if (point.x < s.x || point.x > s.x + s.width || point.y < s.y || point.y > s.y + s.height) continue;
    if (s.type === "shape" && s.fill && s.shape !== "line") behind = behind.map((b) => mix(s.fill!, b, s.opacity * s.fillOpacity));
    if (s.type === "image") {
      behind = s.overlay ? ["#9aa0aa", "#ffffff"].map((photo) => mix(s.overlay!.color, photo, s.overlay!.opacity)) : ["#9aa0aa", "#ffffff", "#000000"];
    }
  }
  return behind;
}
