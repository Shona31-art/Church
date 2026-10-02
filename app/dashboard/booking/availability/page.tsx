import { createClient } from "@/lib/supabase/server";
import { getCurrentAppUser } from "@/lib/current-user";
import { todayIso } from "@/lib/booking";
import { AddBlockForm, RemoveBlockForm } from "./AvailabilityForms";

export default async function AvailabilityPage() {
  const me = await getCurrentAppUser();
  if (!me || !["pastor", "church_admin"].includes(me.role)) {
    return <p className="text-ink/60">Only pastors and church admins can manage availability.</p>;
  }

  const supabase = createClient();

  const { data: pastors } =
    me.role === "church_admin"
      ? await supabase.from("app_users").select("id, name").eq("church_id", me.church_id).in("role", ["pastor", "church_admin"])
      : { data: [{ id: me.id, name: me.name }] };

  const { data: blocks, error } = await supabase
    .from("pastor_availability_blocks")
    .select("*, app_users(name)")
    .eq("church_id", me.church_id)
    .gte("blocked_date", todayIso())
    .order("blocked_date");

  return (
    <div className="max-w-lg">
      <h1 className="text-2xl font-semibold mb-1">Availability</h1>
      <p className="text-sm text-ink/50 mb-6">
        Dates marked here show as a conflict warning when someone requests a
        booking — it doesn't block the request outright, just flags it.
      </p>

      <AddBlockForm pastors={me.role === "church_admin" ? pastors ?? [] : null} today={todayIso()} />

      <div className="space-y-2">
        {blocks?.map((b: any) => (
          <div key={b.id} className="flex items-center justify-between card-elevated rounded-lg px-4 py-3 text-sm">
            <div>
              <p>{new Date(b.blocked_date).toLocaleDateString(undefined, { weekday: "long", month: "long", day: "numeric" })}</p>
              <p className="text-xs text-ink/40">
                {b.app_users?.name}
                {b.note && ` · ${b.note}`}
              </p>
            </div>
            <RemoveBlockForm id={b.id} />
          </div>
        ))}
        {error && (
          <p role="alert" className="text-sm text-red-700">⚠ Couldn't load blocked dates — refresh the page to try again.</p>
        )}
        {!error && !blocks?.length && (
          <p className="text-ink/40 text-sm">No blocked dates coming up. Add one above when you're away.</p>
        )}
      </div>
    </div>
  );
}
