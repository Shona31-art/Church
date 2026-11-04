import Link from "next/link";
import { notFound } from "next/navigation";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { getCurrentAppUser } from "@/lib/current-user";
import { can, roleLabel } from "@/lib/permissions";
import { PageHeader, Section } from "@/components/ui/PageHeader";
import { PermissionDenied } from "@/components/ui/Gates";
import { DeleteDepartmentButton, RenameDepartmentForm } from "../DepartmentForms";
import { DepartmentPeople, type DeptPerson } from "./DepartmentPeople";
import { getAvatarUrls } from "@/lib/avatars";
import { OnDutyList } from "@/components/rosters/OnDutyList";
import { todayInAppZone } from "@/lib/format";

export default async function DepartmentDetailPage({ params }: { params: { id: string } }) {
  const me = await getCurrentAppUser();
  if (!me || !can(me.role, "manageDepartments")) {
    return <PermissionDenied message="Departments are managed by pastors and church admins." />;
  }
  if (!z.string().uuid().safeParse(params.id).success) notFound();

  const supabase = createClient();
  const [{ data: department }, { data: everyone }, { count: announcementCount }, { count: eventCount }, { data: channel }] = await Promise.all([
    supabase.from("departments").select("id, name, created_at").eq("id", params.id).eq("church_id", me.church_id).maybeSingle(),
    supabase
      .from("app_users")
      .select("id, name, role, status, department_id, departments(name)")
      .eq("church_id", me.church_id)
      .neq("status", "disabled")
      .neq("role", "super_admin")
      .order("name")
      .limit(1000),
    supabase.from("announcements").select("id", { count: "exact", head: true }).eq("department_id", params.id),
    supabase.from("events").select("id", { count: "exact", head: true }).eq("department_id", params.id),
    supabase.from("chat_channels").select("id").eq("department_id", params.id).eq("is_dm", false).maybeSingle(),
  ]);
  if (!department) notFound();

  const members = (everyone ?? []).filter((m) => m.department_id === department.id);
  const photos = await getAvatarUrls((everyone ?? []).map((m) => m.id));
  const toPerson = (m: NonNullable<typeof everyone>[number]): DeptPerson => ({
    id: m.id,
    name: m.name,
    role: m.role,
    roleLabel: roleLabel(m.role),
    photoUrl: photos.get(m.id) ?? null,
    currentDepartment: m.department_id && m.department_id !== department.id ? ((m.departments as unknown as { name: string } | null)?.name ?? "another department") : null,
  });

  const leaders = (members ?? []).filter((m) => m.role === "department_leader");

  return (
    <div className="max-w-3xl space-y-6">
      <PageHeader
        back={{ href: "/dashboard/departments", label: "Departments" }}
        title={department.name}
        description={
          leaders.length
            ? `Led by ${leaders.map((l) => l.name).join(", ")}.`
            : "No department leader yet — tap “Make leader” next to someone below."
        }
        actions={
          channel ? (
            <Link href={`/dashboard/chat/${channel.id}`} className="btn-secondary">
              Open chat
            </Link>
          ) : null
        }
      />

      <Section title={`Members (${members.length})`}>
        <DepartmentPeople
          departmentId={department.id}
          departmentName={department.name}
          members={members.map(toPerson)}
          others={(everyone ?? []).filter((m) => m.department_id !== department.id).map(toPerson)}
          meId={me.id}
          canManage={can(me.role, "manageMembers")}
        />
      </Section>

      {members.length > 0 && (
        <OnDutySection churchId={me.church_id!} userIds={members.map((m) => m.id)} />
      )}

      <Section title="Settings">
        <RenameDepartmentForm id={department.id} name={department.name} />
      </Section>

      {can(me.role, "deleteDepartments") && (
        <Section title="Delete department" description="Only church admins can delete a department.">
          <DeleteDepartmentButton
            id={department.id}
            name={department.name}
            memberCount={members.length}
            announcementCount={announcementCount ?? 0}
            eventCount={eventCount ?? 0}
          />
        </Section>
      )}
    </div>
  );
}

/** The department's people on the rosters over the next four weeks (nothing when there are none). */
async function OnDutySection({ churchId, userIds }: { churchId: string; userIds: string[] }) {
  const today = todayInAppZone();
  const to = new Date(Date.parse(`${today}T12:00:00Z`) + 27 * 86_400_000).toISOString().slice(0, 10);
  const list = await OnDutyList({ churchId, from: today, to, userIds });
  if (!list) return null;
  return (
    <Section title="On duty soon" description="This department's people on the volunteer rosters in the next four weeks.">
      {list}
    </Section>
  );
}
