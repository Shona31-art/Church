import { getCurrentAppUser } from "@/lib/current-user";
import { moduleGate } from "@/lib/gate";
import { can } from "@/lib/permissions";
import { todayInAppZone } from "@/lib/format";
import { PageHeader } from "@/components/ui/PageHeader";
import { PermissionDenied } from "@/components/ui/Gates";
import { NewPlanForm } from "../PlanForms";

export default async function NewServicePlanPage() {
  const gate = await moduleGate("service_planner");
  if (gate) return gate;

  const me = await getCurrentAppUser();
  if (!me || !can(me.role, "planServices")) {
    return <PermissionDenied message="Only pastors and church admins can plan services." backHref="/dashboard/service-planner" />;
  }
  return (
    <div>
      <PageHeader back={{ href: "/dashboard/service-planner", label: "Service Planner" }} title="New service plan" />
      <NewPlanForm today={todayInAppZone()} />
    </div>
  );
}
