"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { redirect } from "next/navigation";
import { getCurrentAppUser } from "@/lib/current-user";
import { checkModuleAccess } from "@/lib/paywall";
import { logAudit } from "@/lib/audit";
import { can } from "@/lib/permissions";
import { flash } from "@/lib/flash";
import { canTransition } from "@/lib/booking";
import { formatDate, todayInAppZone } from "@/lib/format";
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
  flash(to === "approved" ? "Booking approved. The requester will see it on their request." : to === "declined" ? "Booking declined." : to === "cancelled" ? "Booking cancelled." : "Marked as completed.");
  return { ok: true };
}

/**
 * The requester withdraws their own pending or approved request.
 * Form fields: booking_id. Runs through the cancel_booking_request() database
 * function, which only lets the original requester cancel (platform_hardening.sql).
 */
export async function cancelMyBooking(_prev: FormResult, formData: FormData): Promise<FormResult> {
  const me = await getCurrentAppUser();
  if (!me) return { error: "Your session has expired — sign in again to continue." };
  const bookingId = z.string().uuid().safeParse(formData.get("booking_id"));
  if (!bookingId.success) return { error: "That request couldn't be found." };

  const { data: cancelled, error } = await createClient().rpc("cancel_booking_request", { target_booking: bookingId.data });
  if (error) {
    console.error("[booking] cancel failed:", error.message);
    return { error: "Couldn't cancel your request — please try again." };
  }
  if (cancelled !== true) return { error: "This request can't be cancelled any more — a pastor may have already responded. Refresh to see its status." };

  await logAudit({ churchId: me.church_id, actorId: me.id, action: "booking_cancelled_by_requester", targetTable: "pastor_bookings", targetId: bookingId.data });
  revalidatePath(`/dashboard/booking/${bookingId.data}`);
  revalidatePath("/dashboard/booking");
  flash("Your request was cancelled. The pastors can see it's been withdrawn.");
  return { ok: true };
}

/**
 * Deletes a booking request for good. Pastors and church admins: any request
 * in their church. The requester: their own, once it's declined, cancelled or
 * completed, or while it's still waiting for a pastor. Checked here (the table
 * has no delete rule), then removed with the server's rights; any call for it
 * goes too. Recorded in the activity log. Form fields: booking_id.
 */
export async function deleteBooking(formData: FormData): Promise<void> {
  const me = await getCurrentAppUser();
  if (!me?.church_id) {
    flash("Your session has expired — sign in again to continue.", "error");
    return;
  }
  const bookingId = z.string().uuid().safeParse(formData.get("booking_id"));
  if (!bookingId.success) return;
  // RLS: only a booking this person can see.
  const { data: booking } = await createClient().from("pastor_bookings").select("id, church_id, requested_by, status, booking_type").eq("id", bookingId.data).maybeSingle();
  if (!booking || booking.church_id !== me.church_id) {
    flash("That request couldn't be found.", "error");
    return;
  }
  const shepherd = can(me.role, "manageBookings");
  const ownClosed = booking.requested_by === me.id && ["pending", "declined", "cancelled", "completed"].includes(booking.status);
  if (!shepherd && !ownClosed) {
    flash("You can delete this request once it's closed — cancel it first.", "error");
    return;
  }
  const { error } = await createAdminClient().from("pastor_bookings").delete().eq("id", booking.id).eq("church_id", me.church_id);
  if (error) {
    console.error("[booking] delete failed:", error.message);
    flash("Couldn't delete the request — please try again.", "error");
    return;
  }
  await logAudit({ churchId: me.church_id, actorId: me.id, action: "booking_deleted", targetTable: "pastor_bookings", targetId: booking.id, metadata: { status: booking.status, type: booking.booking_type } });
  revalidatePath("/dashboard/booking");
  flash("The request was deleted.");
  redirect("/dashboard/booking");
}

const rescheduleSchema = z.object({
  bookingId: z.string().uuid(),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Choose a date."),
  time: z.union([z.string().regex(/^\d{2}:\d{2}$/), z.literal("")]).transform((v) => v || null),
});

