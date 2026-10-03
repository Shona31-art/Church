import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { checkModuleAccess } from "@/lib/paywall";
import { getCurrentAppUser } from "@/lib/current-user";

export default async function ServicePlannerPage() {
  const access = await checkModuleAccess("service_planner");
  if (!access.allowed) return <p className="text-red-600">{access.reason}</p>;

  const me = await getCurrentAppUser();
  const supabase = createClient();

  const { data: plans, error } = await supabase
    .from("service_plans")
    .select("id, title, service_date, status")
    .eq("church_id", me!.church_id)
    .order("service_date", { ascending: false });
  if (error) console.error("[service-planner] list failed:", error.message);

  const canManage = me && ["pastor", "church_admin"].includes(me.role);

  return (
    <div className="max-w-2xl">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-semibold">Service Planner</h1>
        {canManage && (
          <Link
            href="/dashboard/service-planner/new"
            className="bg-ember text-white px-4 py-2 rounded-lg text-sm font-medium"
          >
            + New service
          </Link>
        )}
      </div>

      <div className="space-y-3">
        {plans?.map((p) => (
          <Link
            key={p.id}
            href={`/dashboard/service-planner/${p.id}`}
            className="flex items-center justify-between border border-ink/10 rounded-xl p-4 bg-white/60 hover:bg-white"
          >
            <div>
              <p className="font-semibold">{p.title}</p>
              <p className="text-sm text-ink/50">
                {new Date(p.service_date).toLocaleDateString(undefined, {
                  weekday: "long",
                  month: "short",
                  day: "numeric",
                })}
              </p>
            </div>
            <span className={p.status === "published" ? "text-green-700 text-xs" : "text-ink/40 text-xs"}>
              {p.status}
            </span>
          </Link>
        ))}
        {error && (
          <p role="alert" className="text-sm text-red-700">⚠ Couldn't load service plans — refresh the page to try again.</p>
        )}
        {!error && !plans?.length && (
          <p className="text-ink/40 text-sm">
            {canManage ? "No service plans yet. Create one to share the running order with your team." : "No published service plans yet."}
          </p>
        )}
      </div>
    </div>
  );
}
