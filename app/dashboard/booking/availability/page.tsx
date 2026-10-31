import { createClient } from "@/lib/supabase/server";
import { getCurrentAppUser } from "@/lib/current-user";
import { moduleGate } from "@/lib/gate";
import { can } from "@/lib/permissions";
import { groupConsecutiveDays } from "@/lib/date-range";
import { formatDate, todayInAppZone } from "@/lib/format";
import { PageHeader } from "@/components/ui/PageHeader";
import { EmptyState } from "@/components/ui/EmptyState";
import { Alert } from "@/components/ui/Alert";
import { PermissionDenied } from "@/components/ui/Gates";
import { AddBlockForm, RemoveBlockForm } from "./AvailabilityForms";

export default async function AvailabilityPage() {
  const gate = await moduleGate("pastor_booking");
  if (gate) return gate;

  const me = await getCurrentAppUser();
  if (!me || !can(me.role, "manageBookings")) {
    return <PermissionDenied message="Only pastors and church admins can manage availability." backHref="/dashboard/booking" />;
  }

  const supabase = createClient();
  const today = todayInAppZone();
  const [{ data: pastors }, { data: blocks, error }] = await Promise.all([
    me.role === "church_admin"
      ? supabase.from("app_users").select("id, name").eq("church_id", me.church_id).in("role", ["pastor", "church_admin"]).neq("status", "disabled").order("name")
      : Promise.resolve({ data: [{ id: me.id, name: me.name }] }),
    supabase.from("pastor_availability_blocks").select("id, blocked_date, note, pastor_id, app_users(name)").eq("church_id", me.church_id).gte("blocked_date", today).order("blocked_date"),
  ]);

  return (
    <div className="max-w-2xl space-y-6">
      <PageHeader
        back={{ href: "/dashboard/booking", label: "Booking requests" }}
        title="Availability"
        description="When you're away, for a day or several weeks. Members see them when requesting, and requests on these dates are flagged — they aren't blocked outright."
      />

      <AddBlockForm pastors={me.role === "church_admin" ? pastors ?? [] : null} today={today} />

      {error ? (
        <Alert tone="error">Couldn&apos;t load blocked dates — refresh the page to try again.</Alert>
      ) : !blocks?.length ? (
        <EmptyState title="No blocked dates coming up" description="Add one above when you'll be away." />
      ) : (
        <ul className="card-elevated rounded-2xl divide-y divide-line">
          {groupConsecutiveDays(
            blocks.map((b: any) => ({ id: b.id, date: b.blocked_date as string, key: `${b.pastor_id}|${b.note ?? ""}`, pastorId: b.pastor_id as string, name: (b.app_users?.name as string) ?? "Pastor", note: b.note as string | null }))
          ).map((range) => {
            const first = range.rows[0];
            const days = range.rows.length;
            const when =
              days === 1
                ? formatDate(range.start, { weekday: "long" })
                : `${formatDate(range.start, { year: undefined })} – ${formatDate(range.end)}`;
            const canRemove = me.role === "church_admin" || first.pastorId === me.id;
            return (
              <li key={first.id} className="flex items-center justify-between gap-3 px-4 py-3 text-sm">
                <div className="min-w-0">
                  <p className="font-medium">{when}</p>
                  <p className="text-xs text-ink/60">
                    {first.name}
                    {days > 1 && ` · ${days} days`}
                    {first.note && ` · ${first.note}`}
                  </p>
                </div>
                {canRemove && <RemoveBlockForm ids={range.rows.map((r) => r.id)} label={`${when} (${first.name})`} />}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
