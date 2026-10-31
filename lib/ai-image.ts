import "server-only";

/**
 * AI-designed posters: Google's Gemini image model draws a finished poster
 * from a description plus optional photos (and the church logo). Separate
 * from lib/ai.ts because only Gemini makes images (Claude writes text only).
 *
 * Like lib/ai.ts, this never throws: it returns { error } with a message a
 * person can act on, and logs the technical cause on the server.
 */

// Overridable so an operator can switch image model without a code change.
const IMAGE_MODEL = process.env.GEMINI_IMAGE_MODEL || "gemini-2.5-flash-image";
const GEMINI_URL = "https://generativelanguage.googleapis.com/v1beta/models";
// Drawing a poster takes longer than writing a sentence.
const TIMEOUT_MS = 90_000;

import { POSTER_SIZES, type ImageInput, type PosterSize } from "@/lib/ai-image-sizes";
export { POSTER_SIZES, type ImageInput, type PosterSize };

export function isPosterAiConfigured(): boolean {
  return Boolean(process.env.GEMINI_API_KEY);
}

/** The instructions sent with every request. Exported for tests. */
export function posterPrompt(input: { description: string; churchName: string; size: PosterSize; photoCount: number; hasLogo: boolean; refine?: string }): string {
  if (input.refine) {
    return [
      "Here is a church event poster you designed (the first image). Make this change and return the complete updated poster:",
      input.refine,
      "Keep everything else the same unless the change needs it. Spell every word exactly as given.",
      input.photoCount ? `The next ${input.photoCount} image(s) are the photos the person supplied; keep using them.` : "",
      input.hasLogo ? "The last image is the church's logo; keep it on the poster, unchanged." : "",
    ]
      .filter(Boolean)
      .join("\n");
  }
  return [
    `Design a finished, professional church event poster for ${input.churchName}.`,
    `What the person asked for: ${input.description}`,
    "",
    "Rules:",
    `- Aspect ratio ${POSTER_SIZES[input.size].aspectRatio}. A complete poster, ready to post or print — not a mock-up, not shown on a wall or in a frame.`,
    "- Put every piece of text the person gave (event name, dates, times, speakers, address, phone numbers) on the poster, spelled exactly as written. Don't invent dates, times, names, prices or contact details.",
    "- Clear hierarchy: the event name largest, then date/time and place. Text must be easy to read on a phone.",
    "- Tasteful, uplifting Christian design. Respectful imagery; no text in other languages unless asked.",
    input.photoCount
      ? `- Use the ${input.photoCount} supplied photo(s) prominently (e.g. the speaker or the venue). Keep people's faces natural and recognisable — don't change who they are.`
      : "",
    input.hasLogo ? "- The last image is the church's logo: place it small and neatly (e.g. a top or bottom corner), unchanged." : "",
  ]
    .filter(Boolean)
    .join("\n");
}

/** Gemini request body. Exported for tests. */
export function posterRequestBody(prompt: string, images: ImageInput[], size: PosterSize) {
  return {
    contents: [
      {
        role: "user",
        parts: [{ text: prompt }, ...images.map((img) => ({ inlineData: { mimeType: img.mimeType, data: img.data } }))],
      },
    ],
    generationConfig: {
      responseModalities: ["IMAGE", "TEXT"],
      imageConfig: { aspectRatio: POSTER_SIZES[size].aspectRatio },
    },
  };
}

interface GeminiImageResponse {
  candidates?: { content?: { parts?: { text?: string; inlineData?: { mimeType?: string; data?: string } }[] }; finishReason?: string }[];
  promptFeedback?: { blockReason?: string };
}

/** The first image in the reply, or a reason there isn't one. Exported for tests. */
export function posterFromResponse(json: GeminiImageResponse): { image: ImageInput } | { error: string } {
  const blocked = "The AI wouldn't draw that one. Try describing it differently.";
  if (json.promptFeedback?.blockReason) return { error: blocked };
  const candidate = json.candidates?.[0];
  if (!candidate) return { error: "The AI didn't send a poster back. Please try again." };
  const part = (candidate.content?.parts ?? []).find((p) => p.inlineData?.data);
  if (part?.inlineData?.data) return { image: { mimeType: part.inlineData.mimeType || "image/png", data: part.inlineData.data } };
  if (["SAFETY", "PROHIBITED_CONTENT", "IMAGE_SAFETY", "BLOCKLIST", "SPII"].includes(candidate.finishReason ?? "")) return { error: blocked };
  return { error: "The AI didn't send a poster back. Add a little more detail and try again." };
}

