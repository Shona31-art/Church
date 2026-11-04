"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
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
    // Only pastors and church admins remove someone from a time (RLS agrees).
    if (!can(me.role, "postChurchWide")) {
      flash("Can't make it? Ask a pastor to move you to another time.", "info");
      return;
    }
    const who = z.string().uuid().safeParse(formData.get("user_id"));
    const userId = who.success ? who.data : me.id;
    await supabase.from("prayer_chain_slots").delete().eq("chain_id", parsed.data.chainId).eq("slot_start", parsed.data.slot).eq("user_id", userId);
    if (userId !== me.id) await tellRemoved(me.church_id, me.id, userId, parsed.data.chainId, parsed.data.slot);
    flash(userId === me.id ? "Slot cancelled." : "Removed from that slot — they've been told.");
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

/**
 * Pastors: change a chain — name, description, people per slot, and (set-times
 * chains) the prayer times. Removing a time cancels the bookings still to come
 * at that time. Form fields: chain_id, title, description?, max_per_slot, times? ("05:00,15:00")
 */
export async function updatePrayerChain(_prev: FormState, formData: FormData): Promise<FormState> {
  const me = await getCurrentAppUser();
  if (!me?.church_id || !can(me.role, "postChurchWide")) return { error: SESSION_EXPIRED };
  const id = z.string().uuid().safeParse(formData.get("chain_id"));
  const p = z
    .object({
      title: z.string().trim().min(1, "Give the prayer chain a name.").max(120),
      description: z.string().trim().max(1000).transform((v) => v || null),
      maxPerSlot: z.coerce.number().int().min(1).max(50),
    })
    .safeParse({ title: formData.get("title") ?? "", description: formData.get("description") ?? "", maxPerSlot: formData.get("max_per_slot") });
  if (!id.success) return { error: "That prayer chain couldn't be found." };
  if (!p.success) return { error: p.error.issues[0]?.message ?? "Check the details.", values: formValues(formData) };
  const supabase = createClient();
  const { data: chain } = await supabase.from("prayer_chains").select("*").eq("id", id.data).eq("church_id", me.church_id).maybeSingle();
  if (!chain) return { error: "That prayer chain couldn't be found." };

  let times: string[] | undefined;
  if (chain.times?.length) {
    times = [...new Set(String(formData.get("times") ?? "").split(",").map((t) => t.trim()).filter((t) => TIME.test(t)))].sort().slice(0, 24);
    if (!times.length) return { error: "Keep at least one prayer time — or delete the chain.", values: formValues(formData) };
  }
  const { error } = await supabase
    .from("prayer_chains")
    .update({ title: p.data.title, description: p.data.description, max_per_slot: p.data.maxPerSlot, ...(times ? { times } : {}) })
    .eq("id", chain.id);
  if (error) {
    console.error("[prayer-chain] update failed:", error.message);
    return { error: "Couldn't save the changes — please try again.", values: formValues(formData) };
  }

  // Bookings still to come at a time that was removed are cancelled.
  let cancelled = 0;
  if (times) {
    const removed = (chain.times as string[]).filter((t) => !times!.includes(t));
    if (removed.length) {
      const { data: future } = await supabase.from("prayer_chain_slots").select("id, slot_start, user_id").eq("chain_id", chain.id).gt("slot_start", new Date().toISOString());
      const hhmm = (iso: string) => new Date(iso).toLocaleTimeString("en-ZA", { timeZone: "Africa/Johannesburg", hour: "2-digit", minute: "2-digit", hour12: false });
      const goneRows = ((future ?? []) as { id: string; slot_start: string; user_id: string }[]).filter((b) => removed.includes(hhmm(b.slot_start)));
      if (goneRows.length) {
        await supabase.from("prayer_chain_slots").delete().in("id", goneRows.map((b) => b.id));
        cancelled = goneRows.length;
        // Tell each person their slot was cancelled.
        const when = (iso: string) => new Date(iso).toLocaleString("en-ZA", { timeZone: "Africa/Johannesburg", weekday: "long", day: "numeric", month: "long", hour: "2-digit", minute: "2-digit", hour12: false });
        const { error: nErr } = await createAdminClient()
          .from("notifications")
          .insert(
            goneRows
              .filter((b) => b.user_id !== me.id)
              .map((b) => ({ user_id: b.user_id, church_id: me.church_id, category: "prayer_care", type: "prayer_chain.cancelled", title: "Prayer time cancelled", body: `${p.data.title}: your slot on ${when(b.slot_start)} was removed. Choose another time if you can.`, link: `/dashboard/prayer-chain/${chain.id}`, actor_id: me.id })),
          );
        if (nErr) console.error("[prayer-chain] cancel notices failed:", nErr.message);
      }
    }
  }
  revalidatePath(`/dashboard/prayer-chain/${chain.id}`);
  revalidatePath("/dashboard/prayer-chain");
  flash(cancelled ? `Saved. ${cancelled} booking${cancelled === 1 ? "" : "s"} at the removed time${cancelled === 1 ? " was" : "s were"} cancelled.` : "Prayer chain updated.");
  return { ok: true };
}

