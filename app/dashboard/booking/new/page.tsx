import { createClient } from "@/lib/supabase/server";
import { getCurrentAppUser } from "@/lib/current-user";
import { moduleGate } from "@/lib/gate";
import { formatDate, todayInAppZone } from "@/lib/format";
import { PageHeader } from "@/components/ui/PageHeader";
import { BookingForm } from "./BookingForm";

export default async function NewBookingPage() {
  const gate = await moduleGate("pastor_booking");
  if (gate) return gate;

  const me = (await getCurrentAppUser())!;
  const supabase = createClient();
  const today = todayInAppZone();
  const [{ data: pastors, error }, { data: blocks }] = await Promise.all([
    supabase.from("app_users").select("id, name").eq("church_id", me.church_id).in("role", ["pastor", "church_admin"]).neq("status", "disabled").order("name"),
    // Shown up front so people can avoid dates a pastor is away.
    supabase
      .from("pastor_availability_blocks")
      .select("blocked_date, app_users(name)")
      .eq("church_id", me.church_id)
      .gte("blocked_date", today)
      .order("blocked_date")
      .limit(30),
  ]);
  // Not fatal: the form still works with "Any available pastor".
  if (error) console.error("[booking] pastor list failed:", error.message);

  return (
    <div>
      <PageHeader back={{ href: "/dashboard/booking", label: "Booking requests" }} title="Request a pastor" />
      <BookingForm
        pastors={pastors ?? []}
        today={today}
        blockedDates={(blocks ?? []).map((b: any) => ({ pastor: b.app_users?.name ?? "A pastor", date: formatDate(b.blocked_date) }))}
      />
    </div>
  );
}
