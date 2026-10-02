import { createClient } from "@/lib/supabase/server";
import { checkModuleAccess } from "@/lib/paywall";
import { getCurrentAppUser } from "@/lib/current-user";
import { todayIso } from "@/lib/booking";
import { BookingForm } from "./BookingForm";

export default async function NewBookingPage() {
  const access = await checkModuleAccess("pastor_booking");
  if (!access.allowed) return <p className="text-red-600">{access.reason}</p>;

  const me = await getCurrentAppUser();
  const supabase = createClient();
  const { data: pastors, error } = await supabase
    .from("app_users")
    .select("id, name")
    .eq("church_id", me!.church_id)
    .in("role", ["pastor", "church_admin"])
    .order("name");
  // Not fatal: the form still works with "Any available pastor".
  if (error) console.error("[booking] pastor list failed:", error.message);

  return <BookingForm pastors={pastors || []} today={todayIso()} />;
}
