import { getCurrentAppUser } from "@/lib/current-user";
import { PageHeader } from "@/components/ui/PageHeader";
import { PermissionDenied } from "@/components/ui/Gates";
import { AddChurchForm } from "../../SuperAdminForms";

export default async function NewChurchPage() {
  const me = await getCurrentAppUser();
  if (!me || me.role !== "super_admin") return <PermissionDenied message="This area is for platform administrators only." />;
  return (
    <div>
      <PageHeader
        back={{ href: "/dashboard/super-admin/churches", label: "Churches" }}
        title="Add church"
        description="Creates the church with a 30-day free trial and its first church admin login."
      />
      <AddChurchForm />
    </div>
  );
}
