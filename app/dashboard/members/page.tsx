import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { getCurrentAppUser } from "@/lib/current-user";
import { moduleGate } from "@/lib/gate";
import { CHURCH_ROLES, ROLE_LABELS, can, roleLabel, type AccountStatus } from "@/lib/permissions";
import { PAGE_SIZE, buildQuery, orFilterPattern, pageFrom } from "@/lib/list";
import { PageHeader } from "@/components/ui/PageHeader";
import { FilterBar, FilterSelect } from "@/components/ui/FilterBar";
import { Pagination } from "@/components/ui/Pagination";
import { EmptyState } from "@/components/ui/EmptyState";
import { Alert } from "@/components/ui/Alert";
import { PermissionDenied } from "@/components/ui/Gates";
import { MemberStatusBadge } from "./MemberBadges";
import { NAV_ICONS } from "@/components/ui/NavIcon";
import { Avatar } from "@/components/ui/Avatar";
import { getAvatarUrls } from "@/lib/avatars";

type Search = { q?: string; role?: string; status?: string; department?: string; page?: string };

export default async function MembersPage({ searchParams }: { searchParams: Search }) {
  const gate = await moduleGate("members");
  if (gate) return gate;

  const me = await getCurrentAppUser();
  if (!me || !can(me.role, "viewMembers")) {
    return <PermissionDenied message="The member directory is only available to pastors and church admins." />;
  }

  const supabase = createClient();
  const page = pageFrom(searchParams.page);
  const q = (searchParams.q ?? "").trim().slice(0, 80);
  const role = (CHURCH_ROLES as readonly string[]).includes(searchParams.role ?? "") ? searchParams.role : undefined;
  // Default view hides deactivated people; pick "Deactivated" to see them.
  const status = ["active", "invited", "disabled", "all"].includes(searchParams.status ?? "") ? searchParams.status : undefined;
  const department = /^[0-9a-f-]{36}$/i.test(searchParams.department ?? "") ? searchParams.department : undefined;

  let query = supabase
    .from("app_users")
    .select("id, name, email, phone, role, status, department_id, departments(name)", { count: "exact" })
    .eq("church_id", me.church_id)
    .order("name")
    .range(page * PAGE_SIZE, page * PAGE_SIZE + PAGE_SIZE - 1);
  if (q) query = query.or(`name.ilike.${orFilterPattern(q)},email.ilike.${orFilterPattern(q)}`);
  if (role) query = query.eq("role", role);
  if (status && status !== "all") query = query.eq("status", status);
  if (!status) query = query.neq("status", "disabled");
  if (department) query = query.eq("department_id", department);

  const [{ data: members, count, error }, { data: departments }] = await Promise.all([
    query,
    supabase.from("departments").select("id, name").eq("church_id", me.church_id).order("name"),
  ]);
  if (error) console.error("[members] list failed:", error.message);
  const photos = await getAvatarUrls((members ?? []).map((m: any) => m.id));

  const total = count ?? 0;
  const filtered = Boolean(q || role || status || department);
  const href = (p: number) => buildQuery({ q, role, status, department, page: p });
  const from = total === 0 ? 0 : page * PAGE_SIZE + 1;
  const to = Math.min(total, (page + 1) * PAGE_SIZE);

  return (
    <div className="max-w-5xl">
      <PageHeader
        back={{ href: "/dashboard", label: "Home" }}
        title="Members"
        description="Everyone in your church directory. Each member has a login so they can use the app; deactivating someone keeps their records but removes their access."
        actions={
          <Link href="/dashboard/members/new" className="btn-primary">
            Add member
          </Link>
        }
      />

      <FilterBar query={q} placeholder="Search by name or email…" label="Search members" resetHref="/dashboard/members" active={filtered}>
        <FilterSelect
          name="role"
          label="Role"
          value={role}
          allLabel="All roles"
          options={CHURCH_ROLES.map((r) => ({ value: r, label: ROLE_LABELS[r] }))}
        />
        <FilterSelect
          name="status"
          label="Account status"
          value={status}
          allLabel="Current members"
          options={[
            { value: "active", label: "Active" },
            { value: "invited", label: "Invite sent" },
            { value: "disabled", label: "Deactivated" },
            { value: "all", label: "Everyone" },
          ]}
        />
        {(departments?.length ?? 0) > 0 && (
          <FilterSelect
            name="department"
            label="Department"
            value={department}
            allLabel="All departments"
            options={(departments ?? []).map((d) => ({ value: d.id, label: d.name }))}
          />
        )}
      </FilterBar>

      {error ? (
        <Alert tone="error" title="Couldn't load members">
          Refresh the page to try again. If it keeps happening, contact support.
        </Alert>
      ) : !members?.length ? (
        filtered ? (
          <EmptyState title="No members match those filters" description="Try a different name, or clear the filters." action={<Link href="/dashboard/members" className="btn-secondary">Clear filters</Link>} />
        ) : (
          <EmptyState
            icon={NAV_ICONS.members}
            title="No members yet"
            description="Add your first church member to start building your directory. They'll get an email to set up their login."
            action={<Link href="/dashboard/members/new" className="btn-primary">Add member</Link>}
          />
        )
      ) : (
        <>
          <p className="text-xs text-ink/60 mb-2" aria-live="polite">
            Showing {from}–{to} of {total} {total === 1 ? "person" : "people"}
          </p>

          {/* Desktop: table. Mobile: cards (below) so nothing scrolls sideways. */}
          <div className="hidden md:block card-elevated rounded-2xl overflow-hidden">
            <table className="w-full text-sm">
              <caption className="sr-only">Church members</caption>
              <thead className="bg-ink/[0.03] text-left text-xs uppercase tracking-wide text-ink/60">
                <tr>
                  <th scope="col" className="px-4 py-3 font-semibold">Name</th>
                  <th scope="col" className="px-4 py-3 font-semibold">Role</th>
                  <th scope="col" className="px-4 py-3 font-semibold">Department</th>
                  <th scope="col" className="px-4 py-3 font-semibold">Account</th>
                  <th scope="col" className="px-4 py-3"><span className="sr-only">Actions</span></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {members.map((m: any) => (
                  <tr key={m.id} className="hover:bg-ink/[0.02]">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        <Avatar name={m.name} src={photos.get(m.id)} />
                        <div className="min-w-0">
                          <Link href={`/dashboard/members/${m.id}`} className="font-medium hover:underline">
                            {m.name}
                          </Link>
                          <p className="text-xs text-ink/60">{m.email}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3">{roleLabel(m.role)}</td>
                    <td className="px-4 py-3">{m.departments?.name ?? <span className="text-ink/60">—</span>}</td>
                    <td className="px-4 py-3">
                      <MemberStatusBadge status={m.status as AccountStatus} />
                    </td>
                    <td className="px-4 py-3 text-right">
                      <Link href={`/dashboard/members/${m.id}`} className="btn-ghost btn-sm">
                        View<span className="sr-only"> {m.name}</span>
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <ul className="md:hidden space-y-2">
            {members.map((m: any) => (
              <li key={m.id}>
                <Link href={`/dashboard/members/${m.id}`} className="card-elevated rounded-2xl p-4 flex items-start justify-between gap-3">
                  <Avatar name={m.name} src={photos.get(m.id)} />
                  <div className="min-w-0 flex-1">
                    <p className="font-medium truncate">{m.name}</p>
                    <p className="text-xs text-ink/60 truncate">{m.email}</p>
                    <p className="text-xs text-ink/60 mt-1">
                      {roleLabel(m.role)}
                      {m.departments?.name ? ` · ${m.departments.name}` : ""}
                    </p>
                  </div>
                  <MemberStatusBadge status={m.status as AccountStatus} />
                </Link>
              </li>
            ))}
          </ul>

          <Pagination page={page} hasMore={to < total} hrefFor={href} summary={`Page ${page + 1} of ${Math.max(1, Math.ceil(total / PAGE_SIZE))}`} />
        </>
      )}
    </div>
  );
}
