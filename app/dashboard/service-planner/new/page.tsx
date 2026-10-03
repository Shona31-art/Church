import Link from "next/link";
import { checkModuleAccess } from "@/lib/paywall";
import { getCurrentAppUser } from "@/lib/current-user";
import { NewPlanForm } from "../PlanForms";

export default async function NewServicePlanPage() {
  const access = await checkModuleAccess("service_planner");
  if (!access.allowed) return <p className="text-red-600">{access.reason}</p>;

  const me = await getCurrentAppUser();
  if (!me || !["pastor", "church_admin"].includes(me.role)) {
    return <p className="text-ink/60">Only pastors and church admins can plan services.</p>;
  }

  return (
    <div>
      <Link href="/dashboard/service-planner" className="text-sm text-ink/50 hover:text-ink">← Service planner</Link>
      <h1 className="text-2xl font-semibold mt-2 mb-4">New service</h1>
      <NewPlanForm />
    </div>
  );
}
