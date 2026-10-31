import { createClient } from "@/lib/supabase/server";
import { getCurrentAppUser } from "@/lib/current-user";
import { moduleGate } from "@/lib/gate";
import { groupConsecutiveDays } from "@/lib/date-range";
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
      .select("id, blocked_date, pastor_id, app_users(name)")
      .eq("church_id", me.church_id)
      .gte("blocked_date", today)
      .order("blocked_date")
      .limit(400),
  ]);
  // Not fatal: the form still works with "Any available pastor".
  if (error) console.error("[booking] pastor list failed:", error.message);

  return (
    <div>
      <PageHeader back={{ href: "/dashboard/booking", label: "Booking requests" }} title="Request a pastor" />
      <BookingForm
        pastors={pastors ?? []}
        today={today}
        blockedDates={groupConsecutiveDays((blocks ?? []).map((b: any) => ({ id: b.id, date: b.blocked_date as string, key: b.pastor_id as string, name: (b.app_users?.name as string) ?? "A pastor" })))
          .slice(0, 30)
          .map((r) => ({
            pastor: r.rows[0].name,
            date: r.start === r.end ? formatDate(r.start) : `${formatDate(r.start, { year: undefined })} – ${formatDate(r.end)}`,
          }))}
      />
    </div>
  );
}
