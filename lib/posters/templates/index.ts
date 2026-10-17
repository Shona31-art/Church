import { DESIGN_VERSION, POSTER_SIZES, blankDesign, type PosterDesign, type PosterSize } from "../design";
import { TEMPLATE_DEFINITIONS, type Occasion, type TemplateDefinition } from "./catalog";
import { frame } from "./kit";
import { MORE_TEMPLATES } from "./catalog-more";

// The template catalogue (definitions in catalog.ts). Each template builds a
// fresh design for whichever size is chosen.

export type { Occasion, TemplateDefinition };
export const POSTER_TEMPLATES: readonly TemplateDefinition[] = [...TEMPLATE_DEFINITIONS, ...MORE_TEMPLATES];
export const OCCASIONS: readonly Occasion[] = ["Services", "Events", "Seasons", "Celebrations", "Groups", "Outreach", "Social posts", "General"];

/** A fresh copy of a template at the chosen size (or a blank design if the key is unknown). */
export function templateDesign(key: string | undefined, size: PosterSize): PosterDesign {
  const template = POSTER_TEMPLATES.find((t) => t.key === key);
  if (!template) return blankDesign(size);
  const { width, height } = POSTER_SIZES[size];
  return { version: DESIGN_VERSION, size, width, height, templateKey: template.key, ...template.build(frame(size)) };
}
