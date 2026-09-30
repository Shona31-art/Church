import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { getCurrentAppUser } from "@/lib/current-user";

export default async function GivingReportPage() {
  const me = await getCurrentAppUser();
  if (!me || me.role !== "church_admin") {
    return <p className="text-ink/60">Only church admins can view the giving report.</p>;
  }

  const supabase = createClient();
  const { data: givings } = await supabase
    .from("givings")
    .select("*, app_users(name)")
    .eq("church_id", me.church_id)
    .eq("status", "succeeded")
    .order("created_at", { ascending: false });

  const byFund = new Map<string, number>();
  let total = 0;
  (givings || []).forEach((g) => {
    byFund.set(g.fund, (byFund.get(g.fund) || 0) + g.amount_cents);
    total += g.amount_cents;
  });

  return (
    <div className="max-w-lg">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-semibold">Giving report</h1>
        <Link href="/dashboard/giving" className="text-xs text-ember">
          ← Give
        </Link>
      </div>

      <div className="card-elevated rounded-xl p-5 mb-6">
        <p className="text-xs text-ink/40 mb-1">Total received (all-time, succeeded only)</p>
        <p className="text-3xl font-semibold">R{(total / 100).toFixed(2)}</p>
      </div>

      <div className="grid grid-cols-2 gap-3 mb-8">
        {[...byFund.entries()].map(([fund, cents]) => (
          <div key={fund} className="card-elevated rounded-lg p-3">
            <p className="text-xs text-ink/40 capitalize">{fund.replace("_", " ")}</p>
            <p className="text-lg font-semibold">R{(cents / 100).toFixed(2)}</p>
          </div>
        ))}
        {!byFund.size && <p className="text-ink/40 text-sm col-span-2">No giving recorded yet.</p>}
      </div>

      <p className="text-xs uppercase tracking-wide text-ink/50 mb-3">All transactions</p>
      <div className="space-y-2">
        {givings?.map((g: any) => (
          <div key={g.id} className="card-elevated rounded-lg px-4 py-3 flex justify-between text-sm">
            <div>
              <p>{g.app_users?.name || "Member"}</p>
              <p className="text-xs text-ink/40 capitalize">
                {g.fund.replace("_", " ")} · {new Date(g.created_at).toLocaleDateString()}
              </p>
            </div>
            <p className="font-medium">R{(g.amount_cents / 100).toFixed(2)}</p>
          </div>
        ))}
        {!givings?.length && <p className="text-ink/40 text-sm">Nothing yet.</p>}
      </div>
    </div>
  );
}