/**
 * Moves a booking to a new date (and time). Pastors and church admins: any
 * open booking (pending or approved); the requester is told. The requester:
 * their own open booking — an approved one goes back to "waiting" so a pastor
 * confirms the new time, and the pastors are told. Form fields: booking_id,
 * date, time?
 */
export async function rescheduleBooking(_prev: FormResult, formData: FormData): Promise<FormResult> {
  const me = await getCurrentAppUser();
  if (!me?.church_id) return { error: "Your session has expired — sign in again to continue." };
  const parsed = rescheduleSchema.safeParse({ bookingId: formData.get("booking_id"), date: formData.get("date") ?? "", time: formData.get("time") ?? "" });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Choose a date." };
  const { bookingId, date, time } = parsed.data;
  if (date < todayInAppZone()) return { error: "Choose today or a later date." };

  // RLS: only a booking this person can see.
  const { data: booking } = await createClient()
    .from("pastor_bookings")
    .select("id, church_id, requested_by, pastor_id, status, booking_type, preferred_date, preferred_time")
    .eq("id", bookingId)
    .maybeSingle();
  if (!booking || booking.church_id !== me.church_id) return { error: "That request couldn't be found." };
  if (!["pending", "approved"].includes(booking.status)) return { error: "Only waiting or approved bookings can be rescheduled." };
  const shepherd = can(me.role, "manageBookings");
  const requester = booking.requested_by === me.id;
  if (!shepherd && !requester) return { error: "You can't change this booking." };

  // The requester moving an approved booking: a pastor confirms the new time again.
  const backToWaiting = !shepherd && booking.status === "approved";
  const admin = createAdminClient(); // the table only lets pastors update; checked above
  const { error } = await admin
    .from("pastor_bookings")
    .update({ preferred_date: date, preferred_time: time, ...(backToWaiting ? { status: "pending" } : {}) })
    .eq("id", booking.id)
    .eq("church_id", me.church_id);
  if (error) {
    console.error("[booking] reschedule failed:", error.message);
    return { error: "Couldn't reschedule — please try again." };
  }

  // Tell the other side.
  const kind = booking.booking_type.charAt(0).toUpperCase() + booking.booking_type.slice(1);
  const when = `${formatDate(date)}${time ? ` at ${time}` : ""}`;
  let recipients: string[] = [];
  if (shepherd && !requester) recipients = [booking.requested_by];
  else {
    const { data: pastors } = await admin.from("app_users").select("id").eq("church_id", me.church_id).eq("status", "active").in("role", ["pastor", "church_admin"]);
    const all = ((pastors ?? []) as { id: string }[]).map((p) => p.id);
    recipients = (booking.pastor_id && all.includes(booking.pastor_id) ? [booking.pastor_id] : all).filter((id) => id !== me.id);
  }
  if (recipients.length) {
    const title = shepherd && !requester ? "Booking rescheduled" : `${me.name} rescheduled a booking`;
    const body = `${kind} moved to ${when}${backToWaiting ? " — needs approving again" : ""}`;
    const { error: notifyError } = await admin.from("notifications").insert(
      recipients.map((user_id) => ({ user_id, church_id: me.church_id, category: shepherd && !requester ? "prayer_care" : "alerts", type: "booking.rescheduled", title, body, link: `/dashboard/booking/${booking.id}`, actor_id: me.id })),
    );
    if (notifyError) console.error("[booking] reschedule notice failed:", notifyError.message);
  }

  await logAudit({ churchId: me.church_id, actorId: me.id, action: "booking_rescheduled", targetTable: "pastor_bookings", targetId: booking.id, metadata: { from: booking.preferred_date, to: date } });
  revalidatePath(`/dashboard/booking/${booking.id}`);
  revalidatePath("/dashboard/booking");
  flash(backToWaiting ? `Moved to ${when}. A pastor will confirm the new time.` : `Moved to ${when}.`);
  return { ok: true };
}
