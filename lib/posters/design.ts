import { z } from "zod";

// The saved format of an editable poster (posters.design, version 1).
// Shared by the editor (client) and the save action (server): the server
// re-validates every design with PosterDesignSchema before storing it, so a
// tampered request can't save scripts, outside image URLs or huge payloads.
// Decision record: docs/adr/0003-poster-editor.md
//
// Coordinates are in poster pixels (e.g. 0–1080 for a square poster), with
// the origin at the top-left. Elements are drawn in array order (last = top).

export const DESIGN_VERSION = 1;

export const POSTER_SIZES = {
  square: { width: 1080, height: 1080, label: "Square", hint: "Instagram & Facebook posts" },
  portrait: { width: 1080, height: 1350, label: "Portrait", hint: "Instagram portrait posts" },
  story: { width: 1080, height: 1920, label: "Story", hint: "WhatsApp status & stories" },
  a4: { width: 2480, height: 3508, label: "A4 print", hint: "Printing at 300 dpi" },
} as const;
export type PosterSize = keyof typeof POSTER_SIZES;
export const POSTER_SIZE_KEYS = Object.keys(POSTER_SIZES) as PosterSize[];

export const MAX_ELEMENTS = 120;
export const MAX_TEXT_LENGTH = 1000;
export const FONT_WEIGHTS = [300, 400, 500, 600, 700, 800, 900] as const;

const hex = z.string().regex(/^#[0-9a-fA-F]{6}$/, "Colours are #rrggbb");
const id = z.string().regex(/^[A-Za-z0-9_-]{1,40}$/);
const coord = z.number().finite().min(-20000).max(20000);
const length = z.number().finite().min(0).max(20000);
const opacity = z.number().min(0).max(1);

/**
 * Where an image comes from. Only three kinds, so a design can never point
 * the browser at an arbitrary outside URL:
 *   asset       — the church's own upload (resolved to a signed URL at load)
 *   stock       — a Pexels photo (images.pexels.com only), with attribution
 *   placeholder — an empty "add a photo" slot from a template
 */
export const ImageSourceSchema = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("asset"), assetId: z.string().uuid(), path: z.string().max(300) }),
  z.object({
    kind: z.literal("stock"),
    provider: z.literal("pexels"),
    url: z.string().url().max(500).refine((u) => new URL(u).hostname === "images.pexels.com", "Stock photos must come from Pexels"),
    photographer: z.string().max(120),
    photographerUrl: z.string().url().max(300).refine((u) => new URL(u).hostname.endsWith("pexels.com"), "Pexels link expected"),
    pageUrl: z.string().url().max(300).refine((u) => new URL(u).hostname.endsWith("pexels.com"), "Pexels link expected"),
  }),
  z.object({ kind: z.literal("placeholder"), label: z.string().max(60) }),
]);
export type ImageSource = z.infer<typeof ImageSourceSchema>;

const base = {
  id,
  x: coord,
  y: coord,
  width: length,
  height: length,
  rotation: z.number().finite().min(-360).max(360).default(0),
  opacity: opacity.default(1),
  locked: z.boolean().optional(),
  /** Shown in the Layers panel, e.g. "Speaker name". */
  name: z.string().max(60).optional(),
};

export const TextElementSchema = z.object({
  ...base,
  type: z.literal("text"),
  text: z.string().max(MAX_TEXT_LENGTH),
  fontFamily: z.string().regex(/^[A-Za-z0-9 ]{1,40}$/),
  fontSize: z.number().min(6).max(1200),
  fontWeight: z.union(FONT_WEIGHTS.map((w) => z.literal(w)) as [z.ZodLiteral<300>, ...z.ZodLiteral<number>[]]),
  italic: z.boolean().default(false),
  fill: hex,
  align: z.enum(["left", "center", "right"]).default("left"),
  lineHeight: z.number().min(0.5).max(3).default(1.2),
  letterSpacing: z.number().min(-50).max(200).default(0),
  uppercase: z.boolean().default(false),
  shadow: z.object({ color: hex, blur: z.number().min(0).max(100), offsetX: coord, offsetY: coord, opacity }).optional(),
  stroke: z.object({ color: hex, width: z.number().min(0).max(50) }).optional(),
});

