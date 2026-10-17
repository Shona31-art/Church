import type { PosterDesign, PosterElement, ShapeElement, TextElement } from "./design";

// Operations on a design's elements, used by the editor. Pure functions that
// return a new design, so every change can go into undo history.
// Unit-tested in tests/unit/poster-editor.test.ts.

/** Short unique id for a new element. */
export function newId(prefix = "el"): string {
  return `${prefix}-${Math.random().toString(36).slice(2, 10)}`;
}

export const TEXT_PRESETS = {
  heading: { label: "Heading", fontSize: 0.1, fontWeight: 800, text: "Your heading" },
  subheading: { label: "Subheading", fontSize: 0.055, fontWeight: 600, text: "A subheading" },
  body: { label: "Body text", fontSize: 0.035, fontWeight: 400, text: "Add details like the date, time and place." },
} as const;

/** A new text box, sized relative to the poster so presets look right at every size. */
export function createText(design: PosterDesign, preset: keyof typeof TEXT_PRESETS, fontFamily: string): TextElement {
  const p = TEXT_PRESETS[preset];
  const fontSize = Math.round(Math.min(design.width, design.height) * p.fontSize);
  const width = Math.round(design.width * 0.8);
  return {
    id: newId("text"),
    type: "text",
    name: p.label,
    x: Math.round((design.width - width) / 2),
    y: Math.round(design.height * 0.4),
    width,
    height: Math.round(fontSize * 1.3),
    rotation: 0,
    opacity: 1,
    text: p.text,
    fontFamily,
    fontSize,
    fontWeight: p.fontWeight,
    italic: false,
    fill: luminance(design.background.color) > 0.5 ? "#14161a" : "#ffffff",
    align: "center",
    lineHeight: 1.2,
    letterSpacing: 0,
    uppercase: false,
  };
}

export function createShape(design: PosterDesign, shape: ShapeElement["shape"]): ShapeElement {
  const side = Math.round(Math.min(design.width, design.height) * 0.3);
  const isLine = shape === "line";
  return {
    id: newId("shape"),
    type: "shape",
    name: { rect: "Rectangle", ellipse: "Circle", line: "Line", triangle: "Triangle" }[shape],
    shape,
    x: Math.round((design.width - side) / 2),
    y: Math.round((design.height - (isLine ? 0 : side)) / 2),
    width: side,
    height: isLine ? 0 : side,
    rotation: 0,
    opacity: 1,
    fill: isLine ? null : "#c9aa6a",
    fillOpacity: 1,
    stroke: isLine ? "#c9aa6a" : null,
    strokeWidth: isLine ? Math.max(4, Math.round(side / 40)) : 0,
    cornerRadius: 0,
  };
}

export function findElement(design: PosterDesign, id: string | null): PosterElement | undefined {
  return id ? design.elements.find((e) => e.id === id) : undefined;
}

export function addElement(design: PosterDesign, element: PosterElement): PosterDesign {
  return { ...design, elements: [...design.elements, element] };
}

/** Merges changes into one element (top level). The type can't change. */
export function updateElement(design: PosterDesign, id: string, changes: Partial<PosterElement>): PosterDesign {
  return {
    ...design,
    elements: design.elements.map((e) => (e.id === id ? ({ ...e, ...changes, id: e.id, type: e.type } as PosterElement) : e)),
  };
}

export function removeElement(design: PosterDesign, id: string): PosterDesign {
  return { ...design, elements: design.elements.filter((e) => e.id !== id) };
}

/** A copy placed slightly down and right, on top of everything. Group children get new ids too. */
export function duplicateElement(design: PosterDesign, id: string): { design: PosterDesign; newId: string | null } {
  const original = findElement(design, id);
  if (!original) return { design, newId: null };
  const offset = Math.round(Math.min(design.width, design.height) * 0.03);
  const copy = {
    ...structuredClone(original),
    id: newId(original.type),
    x: original.x + offset,
    y: original.y + offset,
    locked: false,
  } as PosterElement;
  if (copy.type === "group") copy.children = copy.children.map((c) => ({ ...c, id: newId(c.type) }));
  return { design: addElement(design, copy), newId: copy.id };
}

/** Moves an element up/down one layer, or to the very top/bottom. */
export function reorderElement(design: PosterDesign, id: string, where: "forward" | "backward" | "front" | "back"): PosterDesign {
  const list = [...design.elements];
  const from = list.findIndex((e) => e.id === id);
  if (from < 0) return design;
  const to = { forward: Math.min(list.length - 1, from + 1), backward: Math.max(0, from - 1), front: list.length - 1, back: 0 }[where];
  if (to === from) return design;
  const [item] = list.splice(from, 1);
  list.splice(to, 0, item);
  return { ...design, elements: list };
}

/**
 * What a resize means for an element. Canvas libraries resize by scaling;
 * we fold the scale back into real sizes so nothing is stored stretched.
 * Text: dragging a side handle (uneven scale) changes the box width and
 * re-wraps; dragging a corner (even scale) makes the text bigger or smaller.
 */
export function applyResize(element: PosterElement, scaleX: number, scaleY: number): Partial<PosterElement> {
  const width = Math.max(5, Math.round(element.width * scaleX));
  const height = Math.max(element.type === "shape" && element.shape === "line" ? 0 : 5, Math.round(element.height * scaleY));
  if (element.type === "text") {
    const even = Math.abs(scaleX - scaleY) < 0.01;
    return even
      ? { width, height, fontSize: clamp(Math.round(element.fontSize * scaleY * 10) / 10, 6, 1200) }
      : { width, height: element.height };
  }
  return { width, height };
}

/** Relative luminance (0 dark … 1 light) of a #rrggbb colour. */
export function luminance(hex: string): number {
  const [r, g, b] = [1, 3, 5].map((i) => {
    const c = parseInt(hex.slice(i, i + 2), 16) / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

function clamp(n: number, min: number, max: number) {
  return Math.min(max, Math.max(min, n));
}
