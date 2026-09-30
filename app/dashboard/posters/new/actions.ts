"use server";

import { generateText } from "@/lib/ai";
import { consumeAiQuota } from "@/lib/ai-quota";

export interface PosterCopy {
  tagline: string;
}

// Generates a short punchy tagline from the event details. Falls back to a
// simple template if ANTHROPIC_API_KEY isn't set, so the tool still works
// with zero configuration.
export async function generatePosterTagline(params: {
  eventTitle: string;
  speaker?: string;
  eventDate?: string;
}): Promise<PosterCopy> {
  const fallback = "Join us — everyone welcome.";
  if (!(await consumeAiQuota("poster_tagline")).ok) return { tagline: fallback };
  const text = await generateText({
    maxTokens: 100,
    prompt: `Write ONE short, warm, inviting tagline (under 10 words, no quotation marks) for a church event poster. Event: "${params.eventTitle}"${params.speaker ? `, speaker: ${params.speaker}` : ""}${params.eventDate ? `, on ${params.eventDate}` : ""}. Respond with ONLY the tagline text, nothing else.`,
  });
  return { tagline: text?.replace(/^["']|["']$/g, "") || fallback };
}

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getCurrentAppUser } from "@/lib/current-user";

export async function savePoster(formData: FormData) {
  const me = await getCurrentAppUser();
  if (!me || !["church_admin", "pastor", "department_leader"].includes(me.role)) return;

  const supabase = createClient();
  await supabase.from("posters").insert({
    church_id: me.church_id,
    created_by: me.id,
    event_title: String(formData.get("event_title") || ""),
    tagline: String(formData.get("tagline") || "") || null,
    speaker: String(formData.get("speaker") || "") || null,
    event_date: String(formData.get("event_date") || "") || null,
    location: String(formData.get("location") || "") || null,
    template_key: String(formData.get("template_key") || "classic"),
    theme_color: String(formData.get("theme_color") || "#b45309"),
    format: String(formData.get("format") || "square"),
  });

  redirect("/dashboard/posters");
}
