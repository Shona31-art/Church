"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { getCurrentAppUser, type AppUser } from "@/lib/current-user";
import { checkModuleAccess } from "@/lib/paywall";
import { flash } from "@/lib/flash";
import { can } from "@/lib/permissions";
import { generateText } from "@/lib/ai";
import { consumeAiQuota } from "@/lib/ai-quota";
import { FormState, SESSION_EXPIRED, formValues, invalid } from "@/lib/forms";
import { AI_NOT_ON_PLAN, planIncludes } from "@/lib/features";

// Announcement lifecycle: draft → published → archived (→ restored to draft),
// or deleted. Authors manage their own; pastors and church admins manage all
// in their church. Department leaders post only to their own department and
// can't pin (announcements_* policies in platform_hardening.sql enforce the same).

const AnnouncementSchema = z.object({
  title: z.string().trim().min(1, "Add a title.").max(200, "Keep the title under 200 characters."),
  body: z.string().trim().min(1, "Write the announcement.").max(5000, "Keep it under 5,000 characters."),
  departmentId: z.union([z.string().uuid(), z.literal("")]).transform((v) => v || null),
  pinned: z.boolean(),
  intent: z.enum(["publish", "draft"]),
});

async function requirePoster(): Promise<AppUser | null> {
  const me = await getCurrentAppUser();
  if (!me || !me.church_id || !can(me.role, "postAnnouncements")) return null;
  return (await checkModuleAccess("announcements")).allowed ? me : null;
}

function refresh(id?: string) {
  revalidatePath("/dashboard/announcements");
  revalidatePath("/dashboard");
  if (id) revalidatePath(`/dashboard/announcements/${id}`);
}

/**
 * Create or edit. Form fields: announcement_id? + updated_at? (edit), title,
 * body, department_id?, pinned?, intent ("publish" | "draft").
 */
export async function saveAnnouncement(_prev: FormState, formData: FormData): Promise<FormState> {
  const me = await requirePoster();
  if (!me) return { error: "Only pastors, church admins and department leaders can post announcements. If you are one, sign in again." };

  const parsed = AnnouncementSchema.safeParse({
    title: formData.get("title"),
    body: formData.get("body"),
    departmentId: formData.get("department_id") ?? "",
    pinned: formData.get("pinned") === "on",
    intent: formData.get("intent"),
  });
  if (!parsed.success) return invalid(parsed.error, formData);
  const values = formValues(formData);

  // Leaders: own department only, never pinned.
  const churchWide = can(me.role, "postChurchWide");
  const departmentId = churchWide ? parsed.data.departmentId : me.department_id;
  if (!departmentId && !churchWide) {
    return { error: "You're not assigned to a department yet — ask a church admin to assign you.", values };
  }
  const pinned = churchWide && parsed.data.pinned;
  const publishing = parsed.data.intent === "publish";

  const supabase = createClient();
  const existingId = formData.get("announcement_id");

  if (existingId) {
    const id = z.string().uuid().safeParse(existingId);
    const updatedAt = String(formData.get("updated_at") ?? "");
    if (!id.success || !updatedAt) return { error: "That announcement couldn't be found.", values };

    const { data: current } = await supabase.from("announcements").select("status").eq("id", id.data).eq("church_id", me.church_id).maybeSingle();
    if (!current) return { error: "That announcement couldn't be found — it may have been deleted.", values };

    const { data: updated, error } = await supabase
      .from("announcements")
      .update({
        title: parsed.data.title,
        body: parsed.data.body,
        department_id: departmentId,
        pinned,
        status: publishing ? "published" : current.status === "archived" ? "archived" : "draft",
        ...(publishing && current.status !== "published" ? { published_at: new Date().toISOString() } : {}),
      })
      .eq("id", id.data)
      .eq("church_id", me.church_id)
      .eq("updated_at", updatedAt)
      .select("id");
    if (error) {
      console.error("[announcements] update failed:", error.message);
      return { error: "Couldn't save the announcement — please try again. Your text is still here.", values };
    }
    if (!updated?.length) {
      return { error: "Someone else changed this announcement while you were editing, or you can no longer edit it. Reload to see the latest version.", values };
    }
    refresh(id.data);
    flash(publishing ? "Announcement published." : "Draft saved.");
    redirect(`/dashboard/announcements/${id.data}`);
  }

  const { data: created, error } = await supabase
    .from("announcements")
    .insert({
      church_id: me.church_id,
      department_id: departmentId,
      author_id: me.id,
      title: parsed.data.title,
      body: parsed.data.body,
      pinned,
      status: publishing ? "published" : "draft",
      published_at: publishing ? new Date().toISOString() : null,
    })
    .select("id")
    .single();
  if (error || !created) {
    console.error("[announcements] create failed:", error?.message);
    return { error: "Couldn't save the announcement — please try again. Your text is still here.", values };
  }

  refresh();
  flash(publishing ? "Announcement published." : "Draft saved. Only you and church leaders can see it until you publish.");
  redirect(`/dashboard/announcements/${created.id}`);
}

