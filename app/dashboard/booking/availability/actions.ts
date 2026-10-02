"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { getCurrentAppUser } from "@/lib/current-user";
import { availabilityBlockSchema } from "@/lib/booking-schemas";

export type FormResult = { error?: string; ok?: boolean } | null;

// Pastors manage their own blocked dates; church admins can manage any
// pastor's in their church. RLS (booking_security_fix.sql) enforces the same.
async function requireShepherd() {
  const me = await getCurrentAppUser();
  if (!me || !["pastor", "church_admin"].includes(me.role) || !me.church_id) return null;
  return me;
}

/** Form fields: pastor_id? (admins only), blocked_date, note? */
export async function addAvailabilityBlock(_prev: FormResult, formData: FormData): Promise<FormResult> {
  const me = await requireShepherd();
  if (!me) return { error: "Only pastors and church admins can manage availability. If you are one, sign in again." };

  const parsed = availabilityBlockSchema.safeParse({
    pastorId: formData.get("pastor_id") || undefined,
    blockedDate: formData.get("blocked_date"),
    note: formData.get("note") || undefined,
  });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Please check the form." };
  const pastorId = parsed.data.pastorId ?? me.id;
  if (me.role === "pastor" && pastorId !== me.id) return { error: "You can only block dates for yourself." };

  const supabase = createClient();
  const { error } = await supabase.from("pastor_availability_blocks").insert({
    church_id: me.church_id,
    pastor_id: pastorId,
    blocked_date: parsed.data.blockedDate,
    note: parsed.data.note ?? null,
  });
  if (error) {
    console.error("[availability] add failed:", error.message);
    return { error: "Couldn't block that date — please try again." };
  }

  revalidatePath("/dashboard/booking/availability");
  return { ok: true };
}

/** Form fields: id */
export async function removeAvailabilityBlock(_prev: FormResult, formData: FormData): Promise<FormResult> {
  const me = await requireShepherd();
  if (!me) return { error: "Your session has expired — sign in again to continue." };

  const id = z.string().uuid().safeParse(formData.get("id"));
  if (!id.success) return { error: "That date couldn't be found." };

  const supabase = createClient();
  const { data: removed, error } = await supabase
    .from("pastor_availability_blocks")
    .delete()
    .eq("id", id.data)
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
