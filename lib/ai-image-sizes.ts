// Poster sizes for AI-designed posters (lib/ai-image.ts). Separate file so the
// browser can use it too (ai-image.ts is server-only).

export const POSTER_SIZES = {
  square: { label: "Square (Instagram, WhatsApp)", aspectRatio: "1:1" },
  portrait: { label: "Portrait (Facebook, print)", aspectRatio: "4:5" },
  story: { label: "Story / status (phone screen)", aspectRatio: "9:16" },
  a4: { label: "A4 / A3 print", aspectRatio: "3:4" },
} as const;
export type PosterSize = keyof typeof POSTER_SIZES;

export interface ImageInput {
  mimeType: string;
  /** base64, no data: prefix */
  data: string;
}
