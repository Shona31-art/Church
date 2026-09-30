import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { getCurrentAppUser } from "@/lib/current-user";

export default async function SuperAdminHome() {
  const me = await getCurrentAppUser();
  if (!me || me.role !== "super_admin") {
    return <p className="text-ink/60">Super Admin access only.</p>;
  }

  const supabase = createClient();

  const [{ count: totalChurches }, { count: totalUsers }, { data: subs }] =
    await Promise.all([
      supabase.from("churches").select("*", { count: "exact", head: true }),
      supabase.from("app_users").select("*", { count: "exact", head: true }),
      supabase.from("church_subscriptions").select("status, plan_key"),
    ]);

  const statusCounts = (subs || []).reduce<Record<string, number>>((acc, s) => {
    acc[s.status] = (acc[s.status] || 0) + 1;
    return acc;
  }, {});

  return (
    <div className="max-w-3xl">
      <h1 className="text-2xl font-semibold mb-6">Platform overview</h1>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-8">
        <StatCard label="Churches" value={totalChurches ?? 0} />
        <StatCard label="Total users" value={totalUsers ?? 0} />
        <StatCard label="Active" value={statusCounts["active"] ?? 0} />
        <StatCard label="Suspended" value={statusCounts["suspended"] ?? 0} />
      </div>

      <Link
        href="/dashboard/super-admin/churches"
        className="bg-ember text-white px-4 py-2 rounded-lg text-sm font-medium"
      >
        Manage all churches →
      </Link>
    </div>
  );
}

function StatCard({ label, value }: { label: string; value: number }) {
  return (
    <div className="border border-ink/10 rounded-xl p-4 bg-white/60">
      <p className="text-2xl font-semibold">{value}</p>
      <p className="text-xs text-ink/40">{label}</p>
    </div>
  );
}
