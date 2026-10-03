import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { checkModuleAccess } from "@/lib/paywall";
import { getCurrentAppUser } from "@/lib/current-user";
import { AddItemForm, AssignForm, PublishButton, RemoveItemButton } from "../PlanForms";

export default async function ServicePlanDetailPage({
  params,
  searchParams,
}: {
  params: { id: string };
  searchParams: { template?: string };
}) {
  const access = await checkModuleAccess("service_planner");
  if (!access.allowed) return <p className="text-red-600">{access.reason}</p>;

  const me = await getCurrentAppUser();
  const supabase = createClient();

  const { data: plan } = await supabase.from("service_plans").select("*").eq("id", params.id).single();
  if (!plan) notFound();

  const { data: items, error: itemsError } = await supabase
    .from("service_plan_items")
    .select("*, app_users(name)")
    .eq("service_plan_id", params.id)
    .order("order_index");
  if (itemsError) console.error("[service-planner] items load failed:", itemsError.message);

  const canManage = Boolean(me && ["pastor", "church_admin"].includes(me.role));
  const { data: members } = canManage
    ? await supabase.from("app_users").select("id, name").eq("church_id", me!.church_id).order("name")
    : { data: [] };

  return (
    <div className="max-w-xl">
      <Link href="/dashboard/service-planner" className="text-sm text-ink/50 hover:text-ink">← Service planner</Link>
      <div className="flex items-start justify-between gap-4 mt-2 mb-1">
        <h1 className="text-2xl font-semibold">{plan.title}</h1>
        {canManage && <PublishButton planId={plan.id} status={plan.status} />}
      </div>
      <p className="text-sm text-ink/50 mb-6">
        {new Date(plan.service_date).toLocaleDateString(undefined, { weekday: "long", month: "long", day: "numeric" })}
        {" · "}
        <span className={plan.status === "published" ? "text-green-700" : "text-ink/40"}>
          {plan.status === "published" ? "Published — visible to the church" : "Draft — only pastors and admins can see it"}
        </span>
      </p>

      {searchParams.template === "failed" && (
        <p role="alert" className="text-sm text-amber-800 bg-amber-50 border border-amber-300 rounded-lg p-3 mb-4">
          ⚠ The plan was created, but the standard running order couldn't be added. Add the items below.
        </p>
      )}

      <div className="space-y-2 mb-6">
        {items?.map((item: any, i: number) => (
          <div key={item.id} className="flex flex-wrap items-center justify-between gap-2 border border-ink/10 rounded-lg px-4 py-3 bg-white/60">
            <div>
              <p className="font-medium">
                {i + 1}. {item.item_title}
              </p>
              {item.app_users?.name && <p className="text-xs text-ember">Assigned: {item.app_users.name}</p>}
            </div>
            {canManage && (
              <div className="flex items-center gap-3">
                <AssignForm planId={plan.id} itemId={item.id} itemTitle={item.item_title} assignedTo={item.assigned_to} members={members ?? []} />
                <RemoveItemButton planId={plan.id} itemId={item.id} itemTitle={item.item_title} />
              </div>
            )}
          </div>
        ))}
        {itemsError && <p role="alert" className="text-sm text-red-700">⚠ Couldn't load the running order — refresh the page to try again.</p>}
        {!itemsError && !items?.length && (
          <p className="text-ink/40 text-sm">{canManage ? "No items yet — add the first one below." : "The running order hasn't been filled in yet."}</p>
        )}
      </div>

      {canManage && <AddItemForm planId={plan.id} />}
    </div>
  );
}
