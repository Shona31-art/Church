import { POSTER_SIZES, type IconElement, type ImageElement, type PosterSize, type ShapeElement, type TextElement } from "../design";

// A small toolkit for writing templates that work at every poster size.
//
// Units: x, widths, heights and font sizes are written for a 1080-px-wide
// poster and scaled by the real width (u). Vertical positions (y) are a
// fraction of the poster's height (0 = top, 1 = bottom), so a template
// spreads out naturally on a tall story or A4 page instead of stretching.

export interface Frame {
  W: number;
  H: number;
  /** Real pixels per template unit (poster width ÷ 1080). */
  u: number;
}

export function frame(size: PosterSize): Frame {
  const { width, height } = POSTER_SIZES[size];
  return { W: width, H: height, u: width / 1080 };
}

const r = (n: number) => Math.round(n);

interface TextOptions {
  /** Top of the text, as a fraction of the poster height. */
  y: number;
  x?: number;
  w?: number;
  size: number;
  font: string;
  weight?: TextElement["fontWeight"];
  color: string;
  align?: TextElement["align"];
  lh?: number;
  ls?: number;
  upper?: boolean;
  italic?: boolean;
  rotation?: number;
  shadow?: { color: string; blur: number; offsetY: number; offsetX?: number; opacity: number };
}

export function text(f: Frame, id: string, name: string, content: string, o: TextOptions): TextElement {
  const lh = o.lh ?? 1.15;
  const lines = content.split("\n").length;
  return {
    id,
    type: "text",
    name,
    x: r((o.x ?? 90) * f.u),
    y: r(o.y * f.H),
    width: r((o.w ?? 900) * f.u),
    height: r(o.size * f.u * lh * lines),
    rotation: o.rotation ?? 0,
    opacity: 1,
    text: content,
    fontFamily: o.font,
    fontSize: Math.round(o.size * f.u * 10) / 10,
    fontWeight: o.weight ?? 400,
    italic: o.italic ?? false,
    fill: o.color,
    align: o.align ?? "center",
    lineHeight: lh,
    letterSpacing: Math.round((o.ls ?? 0) * f.u * 10) / 10,
    uppercase: o.upper ?? false,
    ...(o.shadow
      ? { shadow: { color: o.shadow.color, blur: r(o.shadow.blur * f.u), offsetX: r((o.shadow.offsetX ?? 0) * f.u), offsetY: r(o.shadow.offsetY * f.u), opacity: o.shadow.opacity } }
      : {}),
  };
}

interface BoxOptions {
  x: number;
  y: number;
  w: number;
  /** Height in template units… */
  h?: number;
  /** …or as a fraction of the poster height (bands, backgrounds). */
  hf?: number;
  rotation?: number;
  opacity?: number;
  locked?: boolean;
}

function box(f: Frame, o: BoxOptions) {
  return {
    x: r(o.x * f.u),
    y: r(o.y * f.H),
    width: r(o.w * f.u),
    height: r(o.hf !== undefined ? o.hf * f.H : (o.h ?? o.w) * f.u),
    rotation: o.rotation ?? 0,
    opacity: o.opacity ?? 1,
    ...(o.locked ? { locked: true } : {}),
  };
}

export function shape(
  f: Frame,
  id: string,
  name: string,
  kind: ShapeElement["shape"],
  o: BoxOptions & { fill?: string | null; fillOpacity?: number; stroke?: string; strokeWidth?: number; radius?: number },
): ShapeElement {
  return {
    id,
    type: "shape",
    name,
    shape: kind,
    ...box(f, o),
    ...(kind === "line" ? { height: 0 } : {}),
    fill: kind === "line" ? null : o.fill ?? null,
    fillOpacity: o.fillOpacity ?? 1,
    stroke: o.stroke ?? null,
    strokeWidth: r((o.strokeWidth ?? 0) * f.u),
    cornerRadius: r((o.radius ?? 0) * f.u),
  };
}

/** An empty photo slot (clearly labelled) for the person to fill. */
export function photo(
  f: Frame,
  id: string,
  name: string,
  label: string,
  o: BoxOptions & { shape?: ImageElement["shape"]; radius?: number; border?: { color: string; width: number }; overlay?: { color: string; opacity: number } },
): ImageElement {
  return {
    id,
    type: "image",
    name,
    ...box(f, o),
    src: { kind: "placeholder", label },
    fit: "cover",
    shape: o.shape ?? "rect",
    cornerRadius: r((o.radius ?? 0) * f.u),
    ...(o.border ? { border: { color: o.border.color, width: r(o.border.width * f.u) } } : {}),
    ...(o.overlay ? { overlay: o.overlay } : {}),
  };
}

/** A full-bleed background photo slot with a darkening overlay so text stays readable. */
export function fullPhoto(f: Frame, label: string, overlay: { color: string; opacity: number }): ImageElement {
  return photo(f, "background-photo", "Background photo", label, { x: 0, y: 0, w: 1080, hf: 1, overlay });
}

/** One of the original icons from lib/posters/icons.ts (key), e.g. "cross" or "flame". */
export function icon(f: Frame, id: string, name: string, key: string, o: BoxOptions & { fill: string }): IconElement {
  return { id, type: "icon", name, icon: key, ...box(f, o), fill: o.fill };
}
