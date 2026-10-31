import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { getCurrentAppUser } from "@/lib/current-user";
import { can } from "@/lib/permissions";
import { PageHeader } from "@/components/ui/PageHeader";
import { EmptyState } from "@/components/ui/EmptyState";
import { Alert } from "@/components/ui/Alert";
import { PermissionDenied } from "@/components/ui/Gates";
import { NAV_ICONS } from "@/components/ui/NavIcon";

export default async function DepartmentsPage() {
  const me = await getCurrentAppUser();
  if (!me || !can(me.role, "manageDepartments")) {
    return <PermissionDenied message="Departments are managed by pastors and church admins." />;
  }

  const { data: departments, error } = await createClient()
    .from("departments")
    .select("id, name, app_users(count)")
    .eq("church_id", me.church_id)
    .order("name");
  if (error) console.error("[departments] list failed:", error.message);

  const addButton = (
    <Link href="/dashboard/departments/new" className="btn-primary">
      Add department
    </Link>
  );

  return (
    <div className="max-w-3xl">
      <PageHeader
        back={{ href: "/dashboard", label: "Home" }}
        title="Departments"
        description="Ministry teams like Worship, Youth or Ushers. Members can belong to one department; each department gets its own chat, announcements and events."
        actions={addButton}
      />

      {error ? (
        <Alert tone="error" title="Couldn't load departments">Refresh the page to try again.</Alert>
      ) : !departments?.length ? (
        <EmptyState
          icon={NAV_ICONS.departments}
          title="No departments yet"
          description="Create your first department — for example Worship, Youth, Media or Ushers — then assign members to it."
          action={addButton}
        />
      ) : (
        <ul className="grid gap-3 sm:grid-cols-2">
          {departments.map((d: any) => {
            const count = d.app_users?.[0]?.count ?? 0;
            return (
              <li key={d.id}>
                <Link href={`/dashboard/departments/${d.id}`} className="card-interactive rounded-xl p-4 flex items-center justify-between gap-3">
                  <div>
                    <p className="font-semibold">{d.name}</p>
                    <p className="text-xs text-ink/60">
                      {count} {count === 1 ? "member" : "members"}
                    </p>
                  </div>
                  <span aria-hidden className="text-ink/60">→</span>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
