import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { checkModuleAccess } from "@/lib/paywall";
import { getCurrentAppUser } from "@/lib/current-user";

const DEFAULT_ITEMS = [
  "Worship",
  "Opening Prayer",
  "Offering",
  "7-Minute Word",
  "Sermon",
  "Announcements",
  "Closing Prayer",
];

export default async function NewServicePlanPage() {
  const access = await checkModuleAccess("service_planner");
  if (!access.allowed) return <p className="text-red-600">{access.reason}</p>;

  const me = await getCurrentAppUser();
  if (!me || !["pastor", "church_admin"].includes(me.role)) {
    return <p className="text-ink/60">Only pastors and church admins can plan services.</p>;
  }

  async function createPlan(formData: FormData) {
    "use server";
    const me = await getCurrentAppUser();
    if (!me || !["pastor", "church_admin"].includes(me.role)) return;

    const title = String(formData.get("title") || "").trim();
    const serviceDate = String(formData.get("service_date") || "");
    const useTemplate = formData.get("use_template") === "on";

    if (!title || !serviceDate) return;

    const supabase = createClient();
    const { data: plan } = await supabase
      .from("service_plans")
      .insert({ church_id: me.church_id, created_by: me.id, title, service_date: serviceDate })
      .select("id")
      .single();

    if (plan && useTemplate) {
      await supabase.from("service_plan_items").insert(
        DEFAULT_ITEMS.map((item_title, i) => ({
          service_plan_id: plan.id,
          order_index: i,
          item_title,
        }))
      );
    }

    if (plan) redirect(`/dashboard/service-planner/${plan.id}`);
  }

  return (
    <form action={createPlan} className="max-w-md space-y-4">
      <h1 className="text-2xl font-semibold mb-4">New service</h1>

      <input
        name="title"
        placeholder="e.g. Sunday Service"
        required
        defaultValue="Sunday Service"
        className="w-full border border-ink/20 rounded-lg px-4 py-3"
      />
      <input
        type="date"
        name="service_date"
        required
        className="w-full border border-ink/20 rounded-lg px-4 py-3"
      />

      <label className="flex items-center gap-2 text-sm">
        <input type="checkbox" name="use_template" defaultChecked />
        Start with the standard running order (Worship → Prayer → Offering →
        Sermon → Announcements → Closing)
      </label>

      <button type="submit" className="bg-ember text-white px-6 py-3 rounded-lg font-medium">
        Create service plan
      </button>
    </form>
  );
}
