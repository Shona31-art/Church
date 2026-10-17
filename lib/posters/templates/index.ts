import { blankDesign, type PosterDesign, type PosterSize } from "../design";
import { resizeDesign } from "../layout";
import { worshipNightSquare } from "./worship-night";

// The template catalogue. Each template is an original design stored as data
// (a PosterDesign). Step 3 of the plan adds the other 15 and hand-tuned
// portrait layouts; until then, other sizes are derived from the square one.

export interface PosterTemplate {
  key: string;
  name: string;
  occasion: string;
  layouts: Partial<Record<PosterSize, PosterDesign>> & { square: PosterDesign };
}

export const POSTER_TEMPLATES: readonly PosterTemplate[] = [
  { key: "worship-night", name: "Worship Night", occasion: "Worship", layouts: { square: worshipNightSquare } },
];

/** A fresh copy of a template at the chosen size (or a blank design if the key is unknown). */
export function templateDesign(key: string | undefined, size: PosterSize): PosterDesign {
  const template = POSTER_TEMPLATES.find((t) => t.key === key);
  if (!template) return blankDesign(size);
  const design = template.layouts[size] ?? resizeDesign(template.layouts.square, size);
  return structuredClone(design);
}
