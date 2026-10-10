import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { getCurrentAppUser } from "@/lib/current-user";
import { moduleGate } from "@/lib/gate";
import { can } from "@/lib/permissions";
import { formatDate, todayInAppZone } from "@/lib/format";
import { PAGE_SIZE, buildQuery, pageFrom } from "@/lib/list";
import { PageHeader } from "@/components/ui/PageHeader";
import { Pagination } from "@/components/ui/Pagination";
import { EmptyState } from "@/components/ui/EmptyState";
import { Alert } from "@/components/ui/Alert";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { NAV_ICONS } from "@/components/ui/NavIcon";

export default async function ServicePlannerPage({ searchParams }: { searchParams: { when?: string; page?: string } }) {
  const gate = await moduleGate("service_planner");
  if (gate) return gate;

  const me = (await getCurrentAppUser())!;
  const past = searchParams.when === "past";
  const page = pageFrom(searchParams.page);
  const today = todayInAppZone();

  let query = createClient()
    .from("service_plans")
    .select("id, title, service_date, status, service_plan_items(count)")
    .eq("church_id", me.church_id)
    .order("service_date", { ascending: !past })
    .range(page * PAGE_SIZE, page * PAGE_SIZE + PAGE_SIZE);
  query = past ? query.lt("service_date", today) : query.gte("service_date", today);
  const { data, error } = await query;
  if (error) console.error("[service-planner] list failed:", error.message);

  const plans: any[] = (data ?? []).slice(0, PAGE_SIZE);
  const canManage = can(me.role, "planServices");
  const newButton = canManage ? (
    <Link href="/dashboard/service-planner/new" className="btn-primary">
      New service plan
    </Link>
  ) : null;

  return (
    <div className="max-w-3xl">
      <PageHeader
        title="Service Planner"
        description={canManage ? "Plan each service's running order and who leads each part. Volunteers see a plan once it's published." : "Published running orders for upcoming services."}
        actions={newButton}
      />

      <nav aria-label="Which services" className="mb-4 flex gap-1 border-b border-line">
        {[
          { key: "upcoming", label: "Upcoming" },
          { key: "past", label: "Past" },
        ].map((t) => {
          const active = (t.key === "past") === past;
          return (
            <Link
              key={t.key}
              href={buildQuery({ when: t.key === "past" ? "past" : undefined })}
              aria-current={active ? "page" : undefined}
              className={`px-3 py-2 text-sm -mb-px border-b-2 ${active ? "border-ember font-semibold" : "border-transparent text-ink/60 hover:text-ink"}`}
            >
              {t.label}
            </Link>
          );
        })}
      </nav>

      {error ? (
        <Alert tone="error" title="Couldn't load service plans">Refresh the page to try again.</Alert>
      ) : plans.length === 0 ? (
        <EmptyState
          icon={NAV_ICONS.servicePlanner}
          title={past ? "No past services" : "No upcoming services planned"}
          description={canManage ? "Create a plan to share the running order with your team." : "Your pastors haven't published a plan yet."}
          action={past ? undefined : newButton}
        />
      ) : (
        <ul className="space-y-2">
          {plans.map((p) => (
            <li key={p.id}>
              <Link href={`/dashboard/service-planner/${p.id}`} className="card-interactive rounded-xl p-4 flex items-center justify-between gap-3">
                <div>
                  <p className="font-semibold">{p.title}</p>
                  <p className="text-sm text-ink/60">
                    {formatDate(p.service_date, { weekday: "long" })} · {p.service_plan_items?.[0]?.count ?? 0} items
                  </p>
                </div>
                {p.status === "published" ? <StatusBadge tone="success">Published</StatusBadge> : <StatusBadge tone="warning">Draft</StatusBadge>}
              </Link>
            </li>
          ))}
        </ul>
      )}
      <Pagination page={page} hasMore={(data?.length ?? 0) > PAGE_SIZE} hrefFor={(p) => buildQuery({ when: past ? "past" : undefined, page: p })} />
    </div>
  );
}
