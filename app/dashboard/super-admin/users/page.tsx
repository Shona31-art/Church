import { createClient } from "@/lib/supabase/server";
import { getCurrentAppUser } from "@/lib/current-user";
import { CreateUserForm, SetUserPasswordForm } from "./UserForms";

type UserRow = {
  id: string;
  name: string;
  email: string;
  phone: string | null;
  role: string;
  status: string;
  church_id: string | null;
  churches: { name: string }[] | null;
};

export default async function SuperAdminUsersPage() {
  const me = await getCurrentAppUser();
  if (!me || me.role !== "super_admin") {
    return <p className="text-ink/60">Super Admin access only.</p>;
  }

  const supabase = createClient();
  const [
    { data: churches, error: churchesError },
    { data: departments, error: departmentsError },
    { data: rows, error: usersError },
  ] = await Promise.all([
    supabase.from("churches").select("id, name").order("name"),
    supabase.from("departments").select("id, name, church_id").order("name"),
    supabase
      .from("app_users")
      .select("id, name, email, phone, role, status, church_id, churches(name)")
      .order("email"),
  ]);

  const loadError = churchesError || departmentsError || usersError;
  if (loadError) {
    return <p role="alert" className="text-red-700">Could not load user management: {loadError.message}</p>;
  }

  const users = (rows ?? []) as UserRow[];
  const churchOptions = churches ?? [];

  return (
    <div className="max-w-6xl space-y-8">
      <header>
        <h1 className="text-2xl font-semibold">Users</h1>
        <p className="mt-1 text-sm text-ink/60">Accounts, church assignments, roles, and password management.</p>
      </header>

      {churchOptions.length ? (
        <CreateUserForm churches={churchOptions} departments={departments ?? []} />
      ) : (
        <p className="rounded-lg border border-ink/10 p-4 text-sm text-ink/60">
          Create a church before adding church users.
        </p>
      )}

      <section>
        <h2 className="text-lg font-semibold mb-3">All users ({users.length})</h2>
        <div className="overflow-x-auto rounded-xl border border-ink/10">
          <table className="w-full min-w-[850px] text-sm">
            <thead className="bg-ink/5 text-left">
              <tr>
                <th className="px-4 py-3">User</th>
                <th className="px-4 py-3">Church</th>
                <th className="px-4 py-3">Role</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">Set password</th>
              </tr>
            </thead>
            <tbody>
              {users.map((user) => (
                <tr key={user.id} className="border-t border-ink/10 align-top">
                  <td className="px-4 py-3">
                    <p className="font-medium">{user.name}</p>
                    <p className="text-xs text-ink/50">{user.email}</p>
                  </td>
                  <td className="px-4 py-3">{user.churches?.[0]?.name ?? (user.role === "super_admin" ? "Platform" : "—")}</td>
                  <td className="px-4 py-3 capitalize">{user.role.replaceAll("_", " ")}</td>
                  <td className="px-4 py-3 capitalize">{user.status}</td>
                  <td className="px-4 py-3"><SetUserPasswordForm userId={user.id} /></td>
                </tr>
              ))}
              {!users.length && (
                <tr>
                  <td colSpan={5} className="px-4 py-6 text-center text-ink/40">No users yet.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
