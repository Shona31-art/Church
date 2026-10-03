import { notFound } from "next/navigation";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { getCurrentAppUser } from "@/lib/current-user";
import { moduleGate } from "@/lib/gate";
import { assignableRoles, can, canEditMemberRole, type ChurchRole } from "@/lib/permissions";
import { PageHeader } from "@/components/ui/PageHeader";
import { PermissionDenied } from "@/components/ui/Gates";
import { MemberForm } from "../../MemberForm";

export default async function EditMemberPage({ params }: { params: { id: string } }) {
  const gate = await moduleGate("members");
  if (gate) return gate;

  const me = await getCurrentAppUser();
  if (!me || !can(me.role, "manageMembers")) {
    return <PermissionDenied message="Only pastors and church admins can edit members." backHref="/dashboard/members" />;
  }
  if (!z.string().uuid().safeParse(params.id).success) notFound();

  const supabase = createClient();
  const [{ data: member }, { data: departments }, { data: birthday }] = await Promise.all([
    supabase
      .from("app_users")
      .select("id, name, email, phone, role, status, department_id, updated_at")
      .eq("id", params.id)
      .eq("church_id", me.church_id)
      .maybeSingle(),
    supabase.from("departments").select("id, name").eq("church_id", me.church_id).order("name"),
    supabase.from("member_birthdays").select("birth_date").eq("user_id", params.id).maybeSingle(),
  ]);
  if (!member) notFound();

  if (member.role === "church_admin" && me.role !== "church_admin") {
    return <PermissionDenied message="Only a church admin can edit another church admin." backHref={`/dashboard/members/${member.id}`} />;
  }

  const roleLocked =
    member.id === me.id
      ? "You can't change your own role or department — ask another church admin."
      : !canEditMemberRole(me, member)
      ? "Only a church admin can change this."
      : undefined;

  return (
    <div>
      <PageHeader back={{ href: `/dashboard/members/${member.id}`, label: member.name }} title={`Edit ${member.name}`} />
      <MemberForm
        mode="edit"
        departments={departments ?? []}
        roles={assignableRoles(me.role)}
        roleLocked={roleLocked}
        member={{
          id: member.id,
          updated_at: member.updated_at,
          name: member.name,
          email: member.email,
          phone: member.phone,
          role: member.role as ChurchRole,
          department_id: member.department_id,
          birth_date: birthday?.birth_date ?? "",
        }}
      />
    </div>
  );
}