export async function generatePosterImage(input: {
  description: string;
  churchName: string;
  size: PosterSize;
  photos: ImageInput[];
  logo: ImageInput | null;
  /** To change an existing poster: the poster plus what to change. */
  previous?: ImageInput;
  refine?: string;
}): Promise<{ image: ImageInput } | { error: string }> {
  const key = process.env.GEMINI_API_KEY;
  if (!key) return { error: "AI posters need a Gemini API key (GEMINI_API_KEY). Ask your platform admin." };

  const prompt = posterPrompt({
    description: input.description,
    churchName: input.churchName,
    size: input.size,
    photoCount: input.photos.length,
    hasLogo: Boolean(input.logo),
    refine: input.previous ? input.refine : undefined,
  });
  const images = [...(input.previous ? [input.previous] : []), ...input.photos, ...(input.logo ? [input.logo] : [])];
  return requestImage(posterRequestBody(prompt, images, input.size), "poster");
}

/** Sends one image request to Gemini (one retry for busy/temporary errors). */
async function requestImage(requestBody: unknown, what: string): Promise<{ image: ImageInput } | { error: string }> {
  const key = process.env.GEMINI_API_KEY;
  if (!key) return { error: "AI pictures need a Gemini API key (GEMINI_API_KEY). Ask your platform admin." };
  const body = JSON.stringify(requestBody);
  const url = `${GEMINI_URL}/${encodeURIComponent(IMAGE_MODEL)}:generateContent`;

  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const res = await fetch(url, {
        method: "POST",
        headers: { "content-type": "application/json", "x-goog-api-key": key },
        body,
        signal: AbortSignal.timeout(TIMEOUT_MS),
        cache: "no-store",
      });
      if (res.ok) return posterFromResponse((await res.json()) as GeminiImageResponse);
      const detail = (await res.text()).slice(0, 300);
      if (attempt === 0 && (res.status === 429 || res.status >= 500)) continue;
      console.error(`[ai-image] Gemini error ${res.status} (model ${IMAGE_MODEL}${res.status === 404 ? " — check GEMINI_IMAGE_MODEL" : ""}): ${detail}`);
      if (res.status === 429) return { error: "The AI is busy right now. Wait a minute and try again." };
      if (res.status === 400 && /billing|quota|free tier|limit: 0/i.test(detail)) {
        return { error: "Your Gemini account can't make images yet: turn on billing for the API key in Google AI Studio." };
      }
      return { error: `Couldn't create the ${what} just now. Please try again.` };
    } catch (error) {
      if (attempt === 0) continue;
      console.error("[ai-image] request failed:", error);
      return { error: "The AI took too long to answer. Please try again." };
    }
  }
  return { error: `Couldn't create the ${what} just now. Please try again.` };
}

/** The instructions for a jigsaw picture. Exported for tests. */
export function jigsawPicturePrompt(story: string): string {
  return [
    `A beautiful, richly detailed painting of the Bible story: ${story}.`,
    "Style: reverent classical oil painting with warm, glowing light and vivid colour, like a fine illustrated Bible.",
    "People look natural and dignified, in clothing of Bible times. Respectful; nothing frightening or violent.",
    "Fill the whole square with interesting detail in every part (sky, people, land or water), because it will be cut into jigsaw pieces.",
    "No words, letters, captions, borders, frames or signatures anywhere in the image.",
  ].join("\n");
}

/** A square Bible picture for the jigsaw game. */
export async function generateJigsawPicture(story: string): Promise<{ image: ImageInput } | { error: string }> {
  return requestImage(posterRequestBody(jigsawPicturePrompt(story), [], "square"), "picture");
}
