import { POSTER_SIZES, type PosterDesign, type PosterElement, type PosterSize } from "./design";

// Moving a design to another size (e.g. square → story). Positions follow
// the poster's width and height proportionally; sizes and text scale by the
// smaller of the two ratios so nothing gets stretched. Templates can supply a
// hand-made layout per size instead (lib/posters/templates/).
// Unit-tested in tests/unit/poster-editor.test.ts.

export function resizeDesign(design: PosterDesign, size: PosterSize): PosterDesign {
  const target = POSTER_SIZES[size];
  if (design.size === size) return design;
  const rx = target.width / design.width;
  const ry = target.height / design.height;
  const r = Math.min(rx, ry);

  const scaleElement = <E extends PosterElement>(e: E, isChild: boolean): E => {
    // Children of a group are positioned inside it, so they only scale.
    const width = e.width * r;
    const height = e.height * r;
    const x = isChild ? e.x * r : e.x * rx + (e.width * rx - width) / 2;
    const y = isChild ? e.y * r : e.y * ry + (e.height * ry - height) / 2;
    const scaled = { ...e, x: Math.round(x), y: Math.round(y), width: Math.round(width), height: Math.round(height) };
    if (scaled.type === "text") return { ...scaled, fontSize: Math.round(scaled.fontSize * r * 10) / 10 } as E;
    if (scaled.type === "shape") return { ...scaled, strokeWidth: Math.round(scaled.strokeWidth * r), cornerRadius: Math.round(scaled.cornerRadius * r) } as E;
    if (scaled.type === "image") return { ...scaled, cornerRadius: Math.round(scaled.cornerRadius * r) } as E;
    if (scaled.type === "group") return { ...scaled, children: scaled.children.map((c) => scaleElement(c, true)) } as E;
    return scaled as E;
  };

  return { ...design, size, width: target.width, height: target.height, elements: design.elements.map((e) => scaleElement(e, false)) };
}