const whenText = (iso: string) => new Date(iso).toLocaleString("en-ZA", { timeZone: "Africa/Johannesburg", weekday: "long", day: "numeric", month: "long", year: "numeric", hour: "2-digit", minute: "2-digit", hour12: false });

/** A pastor took someone out of a slot: tell them. */
async function tellRemoved(churchId: string, actorId: string, userId: string, chainId: string, slot: string) {
  const { data: chain } = await createClient().from("prayer_chains").select("title").eq("id", chainId).maybeSingle();
  const { error } = await createAdminClient()
    .from("notifications")
    .insert({ user_id: userId, church_id: churchId, category: "prayer_care", type: "prayer_chain.removed", title: "Prayer time changed", body: `${chain?.title ?? "Prayer chain"}: you're no longer down for ${whenText(slot)}.`, link: `/dashboard/prayer-chain/${chainId}`, actor_id: actorId });
  if (error) console.error("[prayer-chain] removal notice failed:", error.message);
}

/**
 * Pastors: move someone to another time (e.g. they can't make it). They're
 * told the new time and date. Form fields: chain_id, booking ("<user_id>|<slot ISO>"), to_slot (ISO)
 */
export async function movePrayerSlot(formData: FormData): Promise<void> {
  const me = await getCurrentAppUser();
  if (!me?.church_id || !can(me.role, "postChurchWide")) return;
  const [userId, fromSlot] = String(formData.get("booking") ?? "").split("|");
  const p = z
    .object({ chainId: z.string().uuid(), userId: z.string().uuid(), from: z.string().datetime(), to: z.string().datetime() })
    .safeParse({ chainId: formData.get("chain_id"), userId, from: fromSlot, to: formData.get("to_slot") });
  if (!p.success) {
    flash("Choose the person's booking and the new time.", "error");
    return;
  }
  if (p.data.from === p.data.to) return;
  const supabase = createClient();
  // New slot first, so a full or wrong slot leaves the old booking in place.
  const { error } = await supabase.from("prayer_chain_slots").insert({ chain_id: p.data.chainId, church_id: me.church_id, slot_start: p.data.to, user_id: p.data.userId, added_by: me.id });
  if (error) {
    flash(/full/.test(error.message) ? "That time is full — choose another." : /over/.test(error.message) ? "That time has already passed." : error.code === "23505" ? "They're already at that time." : "Couldn't move them — please try again.", "error");
    return;
  }
  await supabase.from("prayer_chain_slots").delete().eq("chain_id", p.data.chainId).eq("slot_start", p.data.from).eq("user_id", p.data.userId);
  revalidatePath(`/dashboard/prayer-chain/${p.data.chainId}`);
  flash("Moved — they've been told their new time.");
}
