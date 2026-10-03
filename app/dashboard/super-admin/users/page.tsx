import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { getCurrentAppUser } from "@/lib/current-user";
import { ROLES, ROLE_LABELS, roleLabel, type AccountStatus } from "@/lib/permissions";
import { formatDate } from "@/lib/format";
import { PAGE_SIZE, buildQuery, orFilterPattern, pageFrom } from "@/lib/list";
import { PageHeader } from "@/components/ui/PageHeader";
import { FilterBar, FilterSelect } from "@/components/ui/FilterBar";
import { Pagination } from "@/components/ui/Pagination";
import { EmptyState } from "@/components/ui/EmptyState";
import { Alert } from "@/components/ui/Alert";
import { PermissionDenied } from "@/components/ui/Gates";
import { MemberStatusBadge } from "@/app/dashboard/members/MemberBadges";

type Search = { q?: string; role?: string; status?: string; church?: string; page?: string };

export default async function PlatformUsersPage({ searchParams }: { searchParams: Search }) {
  const me = await getCurrentAppUser();
  if (!me || me.role !== "super_admin") return <PermissionDenied message="This area is for platform administrators only." />;

  const q = (searchParams.q ?? "").trim().slice(0, 80);
  const role = (ROLES as readonly string[]).includes(searchParams.role ?? "") ? searchParams.role : undefined;
  const status = ["active", "invited", "disabled"].includes(searchParams.status ?? "") ? searchParams.status : undefined;
  const church = /^[0-9a-f-]{36}$/i.test(searchParams.church ?? "") ? searchParams.church : undefined;
  const page = pageFrom(searchParams.page);

  const supabase = createClient();
  let query = supabase
    .from("app_users")
    .select("id, name, email, role, status, created_at, church_id, churches(name)", { count: "exact" })
    .order("created_at", { ascending: false })
    .range(page * PAGE_SIZE, page * PAGE_SIZE + PAGE_SIZE - 1);
  if (q) query = query.or(`name.ilike.${orFilterPattern(q)},email.ilike.${orFilterPattern(q)}`);
  if (role) query = query.eq("role", role);
  if (status) query = query.eq("status", status);
  if (church) query = query.eq("church_id", church);

  const [{ data: users, count, error }, { data: churches }] = await Promise.all([query, supabase.from("churches").select("id, name").order("name").limit(2000)]);
  if (error) console.error("[super-admin] users failed:", error.message);
  const total = count ?? 0;
  const filtered = Boolean(q || role || status || church);

  return (
    <div className="max-w-6xl">
      <PageHeader
        title="Platform users"
        description="Every login on the platform. A church's own Members page is where its admins manage their people; use this for support and account recovery."
        actions={
          <Link href="/dashboard/super-admin/users/new" className="btn-primary">
            Add user
          </Link>
        }
      />

      <FilterBar query={q} placeholder="Search by name or email…" label="Search users" resetHref="/dashboard/super-admin/users" active={filtered}>
        <FilterSelect name="role" label="Role" value={role} allLabel="All roles" options={ROLES.map((r) => ({ value: r, label: ROLE_LABELS[r] }))} />
        <FilterSelect name="status" label="Status" value={status} allLabel="Any status" options={[{ value: "active", label: "Active" }, { value: "invited", label: "Invite sent" }, { value: "disabled", label: "Disabled" }]} />
        <FilterSelect name="church" label="Church" value={church} allLabel="All churches" options={(churches ?? []).map((c) => ({ value: c.id, label: c.name }))} />
      </FilterBar>

      {error ? (
        <Alert tone="error">Couldn&apos;t load users — refresh to try again.</Alert>
      ) : !users?.length ? (
        <EmptyState title={filtered ? "No users match those filters" : "No users yet"} />
      ) : (
        <>
          <p className="text-xs text-ink/60 mb-2">
            {total} {total === 1 ? "user" : "users"}
          </p>
          <div className="hidden md:block card-elevated rounded-2xl overflow-hidden">
            <table className="w-full text-sm">
              <caption className="sr-only">Platform users</caption>
              <thead className="bg-ink/[0.03] text-left text-xs uppercase tracking-wide text-ink/50">
                <tr>
                  <th scope="col" className="px-4 py-3">User</th>
                  <th scope="col" className="px-4 py-3">Church</th>
                  <th scope="col" className="px-4 py-3">Role</th>
                  <th scope="col" className="px-4 py-3">Status</th>
                  <th scope="col" className="px-4 py-3">Created</th>
                  <th scope="col" className="px-4 py-3"><span className="sr-only">Actions</span></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {users.map((u: any) => (
                  <tr key={u.id} className="hover:bg-ink/[0.02]">
                    <td className="px-4 py-3">
                      <p className="font-medium">{u.name}</p>
                      <p className="text-xs text-ink/50">{u.email}</p>
                    </td>
                    <td className="px-4 py-3">{u.churches?.name ?? (u.role === "super_admin" ? <span className="text-ink/50">Platform</span> : "—")}</td>
                    <td className="px-4 py-3">{roleLabel(u.role)}</td>
                    <td className="px-4 py-3">
                      <MemberStatusBadge status={u.status as AccountStatus} />
                    </td>
                    <td className="px-4 py-3 text-ink/60">{formatDate(u.created_at, { weekday: undefined })}</td>
                    <td className="px-4 py-3 text-right">
                      <Link href={`/dashboard/super-admin/users/${u.id}`} className="btn-ghost btn-sm">
                        Manage<span className="sr-only"> {u.name}</span>
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <ul className="md:hidden space-y-2">
            {users.map((u: any) => (
              <li key={u.id}>
                <Link href={`/dashboard/super-admin/users/${u.id}`} className="card-elevated rounded-xl p-4 flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="font-medium truncate">{u.name}</p>
                    <p className="text-xs text-ink/60 truncate">
                      {u.email} · {u.churches?.name ?? "Platform"}
                    </p>
                    <p className="text-xs text-ink/60">{roleLabel(u.role)}</p>
                  </div>
                  <MemberStatusBadge status={u.status as AccountStatus} />
                </Link>
              </li>
            ))}
          </ul>
          <Pagination page={page} hasMore={(page + 1) * PAGE_SIZE < total} hrefFor={(p) => buildQuery({ q, role, status, church, page: p })} summary={`Page ${page + 1} of ${Math.max(1, Math.ceil(total / PAGE_SIZE))}`} />
        </>
      )}
    </div>
  );
}
