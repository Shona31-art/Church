import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { checkModuleAccess } from "@/lib/paywall";
import { getCurrentAppUser } from "@/lib/current-user";

export default async function ServicePlanDetailPage({ params }: { params: { id: string } }) {
  const access = await checkModuleAccess("service_planner");
  if (!access.allowed) return <p className="text-red-600">{access.reason}</p>;

  const me = await getCurrentAppUser();
  const supabase = createClient();

  const { data: plan } = await supabase
    .from("service_plans")
    .select("*")
    .eq("id", params.id)
    .single();
  if (!plan) notFound();

  const { data: items } = await supabase
    .from("service_plan_items")
    .select("*, app_users(name)")
    .eq("service_plan_id", params.id)
    .order("order_index");

  const canManage = me && ["pastor", "church_admin"].includes(me.role);

  const { data: members } = canManage
    ? await supabase.from("app_users").select("id, name").eq("church_id", me!.church_id).order("name")
    : { data: [] };

  async function addItem(formData: FormData) {
    "use server";
    const me = await getCurrentAppUser();
    if (!me || !["pastor", "church_admin"].includes(me.role)) return;

    const itemTitle = String(formData.get("item_title") || "").trim();
    if (!itemTitle) return;

    const supabase = createClient();
    const { count } = await supabase
      .from("service_plan_items")
      .select("*", { count: "exact", head: true })
      .eq("service_plan_id", params.id);

    await supabase.from("service_plan_items").insert({
      service_plan_id: params.id,
      order_index: count ?? 0,
      item_title: itemTitle,
    });

    redirect(`/dashboard/service-planner/${params.id}`);
  }

  async function assignItem(formData: FormData) {
    "use server";
    const me = await getCurrentAppUser();
    if (!me || !["pastor", "church_admin"].includes(me.role)) return;

    const itemId = String(formData.get("item_id"));
    const assignedTo = String(formData.get("assigned_to") || "") || null;

    const supabase = createClient();
    await supabase.from("service_plan_items").update({ assigned_to: assignedTo }).eq("id", itemId);
  }

  async function togglePublish() {
    "use server";
    const me = await getCurrentAppUser();
    if (!me || !["pastor", "church_admin"].includes(me.role)) return;

    const supabase = createClient();
    await supabase
      .from("service_plans")
      .update({ status: plan!.status === "published" ? "draft" : "published" })
      .eq("id", params.id);

    redirect(`/dashboard/service-planner/${params.id}`);
  }

  return (
    <div className="max-w-xl">
      <div className="flex items-center justify-between mb-1">
        <h1 className="text-2xl font-semibold">{plan.title}</h1>
        {canManage && (
          <form action={togglePublish}>
            <button
              type="submit"
              className={`text-sm px-3 py-1.5 rounded-lg ${
                plan.status === "published"
                  ? "border border-ink/20"
                  : "bg-ember text-white"
              }`}
            >
              {plan.status === "published" ? "Unpublish" : "Publish"}
            </button>
          </form>
        )}
      </div>
      <p className="text-sm text-ink/50 mb-6">
        {new Date(plan.service_date).toLocaleDateString(undefined, {
          weekday: "long",
          month: "long",
          day: "numeric",
        })}
        {" · "}
        <span className={plan.status === "published" ? "text-green-700" : "text-ink/40"}>
          {plan.status}
        </span>
      </p>

      <div className="space-y-2 mb-6">
        {items?.map((item: any, i: number) => (
          <div key={item.id} className="flex items-center justify-between border border-ink/10 rounded-lg px-4 py-3 bg-white/60">
            <div>
              <p className="font-medium">
                {i + 1}. {item.item_title}
              </p>
              {item.app_users?.name && (
                <p className="text-xs text-ember">Assigned: {item.app_users.name}</p>
              )}
            </div>
            {canManage && (
              <form action={assignItem} className="flex items-center gap-2">
                <input type="hidden" name="item_id" value={item.id} />
                <select
                  name="assigned_to"
                  defaultValue={item.assigned_to ?? ""}
                  className="text-sm border border-ink/20 rounded px-2 py-1"
                >
                  <option value="">Unassigned</option>
                  {members?.map((m: any) => (
                    <option key={m.id} value={m.id}>
                      {m.name}
                    </option>
                  ))}
                </select>
                <button type="submit" className="text-xs text-ember">
                  Save
                </button>
              </form>
            )}
          </div>
        ))}
        {!items?.length && <p className="text-ink/40 text-sm">No items yet.</p>}
      </div>

      {canManage && (
        <form action={addItem} className="flex gap-2">
          <input
            name="item_title"
            placeholder="Add an item, e.g. 'Baby Dedication'"
            className="flex-1 border border-ink/20 rounded-lg px-4 py-2 text-sm"
          />
          <button type="submit" className="bg-ink/5 px-4 py-2 rounded-lg text-sm">
            Add
          </button>
        </form>
      )}
    </div>
  );
}
