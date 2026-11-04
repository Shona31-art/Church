"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { getCurrentAppUser } from "@/lib/current-user";
import { checkModuleAccess } from "@/lib/paywall";
import { can } from "@/lib/permissions";
import { flash } from "@/lib/flash";
import { localInputToUtcIso } from "@/lib/format";
import { FormState, SESSION_EXPIRED, formValues } from "@/lib/forms";

const schema = z.object({
  title: z.string().trim().min(1, "Give the prayer chain a name.").max(120),
  description: z.string().trim().max(1000).transform((v) => v || null),
  slotMinutes: z.coerce.number().refine((n) => [15, 30, 60, 120].includes(n)),
  maxPerSlot: z.coerce.number().int().min(1).max(50),
});
const TIME = /^([01]\d|2[0-3]):[0-5]\d$/;

/**
 * Pastors. Form fields: title, description?, slot_minutes, max_per_slot, mode,
 * and either (mode "clock") starts_at (local) + hours, or (mode "times")
 * start_date + days + times ("05:00,15:00,18:00").
 */
export async function createPrayerChain(_prev: FormState, formData: FormData): Promise<FormState> {
  const me = await getCurrentAppUser();
  if (!me?.church_id || !can(me.role, "postChurchWide")) return { error: SESSION_EXPIRED };
  if (!(await checkModuleAccess("prayer_chain")).allowed) return { error: "The prayer chain isn't on your church's plan." };
  const parsed = schema.safeParse({
    title: formData.get("title") ?? "",
    description: formData.get("description") ?? "",
    slotMinutes: formData.get("slot_minutes"),
    maxPerSlot: formData.get("max_per_slot"),
  });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Check the details.", values: formValues(formData) };

  let start: string | null;
  let end: string;
  let times: string[] | null = null;
  if (formData.get("mode") === "times") {
    times = [...new Set(String(formData.get("times") ?? "").split(",").map((t) => t.trim()).filter((t) => TIME.test(t)))].sort().slice(0, 24);
    if (!times.length) return { error: "Add at least one prayer time.", values: formValues(formData) };
    const day = String(formData.get("start_date") ?? "");
    const days = z.coerce.number().int().min(1).max(31).safeParse(formData.get("days"));
    if (!/^\d{4}-\d{2}-\d{2}$/.test(day) || !days.success) return { error: "Choose the first day and how many days.", values: formValues(formData) };
    start = localInputToUtcIso(`${day}T00:00`);
    if (!start) return { error: "Choose the first day.", values: formValues(formData) };
    end = new Date(Date.parse(start) + days.data * 86_400_000).toISOString();
  } else {
    start = localInputToUtcIso(String(formData.get("starts_at") ?? ""));
    const hours = z.coerce.number().int().min(1).max(744).safeParse(formData.get("hours"));
    if (!start || !hours.success) return { error: "Choose when the chain starts.", values: formValues(formData) };
    end = new Date(Date.parse(start) + hours.data * 3_600_000).toISOString();
  }

  const { data, error } = await createClient()
    .from("prayer_chains")
    .insert({
      church_id: me.church_id,
      title: parsed.data.title,
      description: parsed.data.description,
      starts_at: start,
      ends_at: end,
      slot_minutes: parsed.data.slotMinutes,
      max_per_slot: parsed.data.maxPerSlot,
      created_by: me.id,
      ...(times ? { times } : {}),
    })
    .select("id")
    .single();
  if (error || !data) {
    console.error("[prayer-chain] create failed:", error?.message);
    return { error: /times/.test(error?.message ?? "") ? "Set prayer times need database update #62 (church_life_v2.sql)." : "Couldn't create it — please try again.", values: formValues(formData) };
  }
  revalidatePath("/dashboard/prayer-chain");
  flash("Prayer chain created — the church has been invited to book slots.");
  redirect(`/dashboard/prayer-chain/${data.id}`);
}

