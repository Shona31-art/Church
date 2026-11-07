"use server";

import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { getCurrentAppUser } from "@/lib/current-user";
import { checkModuleAccess } from "@/lib/paywall";
import { planIncludes, AI_NOT_ON_PLAN } from "@/lib/features";
import { can } from "@/lib/permissions";
import { consumeAiQuota } from "@/lib/ai-quota";
import { generatePosterImage, isPosterAiConfigured, POSTER_SIZES, type ImageInput, type PosterSize } from "@/lib/ai-image";

const MAX_IMAGE_CHARS = 1_400_000; // ~1 MB as base64; the browser shrinks photos well below this
const MAX_LOGO_BYTES = 2 * 1024 * 1024;

const imageSchema = z.object({
  mimeType: z.enum(["image/jpeg", "image/png", "image/webp"]),
  data: z.string().min(1).max(MAX_IMAGE_CHARS).regex(/^[A-Za-z0-9+/=]+$/),
});

const inputSchema = z.object({
  description: z.string().trim().min(10, "Describe the poster in a sentence or two — the event, date, time and place.").max(2000, "Keep the description under 2,000 characters."),
  size: z.enum(Object.keys(POSTER_SIZES) as [PosterSize, ...PosterSize[]]),
  photos: z.array(imageSchema).max(3, "Add up to 3 photos."),
  includeLogo: z.boolean(),
  previous: imageSchema.optional(),
  refine: z.string().trim().max(1000).optional(),
});

export type AiPosterResult = { ok: true; image: ImageInput } | { ok: false; error: string };

/** The church's uploaded logo (public link in churches.logo_url), as image data for the AI. */
async function loadLogo(url: string | null | undefined): Promise<ImageInput | null> {
  if (!url || !url.startsWith("https://")) return null;
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(10_000), cache: "no-store" });
    const type = res.headers.get("content-type")?.split(";")[0] ?? "";
    if (!res.ok || !["image/png", "image/jpeg", "image/webp"].includes(type)) return null;
    const bytes = Buffer.from(await res.arrayBuffer());
    if (bytes.length > MAX_LOGO_BYTES) return null;
    return { mimeType: type, data: bytes.toString("base64") };
  } catch {
    return null; // the poster is still made, just without the logo
  }
}

/**
 * Creates (or, with `previous` + `refine`, changes) a whole poster with AI.
 * Pastors, church admins and department leaders; Poster Studio and AI writing
 * help on the church's plan; counts toward the hourly AI allowance.
 */
export async function createAiPoster(input: {
  description: string;
  size: string;
  photos: ImageInput[];
  includeLogo: boolean;
  previous?: ImageInput;
  refine?: string;
}): Promise<AiPosterResult> {
  const me = await getCurrentAppUser();
  if (!me || !me.church_id) return { ok: false, error: "Your session has expired — sign in again." };
  if (!can(me.role, "makePosters")) return { ok: false, error: "Posters are made by pastors, church admins and department leaders." };
  if (!(await checkModuleAccess("ai_poster")).allowed) return { ok: false, error: "Poster Studio isn't included in your church's plan." };
  if (!(await planIncludes("ai_pictures"))) return { ok: false, error: AI_NOT_ON_PLAN };
  if (!isPosterAiConfigured()) return { ok: false, error: "AI posters need a Gemini API key (GEMINI_API_KEY). Ask your platform admin." };

  const parsed = inputSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Check the details and try again." };
  if (parsed.data.previous && !parsed.data.refine) return { ok: false, error: "Say what you'd like changed." };

  const quota = await consumeAiQuota("poster_image");
  if (!quota.ok) return { ok: false, error: quota.error };

  const { data: church } = await createClient().from("churches").select("name, logo_url").eq("id", me.church_id).maybeSingle();
  const logo = parsed.data.includeLogo ? await loadLogo(church?.logo_url) : null;

  const result = await generatePosterImage({
    description: parsed.data.description,
    churchName: church?.name ?? "our church",
    size: parsed.data.size,
    photos: parsed.data.photos,
    logo,
    previous: parsed.data.previous,
    refine: parsed.data.refine,
  });
  return "image" in result ? { ok: true, image: result.image } : { ok: false, error: result.error };
}
