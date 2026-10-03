import { getCurrentAppUser } from "@/lib/current-user";
import { can } from "@/lib/permissions";
import { PageHeader } from "@/components/ui/PageHeader";
import { PermissionDenied } from "@/components/ui/Gates";
import { NewDepartmentForm } from "../DepartmentForms";

export default async function NewDepartmentPage() {
  const me = await getCurrentAppUser();
  if (!me || !can(me.role, "manageDepartments")) {
    return <PermissionDenied message="Only church admins and pastors can create departments." backHref="/dashboard/departments" />;
  }
  return (
    <div>
      <PageHeader back={{ href: "/dashboard/departments", label: "Departments" }} title="Add department" />
      <NewDepartmentForm />
    </div>
  );
}
