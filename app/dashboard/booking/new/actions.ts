"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getCurrentAppUser } from "@/lib/current-user";

export async function createBooking(
  _prevState: { error?: string } | null,
  formData: FormData
): Promise<{ error?: string } | null> {
  const me = await getCurrentAppUser();
  if (!me) return { error: "Not signed in." };

  const bookingType = String(formData.get("booking_type") || "");
  const preferredDate = String(formData.get("preferred_date") || "");
  const preferredTime = String(formData.get("preferred_time") || "") || null;
  const location = String(formData.get("location") || "");
  const details = String(formData.get("details") || "");
  const pastorId = String(formData.get("pastor_id") || "") || null;

  if (!bookingType || !preferredDate) {
    return { error: "Please choose a service type and a preferred date." };
  }

  const supabase = createClient();
  const { data: booking, error } = await supabase
    .from("pastor_bookings")
    .insert({
      church_id: me.church_id,
      requested_by: me.id,
      pastor_id: pastorId,
      booking_type: bookingType,
      preferred_date: preferredDate,
      preferred_time: preferredTime,
      location,
      details,
    })
    .select("id")
    .single();

  if (error || !booking) {
    return { error: error?.message || "Couldn't submit your request — try again." };
  }

  redirect(`/dashboard/booking/${booking.id}`);
}
