import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { getCurrentAppUser } from "@/lib/current-user";

export default async function AllChurchesPage() {
  const me = await getCurrentAppUser();
  if (!me || me.role !== "super_admin") {
    return <p className="text-ink/60">Super Admin access only.</p>;
  }

  const supabase = createClient();
  const { data: churches } = await supabase
    .from("churches")
    .select("id, name, church_subscriptions(status, plan_key, is_lifetime)")
    .order("name");

  return (
    <div className="max-w-3xl">
      <div className="mb-6 flex items-center justify-between gap-4">
        <h1 className="text-2xl font-semibold">All churches</h1>
        <Link
          href="/dashboard/super-admin/churches/new"
          className="bg-ember text-white px-4 py-2 rounded-lg text-sm font-medium"
        >
          Add church
        </Link>
      </div>

      <div className="border border-ink/10 rounded-xl overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-ink/5 text-left">
            <tr>
              <th className="px-4 py-2">Church</th>
              <th className="px-4 py-2">Plan</th>
              <th className="px-4 py-2">Status</th>
              <th className="px-4 py-2"></th>
            </tr>
          </thead>
          <tbody>
            {churches?.map((c: any) => {
              const sub = c.church_subscriptions?.[0] ?? c.church_subscriptions;
              return (
                <tr key={c.id} className="border-t border-ink/10">
                  <td className="px-4 py-2">{c.name}</td>
                  <td className="px-4 py-2 capitalize">
                    {sub?.plan_key?.replace("_", " ") ?? "—"}
                    {sub?.is_lifetime && (
                      <span className="ml-1 text-xs text-ember">(lifetime)</span>
                    )}
                  </td>
                  <td className="px-4 py-2">
                    <StatusBadge status={sub?.status} />
                  </td>
                  <td className="px-4 py-2 text-right">
                    <Link href={`/dashboard/super-admin/churches/${c.id}`} className="text-ember">
                      Manage
                    </Link>
                  </td>
                </tr>
              );
            })}
            {!churches?.length && (
              <tr>
                <td colSpan={4} className="px-4 py-6 text-center text-ink/40">
                  No churches yet.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function StatusBadge({ status }: { status?: string }) {
  const color =
    status === "active"
      ? "text-green-700"
      : status === "trial"
      ? "text-blue-700"
      : status === "grace" || status === "payment_pending"
      ? "text-amber-700"
      : status === "suspended"
      ? "text-red-700"
      : "text-ink/40";
  return <span className={color}>{status ?? "no subscription"}</span>;
}
