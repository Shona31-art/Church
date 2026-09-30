import { createClient } from "@/lib/supabase/server";
import { getCurrentAppUser } from "@/lib/current-user";

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

  const { data: blocks } = await supabase
    .from("pastor_availability_blocks")
    .select("*, app_users(name)")
    .eq("church_id", me.church_id)
    .gte("blocked_date", new Date().toISOString().slice(0, 10))
    .order("blocked_date");

  async function addBlock(formData: FormData) {
    "use server";
    const me = await getCurrentAppUser();
    if (!me || !["pastor", "church_admin"].includes(me.role)) return;

    const pastorId = String(formData.get("pastor_id") || me.id);
    const blockedDate = String(formData.get("blocked_date") || "");
    const note = String(formData.get("note") || "");
    if (!blockedDate) return;
    if (me.role === "pastor" && pastorId !== me.id) return;

    const supabase = createClient();
    await supabase.from("pastor_availability_blocks").insert({
      church_id: me.church_id,
      pastor_id: pastorId,
      blocked_date: blockedDate,
      note,
    });
  }

  async function removeBlock(formData: FormData) {
    "use server";
    const me = await getCurrentAppUser();
    if (!me || !["pastor", "church_admin"].includes(me.role)) return;

    const supabase = createClient();
    await supabase
      .from("pastor_availability_blocks")
      .delete()
      .eq("id", String(formData.get("id")))
      .eq("church_id", me.church_id);
  }

  return (
    <div className="max-w-lg">
      <h1 className="text-2xl font-semibold mb-1">Availability</h1>
      <p className="text-sm text-ink/50 mb-6">
        Dates marked here show as a conflict warning when someone requests a
        booking — it doesn't block the request outright, just flags it.
      </p>

      <form action={addBlock} className="flex flex-wrap gap-2 mb-8">
        {me.role === "church_admin" && (
          <select name="pastor_id" className="border border-ink/20 rounded-lg px-3 py-2 text-sm">
            {pastors?.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
        )}
        <input type="date" name="blocked_date" required className="border border-ink/20 rounded-lg px-3 py-2 text-sm" />
        <input
          name="note"
          placeholder="Note (optional), e.g. 'Vacation'"
          className="flex-1 min-w-[160px] border border-ink/20 rounded-lg px-3 py-2 text-sm"
        />
        <button type="submit" className="bg-ember text-white px-4 py-2 rounded-lg text-sm">
          Block date
        </button>
      </form>

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
            <form action={removeBlock}>
              <input type="hidden" name="id" value={b.id} />
              <button type="submit" className="text-xs text-red-700">
                Remove
              </button>
            </form>
          </div>
        ))}
        {!blocks?.length && <p className="text-ink/40 text-sm">No blocked dates coming up.</p>}
      </div>
    </div>
  );
}
