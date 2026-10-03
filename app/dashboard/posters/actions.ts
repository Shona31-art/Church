"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { getCurrentAppUser } from "@/lib/current-user";
import { checkModuleAccess } from "@/lib/paywall";
import { generateText, isAiConfigured } from "@/lib/ai";
import { consumeAiQuota } from "@/lib/ai-quota";
import { flash } from "@/lib/flash";
import { POSTER_FORMATS, POSTER_TEMPLATES, isHexColor, isPosterRole } from "@/lib/posters";

// Server actions are public endpoints, so both actions re-check the role and
// plan — the page hiding the button isn't enough (anyone could call the AI
// action directly and spend the church's AI credits).
async function requirePosterMaker() {
  const me = await getCurrentAppUser();
  if (!me || !isPosterRole(me.role)) return null;
  const access = await checkModuleAccess("ai_poster");
  return access.allowed ? me : null;
}

const FALLBACK_TAGLINE = "Join us — everyone welcome.";

/**
 * Suggests a short tagline. Returns { tagline } (AI or a fixed fallback), plus
 * { notice } when the fallback was used for a reason the user should know.
 */
export async function generatePosterTagline(params: {
  eventTitle: string;
  speaker?: string;
  eventDate?: string;
}): Promise<{ tagline?: string; notice?: string }> {
  const me = await requirePosterMaker();
  if (!me) return { notice: "Only pastors, admins and department leaders can use the poster tools." };
  if (!isAiConfigured()) return { tagline: FALLBACK_TAGLINE };
  if (!(await consumeAiQuota("poster_tagline")).ok) {
    return { tagline: FALLBACK_TAGLINE, notice: "You've reached the hourly AI limit — here's a standard tagline instead." };
  }

  // Inputs are capped so a pasted essay can't run up the token bill.
  const title = params.eventTitle.slice(0, 120);
  const speaker = params.speaker?.slice(0, 80);
  const date = params.eventDate?.slice(0, 80);
  const text = await generateText({
    maxTokens: 100,
    prompt: `Write ONE short, warm, inviting tagline (under 10 words, no quotation marks) for a church event poster. Event: "${title}"${speaker ? `, speaker: ${speaker}` : ""}${date ? `, on ${date}` : ""}. Respond with ONLY the tagline text, nothing else.`,
  });
  if (!text) return { tagline: FALLBACK_TAGLINE, notice: "The AI didn't respond — here's a standard tagline instead." };
  return { tagline: text.replace(/^["']|["']$/g, "").slice(0, 120) };
}

const optionalText = (max: number) => z.string().trim().max(max, `Keep this under ${max} characters.`).optional();

const PosterSchema = z.object({
  eventTitle: z.string().trim().min(1, "Give the event a title.").max(120, "Keep the title under 120 characters."),
  tagline: optionalText(120),
  speaker: optionalText(80),
  eventDate: optionalText(80),
  location: optionalText(120),
  templateKey: z.enum(POSTER_TEMPLATES),
  themeColor: z.string().refine(isHexColor, "Choose one of the colours."),
  format: z.enum(POSTER_FORMATS),
});

/**
 * Create or edit. Form fields: poster_id? (edit), event_title, tagline?,
 * speaker?, event_date?, location?, template_key, theme_color, format
 */
export async function savePoster(_prev: { error?: string } | null, formData: FormData): Promise<{ error?: string } | null> {
  const me = await requirePosterMaker();
  if (!me) return { error: "Only pastors, admins and department leaders can save posters. If you are one, sign in again." };

  const parsed = PosterSchema.safeParse({
    eventTitle: formData.get("event_title"),
    tagline: formData.get("tagline") || undefined,
    speaker: formData.get("speaker") || undefined,
    eventDate: formData.get("event_date") || undefined,
    location: formData.get("location") || undefined,
    templateKey: formData.get("template_key"),
    themeColor: formData.get("theme_color"),
    format: formData.get("format"),
  });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Please check the poster details." };
  const p = parsed.data;
  const row = {
    event_title: p.eventTitle,
    tagline: p.tagline ?? null,
    speaker: p.speaker ?? null,
    event_date: p.eventDate ?? null,
    location: p.location ?? null,
    template_key: p.templateKey,
    theme_color: p.themeColor,
    format: p.format,
  };

  const supabase = createClient();
  const existingId = formData.get("poster_id");
  if (existingId) {
    const id = z.string().uuid().safeParse(existingId);
    if (!id.success) return { error: "That poster couldn't be found." };
    // RLS: the poster's creator, or a pastor/church admin.
    const { data: updated, error } = await supabase.from("posters").update(row).eq("id", id.data).eq("church_id", me.church_id).select("id");
    if (error || !updated?.length) {
      if (error) console.error("[posters] update failed:", error.message);
      return { error: "Couldn't save the poster. Only its creator, pastors and church admins can edit it." };
    }
    revalidatePath("/dashboard/posters");
    revalidatePath(`/dashboard/posters/${id.data}`);
    flash("Poster saved.");
    redirect(`/dashboard/posters/${id.data}`);
  }

  const { data: poster, error } = await supabase
    .from("posters")
    .insert({ ...row, church_id: me.church_id, created_by: me.id })
    .select("id")
    .single();
  if (error || !poster) {
    console.error("[posters] save failed:", error?.message);
    return { error: "Couldn't save the poster — please try again. Your design is still here." };
  }
  revalidatePath("/dashboard/posters");
  flash("Poster saved. Download it as an image below.");
  redirect(`/dashboard/posters/${poster.id}`);
}

/** Form fields: poster_id */
export async function deletePoster(_prev: { error?: string } | null, formData: FormData): Promise<{ error?: string } | null> {
  const me = await requirePosterMaker();
  if (!me) return { error: "Your session has expired — sign in again." };
  const id = z.string().uuid().safeParse(formData.get("poster_id"));
  if (!id.success) return { error: "That poster couldn't be found." };
  const { data: deleted, error } = await createClient().from("posters").delete().eq("id", id.data).eq("church_id", me.church_id).select("id");
  if (error || !deleted?.length) return { error: "Couldn't delete the poster. Only its creator, pastors and church admins can delete it." };
  revalidatePath("/dashboard/posters");
  flash("Poster deleted.");
  redirect("/dashboard/posters");
}
