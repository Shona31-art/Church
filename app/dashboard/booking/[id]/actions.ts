"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getCurrentAppUser } from "@/lib/current-user";
import { checkModuleAccess } from "@/lib/paywall";
import { logAudit } from "@/lib/audit";
import { canTransition } from "@/lib/booking";
import { statusChangeSchema } from "@/lib/booking-schemas";

export type FormResult = { error?: string; ok?: boolean } | null;

/**
 * Approve / decline / complete a booking request.
 *
 * Form fields: booking_id, from (the status the pastor saw), to, decline_reason?
 * Returns { error } with a user-facing message, or { ok: true }.
 *
 * Concurrency: the update only applies `where status = from`. If another
 * pastor already decided this request, zero rows change and we say so,
 * instead of silently overwriting their decision.
 */
export async function updateBookingStatus(_prev: FormResult, formData: FormData): Promise<FormResult> {
  const me = await getCurrentAppUser();
  if (!me) return { error: "Your session has expired — sign in again to continue." };
  if (!["pastor", "church_admin"].includes(me.role)) return { error: "Only pastors and church admins can action bookings." };
  const access = await checkModuleAccess("pastor_booking");
  if (!access.allowed) return { error: access.reason ?? "Booking isn't available on your church's plan." };

  const parsed = statusChangeSchema.safeParse({
    bookingId: formData.get("booking_id"),
    from: formData.get("from"),
    to: formData.get("to"),
    declineReason: formData.get("decline_reason") || undefined,
  });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Please check the form." };
  const { bookingId, from, to, declineReason } = parsed.data;
  if (!canTransition(from, to)) return { error: `A ${from} booking can't be marked ${to}.` };

  const supabase = createClient();
  const { data: updated, error } = await supabase
    .from("pastor_bookings")
    .update({ status: to, decline_reason: to === "declined" ? declineReason ?? null : null })
    .eq("id", bookingId)
    .eq("church_id", me.church_id)
    .eq("status", from)
    .select("id");

  if (error) {
    console.error("[booking] status update failed:", error.message);
    return { error: "Couldn't update this booking — please try again." };
  }
  if (!updated?.length) {
    revalidatePath(`/dashboard/booking/${bookingId}`);
    return { error: "This request was changed by someone else while you were viewing it. The page now shows its latest status." };
  }

  await logAudit({
    churchId: me.church_id,
    actorId: me.id,
    action: `booking_${to}`,
    targetTable: "pastor_bookings",
    targetId: bookingId,
    metadata: { from, to },
  });

  revalidatePath(`/dashboard/booking/${bookingId}`);
  revalidatePath("/dashboard/booking");
  return { ok: true };
}