/** Form fields: announcement_id, to ("published" | "archived" | "draft"). */
export async function setAnnouncementStatus(_prev: FormState, formData: FormData): Promise<FormState> {
  const me = await requirePoster();
  if (!me) return { error: SESSION_EXPIRED };

  const parsed = z
    .object({ id: z.string().uuid(), to: z.enum(["published", "archived", "draft"]) })
    .safeParse({ id: formData.get("announcement_id"), to: formData.get("to") });
  if (!parsed.success) return { error: "That action isn't valid." };

  const supabase = createClient();
  const { data: updated, error } = await supabase
    .from("announcements")
    .update({ status: parsed.data.to, ...(parsed.data.to === "published" ? { published_at: new Date().toISOString() } : {}) })
    .eq("id", parsed.data.id)
    .eq("church_id", me.church_id)
    .select("id");
  if (error || !updated?.length) {
    if (error) console.error("[announcements] status change failed:", error.message);
    return { error: "Couldn't update this announcement. You may not have permission, or it was deleted." };
  }

  refresh(parsed.data.id);
  flash(parsed.data.to === "published" ? "Announcement published." : parsed.data.to === "archived" ? "Announcement archived. Members no longer see it." : "Moved back to drafts.");
  return { ok: true };
}

/** Form fields: announcement_id */
export async function deleteAnnouncement(_prev: FormState, formData: FormData): Promise<FormState> {
  const me = await requirePoster();
  if (!me) return { error: SESSION_EXPIRED };
  const id = z.string().uuid().safeParse(formData.get("announcement_id"));
  if (!id.success) return { error: "That announcement couldn't be found." };

  const { data: deleted, error } = await createClient()
    .from("announcements")
    .delete()
    .eq("id", id.data)
    .eq("church_id", me.church_id)
    .select("id");
  if (error || !deleted?.length) {
    if (error) console.error("[announcements] delete failed:", error.message);
    return { error: "Couldn't delete this announcement. You may not have permission, or it was already deleted." };
  }
  refresh();
  flash("Announcement deleted.");
  redirect("/dashboard/announcements");
}

const CHANNEL_GUIDE = {
  app: "an in-app church announcement: warm, clear, 60-120 words, with the key details (what, when, where, who it's for) easy to find",
  whatsapp: "a WhatsApp group message: friendly, under 80 words, short lines, 2-4 relevant emoji, key details on their own lines",
  email: "a church email: start with 'Subject: ...' on the first line, then a greeting, 2-3 short paragraphs, and a sign-off from the church",
  bulletin: "a printed Sunday bulletin notice: formal but warm, under 70 words, no emoji",
} as const;

export type AnnouncementChannel = keyof typeof CHANNEL_GUIDE;

/** AI announcement writer. Rate-limited per person (lib/ai-quota.ts); works without AI configured (returns a message). */
export async function draftAnnouncementWithAi(title: string, details: string, channel: string): Promise<{ text?: string; error?: string }> {
  const me = await requirePoster();
  if (!me) return { error: "You don't have permission to post announcements." };
  if (!(await planIncludes("ai_assist"))) return { error: AI_NOT_ON_PLAN };

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

  const { data: church } = await createClient().from("churches").select("name").eq("id", me.church_id).maybeSingle();
  const text = await generateText({
    maxTokens: 800,
    system:
      "You write church communications. Use ONLY the facts provided — never invent dates, times, places, names or phone numbers. If something important is missing, leave a clear placeholder like [time]. Output only the announcement text.",
    prompt: `Church: ${church?.name ?? "our church"}\nWrite ${CHANNEL_GUIDE[parsed.data.channel]}.\n\nTitle: ${parsed.data.title}\nDetails: ${parsed.data.details}`,
  });

  if (!text) return { error: "The AI writer isn't available right now — you can still write it yourself." };
  return { text };
}
