import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { checkModuleAccess } from "@/lib/paywall";
import { getCurrentAppUser } from "@/lib/current-user";

export default async function EventDetailPage({ params }: { params: { id: string } }) {
  const access = await checkModuleAccess("calendar");
  if (!access.allowed) return <p className="text-red-600">{access.reason}</p>;

  const me = await getCurrentAppUser();
  const supabase = createClient();

  const { data: event } = await supabase
    .from("events")
    .select("*, departments(name), event_rsvps(status, user_id)")
    .eq("id", params.id)
    .single();

  if (!event) notFound();

  const myRsvp = event.event_rsvps?.find((r: any) => r.user_id === me!.id)?.status;
  const counts = ["going", "maybe", "declined"].map((s) => ({
    status: s,
    count: event.event_rsvps?.filter((r: any) => r.status === s).length ?? 0,
  }));

  async function rsvp(formData: FormData) {
    "use server";
    const me = await getCurrentAppUser();
    if (!me) return;

    const status = String(formData.get("status"));
    const supabase = createClient();
    await supabase
      .from("event_rsvps")
      .upsert({ event_id: params.id, user_id: me.id, status });
  }

  return (
    <div className="max-w-lg">
      <h1 className="text-2xl font-semibold mb-1">{event.title}</h1>
      <p className="text-sm text-ink/50 mb-4">
        {new Date(event.start_time).toLocaleString()}
        {event.location && ` · ${event.location}`}
        {event.departments?.name && ` · ${event.departments.name}`}
      </p>

      {event.description && <p className="text-ink/70 mb-6">{event.description}</p>}

      <div className="border border-ink/10 rounded-xl p-4 bg-white/60">
        <p className="text-sm font-medium mb-3">
          {myRsvp ? `You're marked as: ${myRsvp}` : "Will you be there?"}
        </p>
        <form action={rsvp} className="flex gap-2">
          {["going", "maybe", "declined"].map((s) => (
            <button
              key={s}
              type="submit"
              name="status"
              value={s}
              className={`px-4 py-2 rounded-lg text-sm capitalize ${
                myRsvp === s ? "bg-ember text-white" : "border border-ink/20"
              }`}
            >
              {s}
            </button>
          ))}
        </form>
        <p className="text-xs text-ink/40 mt-3">
          {counts.map((c) => `${c.count} ${c.status}`).join(" · ")}
        </p>
      </div>
    </div>
  );
}
