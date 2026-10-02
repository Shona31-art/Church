"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getCurrentAppUser } from "@/lib/current-user";
import { checkModuleAccess } from "@/lib/paywall";
import { todayIso } from "@/lib/booking";
import { bookingRequestSchema } from "@/lib/booking-schemas";

export async function createBooking(
  _prevState: { error?: string } | null,
  formData: FormData
): Promise<{ error?: string } | null> {
  const me = await getCurrentAppUser();
  if (!me) return { error: "Your session has expired — sign in again, then resubmit." };
  const access = await checkModuleAccess("pastor_booking");
  if (!access.allowed) return { error: access.reason ?? "Booking isn't available on your church's plan." };

  const parsed = bookingRequestSchema(todayIso()).safeParse({
    bookingType: formData.get("booking_type"),
    pastorId: formData.get("pastor_id") || undefined,
    preferredDate: formData.get("preferred_date"),
    preferredTime: formData.get("preferred_time") || undefined,
    location: formData.get("location") || undefined,
    details: formData.get("details") || undefined,
  });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Please check the form." };
  const input = parsed.data;

  // RLS (booking_security_fix.sql) also forces status 'pending' and checks
  // the chosen pastor belongs to this church; this gives a friendly message.
  const supabase = createClient();
  if (input.pastorId) {
    const { data: pastor } = await supabase
      .from("app_users")
      .select("id")
      .eq("id", input.pastorId)
      .eq("church_id", me.church_id)
      .in("role", ["pastor", "church_admin"])
      .maybeSingle();
    if (!pastor) return { error: "That pastor couldn't be found — choose another or 'Any available pastor'." };
  }

  const { data: booking, error } = await supabase
    .from("pastor_bookings")
    .insert({
      church_id: me.church_id,
      requested_by: me.id,
      pastor_id: input.pastorId ?? null,
      booking_type: input.bookingType,
      preferred_date: input.preferredDate,
      preferred_time: input.preferredTime ?? null,
      location: input.location ?? null,
      details: input.details ?? null,
    })
    .select("id")
    .single();

  if (error || !booking) {
    console.error("[booking] create failed:", error?.message);
    return { error: "Couldn't submit your request — please try again. Your details are still in the form." };
  }

  redirect(`/dashboard/booking/${booking.id}`);
}
