import Link from "next/link";
import { notFound } from "next/navigation";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { getCurrentAppUser } from "@/lib/current-user";
import { can, roleLabel } from "@/lib/permissions";
import { PageHeader, Section } from "@/components/ui/PageHeader";
import { PermissionDenied } from "@/components/ui/Gates";
import { DeleteDepartmentButton, RenameDepartmentForm } from "../DepartmentForms";

export default async function DepartmentDetailPage({ params }: { params: { id: string } }) {
  const me = await getCurrentAppUser();
  if (!me || !can(me.role, "manageDepartments")) {
    return <PermissionDenied message="Departments are managed by pastors and church admins." />;
  }
  if (!z.string().uuid().safeParse(params.id).success) notFound();

  const supabase = createClient();
  const [{ data: department }, { data: members }, { count: announcementCount }, { count: eventCount }, { data: channel }] = await Promise.all([
    supabase.from("departments").select("id, name, created_at").eq("id", params.id).eq("church_id", me.church_id).maybeSingle(),
    supabase
      .from("app_users")
      .select("id, name, role, status")
      .eq("church_id", me.church_id)
      .eq("department_id", params.id)
      .neq("status", "disabled")
      .order("name")
      .limit(200),
    supabase.from("announcements").select("id", { count: "exact", head: true }).eq("department_id", params.id),
    supabase.from("events").select("id", { count: "exact", head: true }).eq("department_id", params.id),
    supabase.from("chat_channels").select("id").eq("department_id", params.id).eq("is_dm", false).maybeSingle(),
  ]);
  if (!department) notFound();

  const leaders = (members ?? []).filter((m) => m.role === "department_leader");

  return (
    <div className="max-w-3xl space-y-6">
      <PageHeader
        back={{ href: "/dashboard/departments", label: "Departments" }}
        title={department.name}
        description={
          leaders.length
            ? `Led by ${leaders.map((l) => l.name).join(", ")}.`
            : "No department leader yet — edit a member and set their role to Department leader."
        }
        actions={
          channel ? (
            <Link href={`/dashboard/chat/${channel.id}`} className="btn-secondary">
              Open chat
            </Link>
          ) : null
        }
      />

      <Section
        title={`Members (${members?.length ?? 0})`}
        description="To add someone, open their member profile and choose this department."
        actions={
          <Link href={`/dashboard/members?department=${department.id}`} className="btn-ghost btn-sm">
            View in directory
          </Link>
        }
      >
        {members?.length ? (
          <ul className="divide-y divide-line">
            {members.map((m) => (
              <li key={m.id} className="py-2 flex items-center justify-between gap-3">
                <Link href={`/dashboard/members/${m.id}`} className="text-sm font-medium hover:underline">
                  {m.name}
                </Link>
                <span className="text-xs text-ink/60">{roleLabel(m.role)}</span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-ink/60">Nobody is in this department yet.</p>
        )}
      </Section>

      <Section title="Settings">
        <RenameDepartmentForm id={department.id} name={department.name} />
      </Section>

      {can(me.role, "deleteDepartments") && (
        <Section title="Delete department" description="Only church admins can delete a department.">
          <DeleteDepartmentButton
            id={department.id}
            name={department.name}
            memberCount={members?.length ?? 0}
            announcementCount={announcementCount ?? 0}
            eventCount={eventCount ?? 0}
          />
        </Section>
      )}
    </div>
  );
}