export const ImageElementSchema = z.object({
  ...base,
  type: z.literal("image"),
  src: ImageSourceSchema,
  fit: z.enum(["cover", "contain"]).default("cover"),
  shape: z.enum(["rect", "rounded", "circle"]).default("rect"),
  cornerRadius: z.number().min(0).max(2000).default(0),
  border: z.object({ color: hex, width: z.number().min(0).max(100) }).optional(),
  /** Darkens/tints the photo so text on top stays readable. */
  overlay: z.object({ color: hex, opacity }).optional(),
});

export const ShapeElementSchema = z.object({
  ...base,
  type: z.literal("shape"),
  shape: z.enum(["rect", "ellipse", "line", "triangle"]),
  fill: hex.nullable(),
  fillOpacity: opacity.default(1),
  stroke: hex.nullable().default(null),
  strokeWidth: z.number().min(0).max(200).default(0),
  cornerRadius: z.number().min(0).max(2000).default(0),
});

/** An original decorative icon from public/posters/elements/ (cross, dove…), by key. */
export const IconElementSchema = z.object({
  ...base,
  type: z.literal("icon"),
  icon: z.string().regex(/^[a-z0-9-]{1,40}$/),
  fill: hex,
});

const LeafElementSchema = z.discriminatedUnion("type", [TextElementSchema, ImageElementSchema, ShapeElementSchema, IconElementSchema]);

/** A group moves and resizes as one, e.g. a speaker block (photo + name + title). No groups inside groups. */
export const GroupElementSchema = z.object({
  ...base,
  type: z.literal("group"),
  role: z.enum(["speaker", "custom"]).default("custom"),
  children: z.array(LeafElementSchema).min(1).max(12),
});

export const ElementSchema = z.discriminatedUnion("type", [TextElementSchema, ImageElementSchema, ShapeElementSchema, IconElementSchema, GroupElementSchema]);
export type PosterElement = z.infer<typeof ElementSchema>;
export type TextElement = z.infer<typeof TextElementSchema>;
export type ImageElement = z.infer<typeof ImageElementSchema>;
export type ShapeElement = z.infer<typeof ShapeElementSchema>;
export type IconElement = z.infer<typeof IconElementSchema>;
export type GroupElement = z.infer<typeof GroupElementSchema>;

export const BackgroundSchema = z.object({
  color: hex,
  gradient: z.object({ from: hex, to: hex, angle: z.number().min(0).max(360) }).optional(),
  image: z
    .object({
      src: ImageSourceSchema,
      overlay: z.object({ color: hex, opacity }).optional(),
    })
    .optional(),
});

export const PosterDesignSchema = z
  .object({
    version: z.literal(DESIGN_VERSION),
    size: z.enum(POSTER_SIZE_KEYS as [PosterSize, ...PosterSize[]]),
    width: z.number().int().min(100).max(5000),
    height: z.number().int().min(100).max(5000),
    background: BackgroundSchema,
    elements: z.array(ElementSchema).max(MAX_ELEMENTS),
    /** Which template it started from, for the record. */
    templateKey: z.string().regex(/^[a-z0-9-]{1,40}$/).optional(),
  })
  .refine((d) => d.width === POSTER_SIZES[d.size].width && d.height === POSTER_SIZES[d.size].height, "Width and height must match the chosen size")
  .refine((d) => new Set(allElements(d.elements).map((e) => e.id)).size === allElements(d.elements).length, "Element ids must be unique");

export type PosterDesign = z.infer<typeof PosterDesignSchema>;

/** Top-level elements plus the children of groups. */
export function allElements(elements: readonly PosterElement[]): Exclude<PosterElement, GroupElement>[] | PosterElement[] {
  return elements.flatMap((e) => (e.type === "group" ? [e, ...e.children] : [e]));
}

/** Storage paths of every uploaded photo a design uses (background and elements), for signing and the data export. */
export function assetPaths(design: PosterDesign): string[] {
  const sources: ImageSource[] = [];
  if (design.background.image) sources.push(design.background.image.src);
  for (const e of allElements(design.elements)) if (e.type === "image") sources.push(e.src);
  return [...new Set(sources.flatMap((s) => (s.kind === "asset" ? [s.path] : [])))];
}

/** A new, empty design of the given size. */
export function blankDesign(size: PosterSize): PosterDesign {
  return { version: DESIGN_VERSION, size, width: POSTER_SIZES[size].width, height: POSTER_SIZES[size].height, background: { color: "#ffffff" }, elements: [] };
}
