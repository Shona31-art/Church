import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { checkModuleAccess } from "@/lib/paywall";
import { getCurrentAppUser } from "@/lib/current-user";

export default async function MembersPage({
  searchParams,
}: {
  searchParams: { q?: string };
}) {
  const access = await checkModuleAccess("members");
  if (!access.allowed) {
    return <p className="text-red-600">{access.reason}</p>;
  }

  const me = await getCurrentAppUser();
  if (!me || !["church_admin", "pastor", "super_admin"].includes(me.role)) {
    return (
      <p className="text-ink/60">
        Member management is only available to church admins and pastors.
      </p>
    );
  }

  const supabase = createClient();
  let query = supabase
    .from("app_users")
    .select("id, name, email, phone, role, status, department_id, departments(name)")
    .eq("church_id", me.church_id)
    .order("name");

  if (searchParams.q) {
    query = query.ilike("name", `%${searchParams.q}%`);
  }

  const { data: members } = await query;

  return (
    <div className="max-w-3xl">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-semibold">Members</h1>
        <Link
          href="/dashboard/members/new"
          className="bg-ember text-white px-4 py-2 rounded-lg text-sm font-medium"
        >
          + Add member
        </Link>
      </div>

      <form className="mb-6">
        <input
          type="text"
          name="q"
          defaultValue={searchParams.q}
          placeholder="Search by name..."
          className="w-full max-w-sm border border-ink/20 rounded-lg px-4 py-2"
        />
      </form>

      <div className="border border-ink/10 rounded-xl overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-ink/5 text-left">
            <tr>
              <th className="px-4 py-2">Name</th>
              <th className="px-4 py-2">Role</th>
              <th className="px-4 py-2">Department</th>
              <th className="px-4 py-2">Status</th>
              <th className="px-4 py-2"></th>
            </tr>
          </thead>
          <tbody>
            {members?.map((m: any) => (
              <tr key={m.id} className="border-t border-ink/10">
                <td className="px-4 py-2">
                  <div>{m.name}</div>
                  <div className="text-ink/40 text-xs">{m.email}</div>
                </td>
                <td className="px-4 py-2 capitalize">{m.role.replace("_", " ")}</td>
                <td className="px-4 py-2">{m.departments?.name ?? "—"}</td>
                <td className="px-4 py-2">
                  <span
                    className={
                      m.status === "active"
                        ? "text-green-700"
                        : m.status === "invited"
                        ? "text-amber-700"
                        : "text-ink/40"
                    }
                  >
                    {m.status}
                  </span>
                </td>
                <td className="px-4 py-2 text-right">
                  <Link href={`/dashboard/members/${m.id}`} className="text-ember">
                    Edit
                  </Link>
                </td>
              </tr>
            ))}
            {!members?.length && (
              <tr>
                <td colSpan={5} className="px-4 py-6 text-center text-ink/40">
                  No members found.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
