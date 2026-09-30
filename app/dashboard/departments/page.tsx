import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { getCurrentAppUser } from "@/lib/current-user";

export default async function DepartmentsPage() {
  const me = await getCurrentAppUser();
  const supabase = createClient();

  const { data: departments } = await supabase
    .from("departments")
    .select("id, name, app_users(id)")
    .eq("church_id", me!.church_id)
    .order("name");

  const canManage = me && ["church_admin", "pastor"].includes(me.role);

  async function deleteDepartment(formData: FormData) {
    "use server";
    const me = await getCurrentAppUser();
    if (!me || me.role !== "church_admin") return;

    const id = String(formData.get("id"));
    const supabase = createClient();
    await supabase.from("departments").delete().eq("id", id).eq("church_id", me.church_id);
  }

  return (
    <div className="max-w-lg">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-semibold">Departments</h1>
        {canManage && (
          <Link
            href="/dashboard/departments/new"
            className="bg-ember text-white px-4 py-2 rounded-lg text-sm font-medium"
          >
            + New department
          </Link>
        )}
      </div>

      <div className="space-y-2">
        {departments?.map((d: any) => (
          <div
            key={d.id}
            className="flex items-center justify-between border border-ink/10 rounded-lg px-4 py-3 bg-white/60"
          >
            <div>
              <p className="font-medium">{d.name}</p>
              <p className="text-xs text-ink/40">{d.app_users?.length ?? 0} member(s)</p>
            </div>
            {me?.role === "church_admin" && (
              <form action={deleteDepartment}>
                <input type="hidden" name="id" value={d.id} />
                <button type="submit" className="text-red-700 text-xs">
                  Remove
                </button>
              </form>
            )}
          </div>
        ))}
        {!departments?.length && (
          <p className="text-ink/40 text-sm">
            No departments yet — try Worship, Youth, Media, or Ushers.
          </p>
        )}
      </div>
    </div>
  );
}
