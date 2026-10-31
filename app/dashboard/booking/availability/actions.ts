"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { getCurrentAppUser } from "@/lib/current-user";
import { availabilityBlockSchema } from "@/lib/booking-schemas";
import { MAX_AWAY_DAYS, daysBetween } from "@/lib/date-range";

export type FormResult = { error?: string; ok?: boolean } | null;

// Pastors manage their own blocked dates; church admins can manage any
// pastor's in their church. RLS (booking_security_fix.sql) enforces the same.
async function requireShepherd() {
  const me = await getCurrentAppUser();
  if (!me || !["pastor", "church_admin"].includes(me.role) || !me.church_id) return null;
  return me;
}

/** Form fields: pastor_id? (admins only), blocked_date (first day away), until_date? (last day), note? */
export async function addAvailabilityBlock(_prev: FormResult, formData: FormData): Promise<FormResult> {
  const me = await requireShepherd();
  if (!me) return { error: "Only pastors and church admins can manage availability. If you are one, sign in again." };

  const parsed = availabilityBlockSchema.safeParse({
    pastorId: formData.get("pastor_id") || undefined,
    blockedDate: formData.get("blocked_date"),
    untilDate: formData.get("until_date") || undefined,
    note: formData.get("note") || undefined,
  });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Please check the form." };
  const pastorId = parsed.data.pastorId ?? me.id;
  if (me.role === "pastor" && pastorId !== me.id) return { error: "You can only block dates for yourself." };

  // One row per day away, so booking requests on any of those days are flagged.
  const days = daysBetween(parsed.data.blockedDate, parsed.data.untilDate ?? parsed.data.blockedDate);
  if (days.length > MAX_AWAY_DAYS) return { error: `That's more than ${MAX_AWAY_DAYS} days. Block it in shorter stretches.` };

  const supabase = createClient();
  // Skip days that are already blocked for this pastor.
  const { data: existing } = await supabase
    .from("pastor_availability_blocks")
    .select("blocked_date")
    .eq("pastor_id", pastorId)
    .in("blocked_date", days);
  const taken = new Set((existing ?? []).map((r) => r.blocked_date));
  const rows = days
    .filter((d) => !taken.has(d))
    .map((d) => ({ church_id: me.church_id, pastor_id: pastorId, blocked_date: d, note: parsed.data.note ?? null }));
  if (!rows.length) return { error: days.length === 1 ? "That date is already blocked." : "Those dates are already blocked." };

  const { error } = await supabase.from("pastor_availability_blocks").insert(rows);
  if (error) {
    console.error("[availability] add failed:", error.message);
    return { error: "Couldn't block those dates — please try again." };
  }

  revalidatePath("/dashboard/booking/availability");
  return { ok: true };
}

/** Form fields: id (repeated — removes a whole away period at once) */
export async function removeAvailabilityBlock(_prev: FormResult, formData: FormData): Promise<FormResult> {
  const me = await requireShepherd();
  if (!me) return { error: "Your session has expired — sign in again to continue." };

  const ids = z.array(z.string().uuid()).min(1).max(400).safeParse(formData.getAll("id"));
  if (!ids.success) return { error: "That date couldn't be found." };

  const supabase = createClient();
  const { data: removed, error } = await supabase
    .from("pastor_availability_blocks")
    .delete()
    .in("id", ids.data)
    .eq("church_id", me.church_id)
    .select("id");
  if (error) {
    console.error("[availability] remove failed:", error.message);
    return { error: "Couldn't remove that date — please try again." };
  }
  // RLS hides rows you may not delete (e.g. another pastor's block) — zero rows, no error.
  if (!removed?.length) return { error: "You can only remove your own blocked dates." };

  revalidatePath("/dashboard/booking/availability");
  return { ok: true };
}

/**
 * Change a blocked period: new dates and/or note. Form fields: id (repeated —
 * the period's current days), blocked_date, until_date?, note?. The old days
 * are replaced by the new ones; the pastor stays the same.
 */
export async function updateAvailabilityBlock(_prev: FormResult, formData: FormData): Promise<FormResult> {
  const me = await requireShepherd();
  if (!me) return { error: "Your session has expired — sign in again to continue." };
  const ids = z.array(z.string().uuid()).min(1).max(400).safeParse(formData.getAll("id"));
  if (!ids.success) return { error: "That time away couldn't be found." };
  const parsed = availabilityBlockSchema.safeParse({
    blockedDate: formData.get("blocked_date"),
    untilDate: formData.get("until_date") || undefined,
    note: formData.get("note") || undefined,
  });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Please check the dates." };
  const days = daysBetween(parsed.data.blockedDate, parsed.data.untilDate ?? parsed.data.blockedDate);
  if (days.length > MAX_AWAY_DAYS) return { error: `That's more than ${MAX_AWAY_DAYS} days. Block it in shorter stretches.` };

  const supabase = createClient();
  const { data: old } = await supabase.from("pastor_availability_blocks").select("id, pastor_id, blocked_date, note").in("id", ids.data).eq("church_id", me.church_id);
  if (!old?.length) return { error: "That time away couldn't be found — refresh the page." };
  const pastorId = old[0].pastor_id;
  if (old.some((r) => r.pastor_id !== pastorId)) return { error: "That time away couldn't be found — refresh the page." };
  if (me.role === "pastor" && pastorId !== me.id) return { error: "You can only change your own time away." };

  // Days already blocked by a different period stay as they are.
  const { data: others } = await supabase
    .from("pastor_availability_blocks")
    .select("blocked_date")
    .eq("pastor_id", pastorId)
    .in("blocked_date", days)
    .not("id", "in", `(${ids.data.join(",")})`);
  const taken = new Set((others ?? []).map((r) => r.blocked_date));

  const { error: delError } = await supabase.from("pastor_availability_blocks").delete().in("id", ids.data).eq("church_id", me.church_id);
  if (delError) {
    console.error("[availability] edit (remove old) failed:", delError.message);
    return { error: "Couldn't save the changes — please try again." };
  }
  const rows = days.filter((d) => !taken.has(d)).map((d) => ({ church_id: me.church_id, pastor_id: pastorId, blocked_date: d, note: parsed.data.note ?? null }));
  const { error } = rows.length ? await supabase.from("pastor_availability_blocks").insert(rows) : { error: null };
  if (error) {
    console.error("[availability] edit (add new) failed:", error.message);
    // Put the old days back so nothing is lost.
    await supabase.from("pastor_availability_blocks").insert(old.map((r) => ({ church_id: me.church_id, pastor_id: r.pastor_id, blocked_date: r.blocked_date, note: r.note })));
    return { error: "Couldn't save the changes — please try again." };
  }
  revalidatePath("/dashboard/booking/availability");
  return { ok: true };
}
