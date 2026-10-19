import { notFound } from "next/navigation";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { getCurrentAppUser } from "@/lib/current-user";
import { moduleGate } from "@/lib/gate";
import { can } from "@/lib/permissions";
import { formatDate } from "@/lib/format";
import { PageHeader, Section } from "@/components/ui/PageHeader";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { Alert } from "@/components/ui/Alert";
import { AddItemForm, AssignForm, DeletePlanButton, EditPlanForm, MoveButtons, PublishButton, RemoveItemButton } from "../PlanForms";

export default async function ServicePlanDetailPage({ params, searchParams }: { params: { id: string }; searchParams: { template?: string } }) {
  const gate = await moduleGate("service_planner");
  if (gate) return gate;
  if (!z.string().uuid().safeParse(params.id).success) notFound();

  const me = (await getCurrentAppUser())!;
  const supabase = createClient();
  const canManage = can(me.role, "planServices");

  const [{ data: plan }, { data: items, error: itemsError }, { data: members }] = await Promise.all([
    supabase.from("service_plans").select("*").eq("id", params.id).eq("church_id", me.church_id).maybeSingle(),
    supabase.from("service_plan_items").select("*, app_users(name)").eq("service_plan_id", params.id).order("order_index").order("created_at"),
    canManage
      ? supabase.from("app_users").select("id, name").eq("church_id", me.church_id).neq("status", "disabled").order("name").limit(1000)
      : Promise.resolve({ data: [] as { id: string; name: string }[] }),
  ]);
  if (!plan) notFound();
  if (itemsError) console.error("[service-planner] items load failed:", itemsError.message);

  const list: any[] = items ?? [];

  return (
    <div className="max-w-3xl space-y-6">
      <PageHeader
        back={{ href: "/dashboard/service-planner", label: "Service Planner" }}
        title={plan.title}
        description={formatDate(plan.service_date, { weekday: "long", month: "long" })}
        meta={
          plan.status === "published" ? (
            <StatusBadge tone="success">Published — visible to the church</StatusBadge>
          ) : (
            <StatusBadge tone="warning">Draft — pastors and admins only</StatusBadge>
          )
        }
        actions={canManage ? <PublishButton planId={plan.id} status={plan.status} /> : null}
      />

      {searchParams.template === "failed" && (
        <Alert tone="warning">The plan was created, but the standard running order couldn&apos;t be added. Add the items below.</Alert>
      )}

      <Section title="Running order">
        {itemsError ? (
          <Alert tone="error">Couldn&apos;t load the running order — refresh the page to try again.</Alert>
        ) : list.length === 0 ? (
          <p className="text-sm text-ink/60">{canManage ? "No items yet — add the first one below." : "The running order hasn't been filled in yet."}</p>
        ) : (
          <ol className="divide-y divide-line">
            {list.map((item, i) => (
              <li key={item.id} className="py-3 flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-3 min-w-0">
                  <span className="w-6 text-right text-sm tabular-nums text-ink/60" aria-hidden>
                    {i + 1}.
                  </span>
                  <div className="min-w-0">
                    <p className="font-medium">{item.item_title}</p>
                    {!canManage && <p className="text-xs text-ink/60">{item.app_users?.name ? `Led by ${item.app_users.name}` : "Not assigned yet"}</p>}
                  </div>
                </div>
                {canManage && (
                  <div className="flex flex-wrap items-center gap-2">
                    <AssignForm planId={plan.id} itemId={item.id} itemTitle={item.item_title} assignedTo={item.assigned_to} members={members ?? []} />
                    <MoveButtons planId={plan.id} itemId={item.id} itemTitle={item.item_title} isFirst={i === 0} isLast={i === list.length - 1} />
                    <RemoveItemButton planId={plan.id} itemId={item.id} itemTitle={item.item_title} />
                  </div>
                )}
              </li>
            ))}
          </ol>
        )}
        {canManage && (
          <div className="mt-5 border-t border-line pt-5">
            <AddItemForm planId={plan.id} />
          </div>
        )}
      </Section>

      {canManage && (
        <>
          <Section title="Service details">
            <EditPlanForm planId={plan.id} title={plan.title} serviceDate={plan.service_date} />
          </Section>
          <Section title="Delete plan">
            <DeletePlanButton planId={plan.id} title={plan.title} itemCount={list.length} />
          </Section>
        </>
      )}
    </div>
  );
}
