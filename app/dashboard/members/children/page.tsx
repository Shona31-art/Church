import { moduleGate } from "@/lib/gate";
import { getCurrentAppUser } from "@/lib/current-user";
import { can } from "@/lib/permissions";
import { PageHeader } from "@/components/ui/PageHeader";
import { PermissionDenied } from "@/components/ui/Gates";
import { Alert } from "@/components/ui/Alert";
import { MembersTabs } from "@/components/members/MembersTabs";
import { churchPeople, loadChurchChildren } from "@/lib/children";
import { ChildrenDirectory } from "./ChildrenDirectory";

/**
 * Members → Children: every child in the church with their birthday (day and
 * month only) and their mother and father. Pastors and church admins only.
 */
export default async function ChildrenPage() {
  const gate = await moduleGate("members");
  if (gate) return gate;
  const me = await getCurrentAppUser();
  if (!me?.church_id || !can(me.role, "viewMembers")) return <PermissionDenied message="The children list is only available to pastors and church admins." />;

  const [children, people] = await Promise.all([loadChurchChildren(), churchPeople(me.church_id)]);
  return (
    <div className="max-w-5xl">
      <PageHeader
        back={{ href: "/dashboard", label: "Home" }}
        title="Children"
        description="The church's children, with their parents and birthdays (day and month only — never their age). Parents can add and update their own children from My account."
      />
      <MembersTabs active="children" />
      {children === null ? (
        <Alert tone="info" title="One step left">Children need a database update first: run supabase/member_children.sql.</Alert>
      ) : (
        <ChildrenDirectory items={children} people={people} canEdit={can(me.role, "manageMembers")} />
      )}
    </div>
  );
}
