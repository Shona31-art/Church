import { z } from "zod";

// Entrance animations for poster video export (plan: docs/plans/poster-editor-v2.md §3).
//
// Each element may carry an optional `animation` (saved inside the design),
// so posters made before this existed keep working: no animation means the
// element is simply there from the first frame. Everything here is pure, so
// the timing maths is unit-tested without a browser.

export const ENTRANCES = ["none", "fade", "slide-up", "slide-left", "slide-right", "zoom", "pop"] as const;
export type Entrance = (typeof ENTRANCES)[number];

export const ENTRANCE_LABELS: Record<Entrance, string> = {
  none: "None",
  fade: "Fade in",
  "slide-up": "Slide up",
  "slide-left": "Slide in from the left",
  "slide-right": "Slide in from the right",
  zoom: "Zoom in",
  pop: "Pop",
};

export const MAX_DELAY = 5;

export const AnimationSchema = z.object({
  entrance: z.enum(ENTRANCES),
  /** Seconds after the video starts. */
  delay: z.number().min(0).max(MAX_DELAY).default(0),
});
export type ElementAnimation = z.infer<typeof AnimationSchema>;

/** How long one entrance takes, in seconds. */
export const ENTRANCE_SECONDS = 0.8;
/** Still time at the end, so the finished poster can be read. */
export const HOLD_SECONDS = 2.5;
export const MIN_VIDEO_SECONDS = 6;
export const MAX_VIDEO_SECONDS = 10;
export const VIDEO_FPS = 30;

/** Where an element is drawn at a moment in the video, relative to where it rests. */
export interface FrameState {
  /** Multiplies the element's own opacity. */
  opacity: number;
  /** Offset in poster pixels. */
  dx: number;
  dy: number;
  /** Scale around the element's centre. */
  scale: number;
}

const REST: FrameState = { opacity: 1, dx: 0, dy: 0, scale: 1 };

const easeOutCubic = (p: number) => 1 - Math.pow(1 - p, 3);
// Overshoots a little past 1 before settling: the "pop".
const easeOutBack = (p: number) => {
  const c1 = 1.70158;
  const c3 = c1 + 1;
  return 1 + c3 * Math.pow(p - 1, 3) + c1 * Math.pow(p - 1, 2);
};

/**
 * The element's state `t` seconds into the video. `travel` is how far slides
 * move, in poster pixels (a share of the poster's size, so it looks the same
 * on every format).
 */
export function frameState(animation: ElementAnimation | undefined, t: number, travel: number): FrameState {
  if (!animation || animation.entrance === "none") return REST;
  const p = Math.min(1, Math.max(0, (t - animation.delay) / ENTRANCE_SECONDS));
  if (p >= 1) return REST;
  const e = easeOutCubic(p);
  switch (animation.entrance) {
    case "fade":
      return { ...REST, opacity: e };
    case "slide-up":
      return { ...REST, opacity: e, dy: (1 - e) * travel };
    case "slide-left":
      return { ...REST, opacity: e, dx: -(1 - e) * travel };
    case "slide-right":
      return { ...REST, opacity: e, dx: (1 - e) * travel };
    case "zoom":
      return { ...REST, opacity: e, scale: 0.85 + 0.15 * e };
    case "pop":
      return { ...REST, opacity: Math.min(1, p * 3), scale: Math.max(0, 0.4 + 0.6 * easeOutBack(p)) };
  }
}

/** Slide distance for a poster: 8% of its shorter side. */
export function travelFor(width: number, height: number): number {
  return Math.round(Math.min(width, height) * 0.08);
}

/** Video length: every entrance finishes, then a hold — between 6 and 10 seconds. */
export function videoSeconds(animations: readonly (ElementAnimation | undefined)[]): number {
  const lastEnd = animations.reduce((end, a) => (a && a.entrance !== "none" ? Math.max(end, a.delay + ENTRANCE_SECONDS) : end), 0);
  return Math.min(MAX_VIDEO_SECONDS, Math.max(MIN_VIDEO_SECONDS, Math.ceil((lastEnd + HOLD_SECONDS) * 10) / 10));
}

interface Animatable {
  id: string;
  type: string;
  y: number;
  height: number;
  animation?: ElementAnimation;
}

/**
 * "Animate everything": a tasteful staggered sequence, top of the poster
 * first. Full-bleed backgrounds (elements as big as the poster) fade quickly
 * so they don't compete with the words.
 */
export function animateAll<T extends Animatable>(elements: readonly T[], posterHeight: number): T[] {
  const order = [...elements].sort((a, b) => a.y - b.y).map((e) => e.id);
  return elements.map((e) => {
    const rank = order.indexOf(e.id);
    const big = e.height >= posterHeight * 0.8;
    const entrance: Entrance = big ? "fade" : e.type === "text" ? "slide-up" : e.type === "icon" ? "pop" : e.type === "image" || e.type === "group" ? "zoom" : "fade";
    const delay = big ? 0 : Math.min(MAX_DELAY, Math.round((0.2 + rank * 0.3) * 10) / 10);
    return { ...e, animation: { entrance, delay } };
  });
}

/** Removes every element's animation. */
export function clearAnimations<T extends Animatable>(elements: readonly T[]): T[] {
  return elements.map((e) => {
    const rest = { ...e };
    delete rest.animation;
    return rest;
  });
}

/**
 * Pixel size of the video. Full HD at most (the longest side ≤ 1920, the
 * shortest ≤ 1080) — A4 posters are scaled down — and always even numbers,
 * which video encoders require. `lowMemory` halves it (720p-class) for
 * phones that can't record at full size.
 */
export function videoSize(width: number, height: number, lowMemory = false): { width: number; height: number } {
  const longest = lowMemory ? 1280 : 1920;
  const shortest = lowMemory ? 720 : 1080;
  const ratio = Math.min(1, longest / Math.max(width, height), shortest / Math.min(width, height));
  const even = (n: number) => Math.max(2, Math.round((n * ratio) / 2) * 2);
  return { width: even(width), height: even(height) };
}

/** MP4 where the browser can record it (Safari, newer Chrome), otherwise WebM. */
export const VIDEO_TYPES = ["video/mp4;codecs=avc1", "video/mp4", "video/webm;codecs=vp9", "video/webm;codecs=vp8", "video/webm"] as const;

export function pickVideoType(isSupported: (type: string) => boolean): { mimeType: string; extension: "mp4" | "webm" } | null {
  const mimeType = VIDEO_TYPES.find((t) => isSupported(t));
  if (!mimeType) return null;
  return { mimeType, extension: mimeType.startsWith("video/mp4") ? "mp4" : "webm" };
}

/**
 * Offset that keeps a scaled element centred: Konva scales around the
 * element's origin (its top-left corner, turned by its rotation), so move the
 * origin toward the centre by (1 − scale) × the half-size, rotated the same way.
 */
export function centredScaleOffset(width: number, height: number, rotationDegrees: number, scale: number): { dx: number; dy: number } {
  const r = (rotationDegrees * Math.PI) / 180;
  const cx = (width / 2) * Math.cos(r) - (height / 2) * Math.sin(r);
  const cy = (width / 2) * Math.sin(r) + (height / 2) * Math.cos(r);
  return { dx: (1 - scale) * cx, dy: (1 - scale) * cy };
}