/** Book or cancel a slot. Form fields: chain_id, slot_start (ISO), book ("1" | "0"), user_id? (pastor removing someone) */
export async function bookPrayerSlot(formData: FormData): Promise<void> {
  const me = await getCurrentAppUser();
  const parsed = z.object({ chainId: z.string().uuid(), slot: z.string().datetime() }).safeParse({ chainId: formData.get("chain_id"), slot: formData.get("slot_start") });
  if (!me?.church_id || !parsed.success) return;
  const supabase = createClient();
  if (formData.get("book") === "1") {
    const other = z.string().uuid().safeParse(formData.get("user_id"));
    const forSomeone = other.success && other.data !== me.id && can(me.role, "postChurchWide");
    const { error } = await supabase.from("prayer_chain_slots").insert({ chain_id: parsed.data.chainId, church_id: me.church_id, slot_start: parsed.data.slot, user_id: forSomeone ? other.data : me.id, ...(forSomeone ? { added_by: me.id } : {}) });
    if (error) flash(/full/.test(error.message) ? "That slot just filled up — choose another." : /over/.test(error.message) ? "That slot is already over." : error.code === "23505" ? (forSomeone ? "They're already in that slot." : "You've already booked that slot.") : "Couldn't book it — please try again.", "error");
    else flash(forSomeone ? "Added — they've been told, and they'll get a reminder before it starts." : "Booked. We'll remind you about 30 minutes before. Thank you for praying!");
  } else {
    const who = z.string().uuid().safeParse(formData.get("user_id"));
    const userId = who.success && can(me.role, "postChurchWide") ? who.data : me.id;
    await supabase.from("prayer_chain_slots").delete().eq("chain_id", parsed.data.chainId).eq("slot_start", parsed.data.slot).eq("user_id", userId);
    flash(userId === me.id ? "Slot cancelled." : "Removed from that slot.");
  }
  revalidatePath(`/dashboard/prayer-chain/${parsed.data.chainId}`);
}

/** Pastors. Form fields: chain_id */
export async function deletePrayerChain(formData: FormData): Promise<void> {
  const me = await getCurrentAppUser();
  const id = z.string().uuid().safeParse(formData.get("chain_id"));
  if (!me?.church_id || !id.success || !can(me.role, "postChurchWide")) return;
  await createClient().from("prayer_chains").delete().eq("id", id.data).eq("church_id", me.church_id);
  revalidatePath("/dashboard/prayer-chain");
  flash("Prayer chain deleted.");
  redirect("/dashboard/prayer-chain");
}

/** Your prayer for your slot, typed. Form fields: chain_id, slot_start, prayer_text */
export async function savePrayerText(_prev: FormState, formData: FormData): Promise<FormState> {
  const me = await getCurrentAppUser();
  const p = z
    .object({ chainId: z.string().uuid(), slot: z.string().datetime(), text: z.string().trim().max(2000, "Keep it under 2,000 characters.") })
    .safeParse({ chainId: formData.get("chain_id"), slot: formData.get("slot_start"), text: formData.get("prayer_text") ?? "" });
  if (!me?.church_id) return { error: SESSION_EXPIRED };
  if (!p.success) return { error: p.error.issues[0]?.message ?? "Couldn't save your prayer." };
  const { data, error } = await createClient()
    .from("prayer_chain_slots")
    .update({ prayer_text: p.data.text || null, prayed_at: new Date().toISOString() })
    .eq("chain_id", p.data.chainId)
    .eq("slot_start", p.data.slot)
    .eq("user_id", me.id)
    .select("id");
  if (error || !data?.length) return { error: /prayer_text/.test(error?.message ?? "") ? "Prayers need database update #62 (church_life_v2.sql)." : "Couldn't save your prayer — please try again." };
  revalidatePath(`/dashboard/prayer-chain/${p.data.chainId}`);
  return { ok: true };
}

/** After the browser uploaded a recording to prayer-audio: attach it to your slot (or remove it: path ""). */
export async function savePrayerAudio(input: { chainId: string; slotStart: string; path: string; durationMs: number }): Promise<string | null> {
  const me = await getCurrentAppUser();
  if (!me?.church_id) return SESSION_EXPIRED;
  const p = z.object({ chainId: z.string().uuid(), slotStart: z.string().datetime(), path: z.string().max(300), durationMs: z.number().int().min(0).max(600_000) }).safeParse(input);
  if (!p.success) return "Couldn't save the recording.";
  if (p.data.path && !p.data.path.startsWith(`${me.church_id}/${p.data.chainId}/${me.id}/`)) return "Couldn't save the recording.";
  const supabase = createClient();
  const { data: before } = await supabase.from("prayer_chain_slots").select("prayer_audio_path").eq("chain_id", p.data.chainId).eq("slot_start", p.data.slotStart).eq("user_id", me.id).maybeSingle();
  const { data, error } = await supabase
    .from("prayer_chain_slots")
    .update({ prayer_audio_path: p.data.path || null, prayer_audio_ms: p.data.path ? p.data.durationMs : null, prayed_at: new Date().toISOString() })
    .eq("chain_id", p.data.chainId)
    .eq("slot_start", p.data.slotStart)
    .eq("user_id", me.id)
    .select("id");
  if (error || !data?.length) return "Couldn't save the recording — please try again.";
  if (before?.prayer_audio_path && before.prayer_audio_path !== p.data.path) await supabase.storage.from("prayer-audio").remove([before.prayer_audio_path]);
  revalidatePath(`/dashboard/prayer-chain/${p.data.chainId}`);
  return null;
}
