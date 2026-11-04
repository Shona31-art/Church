import { DESIGN_VERSION, POSTER_SIZES, blankDesign, type PosterDesign, type PosterSize } from "../design";
import { TEMPLATE_DEFINITIONS, type Occasion, type TemplateDefinition } from "./catalog";
import { absoluteFrame, frame } from "./kit";
import { LANDSCAPE_LAYOUTS } from "./catalog-landscape";
import { MORE_TEMPLATES } from "./catalog-more";
import { FLYER_TEMPLATES } from "./catalog-flyers";

// The template catalogue (definitions in catalog.ts). Each template builds a
// fresh design for whichever size is chosen.

export type { Occasion, TemplateDefinition };
// The bold church flyers come first.
export const POSTER_TEMPLATES: readonly TemplateDefinition[] = [...FLYER_TEMPLATES, ...TEMPLATE_DEFINITIONS, ...MORE_TEMPLATES];
export const OCCASIONS: readonly Occasion[] = ["Flyers", "Services", "Events", "Seasons", "Celebrations", "Groups", "Outreach", "Social posts", "General"];

/** A fresh copy of a template at the chosen size (or a blank design if the key is unknown). */
export function templateDesign(key: string | undefined, size: PosterSize): PosterDesign {
  const template = POSTER_TEMPLATES.find((t) => t.key === key);
  if (!template) return blankDesign(size);
  const { width, height } = POSTER_SIZES[size];
  // Landscape uses the template's hand-made layout when it has one (catalog-landscape.ts).
  const handMade = size === "landscape" ? LANDSCAPE_LAYOUTS[template.key] : undefined;
  const built = handMade ? handMade(absoluteFrame(frame(size))) : template.build(frame(size));
  return { version: DESIGN_VERSION, size, width, height, templateKey: template.key, ...built };
}
