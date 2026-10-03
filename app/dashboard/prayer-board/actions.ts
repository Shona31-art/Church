"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { getCurrentAppUser } from "@/lib/current-user";
import { checkModuleAccess } from "@/lib/paywall";
import { generateText } from "@/lib/ai";
import { consumeAiQuota } from "@/lib/ai-quota";
import { logAudit } from "@/lib/audit";

// Every action re-checks the session and relies on RLS as the hard boundary
// (a member can only update their own prayers; see personal_growth_schema.sql
// and church_os_features_schema.sql). The .eq("user_id") filters are a second
// layer so a forged id silently matches nothing rather than erroring.

export type ActionResult = { error?: string; ok?: boolean } | null;

const id = z.string().uuid();

function refresh() {
  revalidatePath("/dashboard/prayer-board");
  revalidatePath("/dashboard/prayer-board/wall");
}

export async function markPrayerAnswered(_prev: ActionResult, formData: FormData): Promise<ActionResult> {
  const me = await getCurrentAppUser();
  if (!me) return { error: "Your session has expired — please sign in again." };

  const parsed = z
    .object({ id, reflection: z.string().trim().max(2000).optional() })
    .safeParse({ id: formData.get("id"), reflection: formData.get("reflection") || undefined });
  if (!parsed.success) return { error: "That prayer couldn't be found." };

  const supabase = createClient();
  const { error } = await supabase
    .from("prayer_board_items")
    .update({
      status: "answered",
      answered_at: new Date().toISOString(),
      answered_reflection: parsed.data.reflection || null,
      // Once answered it's a testimony, not an open request.
      is_shared_request: false,
    })
    .eq("id", parsed.data.id)
    .eq("user_id", me.id);

  if (error) return { error: "Couldn't update your prayer — try again." };
  refresh();
  return { ok: true };
}

export async function reopenPrayer(formData: FormData) {
  const me = await getCurrentAppUser();
  const parsed = id.safeParse(formData.get("id"));
  if (!me || !parsed.success) return;
  const supabase = createClient();
  await supabase
    .from("prayer_board_items")
    .update({ status: "active", answered_at: null, answered_reflection: null, is_testimony_shared: false })
    .eq("id", parsed.data)
    .eq("user_id", me.id);
  refresh();
}

/** Toggles sharing: active prayers → prayer wall request; answered → testimony. */
export async function toggleSharing(formData: FormData) {
  const me = await getCurrentAppUser();
  const parsed = id.safeParse(formData.get("id"));
  if (!me || !parsed.success) return;

  const supabase = createClient();
  const { data: item } = await supabase
    .from("prayer_board_items")
    .select("status, is_shared_request, is_testimony_shared")
    .eq("id", parsed.data)
    .eq("user_id", me.id)
    .single();
  if (!item) return;

  const update =
    item.status === "answered"
      ? { is_testimony_shared: !item.is_testimony_shared }
      : { is_shared_request: !item.is_shared_request };

  await supabase.from("prayer_board_items").update(update).eq("id", parsed.data).eq("user_id", me.id);
  refresh();
}

export async function deletePrayer(formData: FormData) {
  const me = await getCurrentAppUser();
  const parsed = id.safeParse(formData.get("id"));
  if (!me || !parsed.success) return;
  const supabase = createClient();
  await supabase.from("prayer_board_items").delete().eq("id", parsed.data).eq("user_id", me.id);
  refresh();
}

/** Toggle "I prayed for this" for the current member. */
export async function togglePrayed(formData: FormData) {
  const me = await getCurrentAppUser();
  const parsed = id.safeParse(formData.get("id"));
  if (!me || !me.church_id || !parsed.success) return;

  const supabase = createClient();
  const { data: existing } = await supabase
    .from("prayer_intercessions")
    .select("prayer_id")
    .eq("prayer_id", parsed.data)
    .eq("user_id", me.id)
    .maybeSingle();

  if (existing) {
    await supabase.from("prayer_intercessions").delete().eq("prayer_id", parsed.data).eq("user_id", me.id);
  } else {
    await supabase
      .from("prayer_intercessions")
      .insert({ prayer_id: parsed.data, user_id: me.id, church_id: me.church_id });
  }
  refresh();
}

export async function addPrayerComment(_prev: ActionResult, formData: FormData): Promise<ActionResult> {
  const me = await getCurrentAppUser();
  if (!me || !me.church_id) return { error: "Your session has expired — please sign in again." };

  const parsed = z
    .object({ prayerId: id, body: z.string().trim().min(1, "Write a message first.").max(1000, "Keep it under 1000 characters.") })
    .safeParse({ prayerId: formData.get("prayer_id"), body: formData.get("body") });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Invalid comment." };

  const supabase = createClient();
  const { error } = await supabase.from("prayer_comments").insert({
    prayer_id: parsed.data.prayerId,
    church_id: me.church_id,
    user_id: me.id,
    body: parsed.data.body,
  });
  if (error) return { error: "Couldn't post your message — try again." };
  refresh();
  return { ok: true };
}

export async function deletePrayerComment(formData: FormData) {
  const me = await getCurrentAppUser();
  const parsed = id.safeParse(formData.get("id"));
  if (!me || !parsed.success) return;
  const supabase = createClient();
  // RLS allows the author, or a pastor/church_admin moderating.
  await supabase.from("prayer_comments").delete().eq("id", parsed.data);
  refresh();
}

/** Pastor/admin moderation: takes a request off the wall (never edits or reads private items). */
export async function removeFromWall(formData: FormData) {
  const me = await getCurrentAppUser();
  const parsed = id.safeParse(formData.get("id"));
  if (!me || !parsed.success || !["pastor", "church_admin"].includes(me.role)) return;

  // Via a narrow database function (see church_os_features_schema.sql): a
  // plain UPDATE can't work, because the pastor can't see the row once it's
  // no longer shared. The function re-checks the pastor's role itself.
  const supabase = createClient();
  const { data: removed, error } = await supabase.rpc("unshare_prayer", { target_prayer: parsed.data });
  if (error) console.error("[prayer-wall] unshare failed:", error.message);
  if (removed === true) {
    await logAudit({
      churchId: me.church_id,
      actorId: me.id,
      action: "prayer_wall.removed",
      targetTable: "prayer_board_items",
      targetId: parsed.data,
    });
  }
  refresh();
}

/** AI "help me write this prayer" (ported from the Android Prayer AI). */
export async function draftPrayerWithAi(
  topic: string,
  category: string
): Promise<{ text?: string; error?: string }> {
  const me = await getCurrentAppUser();
  if (!me) return { error: "Your session has expired — please sign in again." };
  if (!(await checkModuleAccess("prayer_board")).allowed) return { error: "The prayer board isn't available on your church's plan." };
  const parsed = z
    .object({ topic: z.string().trim().min(3, "Tell us a little about what to pray for.").max(500), category: z.string().max(40) })
    .safeParse({ topic, category });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message };

  const quota = await consumeAiQuota("prayer_draft");
  if (!quota.ok) return { error: quota.error };

  const text = await generateText({
    maxTokens: 600,
    system:
      "You help church members put their prayers into words. Write a short, sincere, first-person prayer (80-140 words) addressed to God, in plain warm language. You may mention one Bible reference by reference only (e.g. 'Philippians 4:6-7') — never quote verse text. No headings, no markdown, no preamble — just the prayer, ending with 'Amen.'",
    prompt: `What I want to pray about${parsed.data.category ? ` (${parsed.data.category})` : ""}: ${parsed.data.topic}`,
  });

  if (!text) return { error: "AI isn't available right now — you can still write your prayer yourself." };
  return { text };
}
