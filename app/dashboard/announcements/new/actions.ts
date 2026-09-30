"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { getCurrentAppUser } from "@/lib/current-user";
import { checkModuleAccess } from "@/lib/paywall";
import { generateText } from "@/lib/ai";
import { consumeAiQuota } from "@/lib/ai-quota";

const POSTERS = ["church_admin", "pastor", "department_leader"];

const AnnouncementSchema = z.object({
  title: z.string().trim().min(1, "Add a title.").max(200, "Keep the title under 200 characters."),
  body: z.string().trim().min(1, "Write the announcement.").max(5000, "Keep it under 5000 characters."),
  departmentId: z.union([z.string().uuid(), z.literal("")]),
  pinned: z.boolean(),
});

export async function createAnnouncement(
  _prev: { error?: string } | null,
  formData: FormData
): Promise<{ error?: string } | null> {
  const access = await checkModuleAccess("announcements");
  if (!access.allowed) return { error: access.reason };

  const me = await getCurrentAppUser();
  if (!me || !POSTERS.includes(me.role)) return { error: "You don't have permission to post announcements." };

  const parsed = AnnouncementSchema.safeParse({
    title: formData.get("title"),
    body: formData.get("body"),
    departmentId: formData.get("department_id") ?? "",
    pinned: formData.get("pinned") === "on",
  });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Please check the form." };

  // A department_leader can only ever post to their own department — enforced
  // here AND by RLS (announcements_insert policy).
  const departmentId = me.role === "department_leader" ? me.department_id : parsed.data.departmentId || null;
  if (me.role === "department_leader" && !departmentId) {
    return { error: "You're not assigned to a department yet — ask a church admin to assign you." };
  }

  const supabase = createClient();
  const { error } = await supabase.from("announcements").insert({
    church_id: me.church_id,
    department_id: departmentId,
    author_id: me.id,
    title: parsed.data.title,
    body: parsed.data.body,
    // Pinning is a church-wide decision — leaders can't pin.
    pinned: me.role !== "department_leader" && parsed.data.pinned,
  });
  if (error) {
    console.error("[announcements] create failed:", error.message);
    return { error: "Couldn't post the announcement — please try again. Your text is still here." };
  }

  revalidatePath("/dashboard/announcements");
  revalidatePath("/dashboard");
  redirect("/dashboard/announcements");
}

const CHANNEL_GUIDE = {
  app: "an in-app church announcement: warm, clear, 60-120 words, with the key details (what, when, where, who it's for) easy to find",
  whatsapp: "a WhatsApp group message: friendly, under 80 words, short lines, 2-4 relevant emoji, key details on their own lines",
  email: "a church email: start with 'Subject: ...' on the first line, then a greeting, 2-3 short paragraphs, and a sign-off from the church",
  bulletin: "a printed Sunday bulletin notice: formal but warm, under 70 words, no emoji",
} as const;

export type AnnouncementChannel = keyof typeof CHANNEL_GUIDE;

/** AI announcement writer (ported from the Android Admin & Service Planner). */
export async function draftAnnouncementWithAi(
  title: string,
  details: string,
  channel: string
): Promise<{ text?: string; error?: string }> {
  const me = await getCurrentAppUser();
  if (!me || !POSTERS.includes(me.role)) return { error: "You don't have permission to post announcements." };

  const parsed = z
    .object({
      title: z.string().trim().min(2, "Add a title first.").max(200),
      details: z.string().trim().min(5, "Add a few details (what, when, where) for the AI to work from.").max(3000),
      channel: z.enum(Object.keys(CHANNEL_GUIDE) as [AnnouncementChannel, ...AnnouncementChannel[]]),
    })
    .safeParse({ title, details, channel });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message };

  const quota = await consumeAiQuota("announcement_draft");
  if (!quota.ok) return { error: quota.error };

  const supabase = createClient();
  const { data: church } = await supabase.from("churches").select("name").eq("id", me.church_id).maybeSingle();

  const text = await generateText({
    maxTokens: 800,
    system:
      "You write church communications. Use ONLY the facts provided — never invent dates, times, places, names or phone numbers. If something important is missing, leave a clear placeholder like [time]. Output only the announcement text.",
    prompt: `Church: ${church?.name ?? "our church"}\nWrite ${CHANNEL_GUIDE[parsed.data.channel]}.\n\nTitle: ${parsed.data.title}\nDetails: ${parsed.data.details}`,
  });

  if (!text) return { error: "The AI writer isn't available right now — you can still write it yourself." };
  return { text };
}
