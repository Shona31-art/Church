import { createClient } from "@/lib/supabase/server";
import { getCurrentAppUser } from "@/lib/current-user";
import { moduleGate } from "@/lib/gate";
import { assignableRoles, can } from "@/lib/permissions";
import { PageHeader } from "@/components/ui/PageHeader";
import { PermissionDenied } from "@/components/ui/Gates";
import { MemberForm } from "../MemberForm";

export default async function NewMemberPage() {
  const gate = await moduleGate("members");
  if (gate) return gate;

  const me = await getCurrentAppUser();
  if (!me || !can(me.role, "manageMembers")) {
    return <PermissionDenied message="Only pastors and church admins can add members." backHref="/dashboard/members" />;
  }

  const { data: departments } = await createClient().from("departments").select("id, name").eq("church_id", me.church_id).order("name");

  return (
    <div>
      <PageHeader
        back={{ href: "/dashboard/members", label: "Members" }}
        title="Add member"
        description="Creates their member record and login with the password you choose. No email is sent."
      />
      <MemberForm mode="create" departments={departments ?? []} roles={assignableRoles(me.role)} />
    </div>
  );
}
