import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { checkModuleAccess } from "@/lib/paywall";
import { getCurrentAppUser } from "@/lib/current-user";

export default async function SupportPage() {
  const access = await checkModuleAccess("support");
  if (!access.allowed) return <p className="text-red-600">{access.reason}</p>;

  const me = await getCurrentAppUser();
  const supabase = createClient();

  let query = supabase
    .from("support_tickets")
    .select("id, subject, status, priority, church_id, created_at, churches(name)")
    .order("created_at", { ascending: false });

  if (me!.role === "super_admin") {
    // sees everything
  } else if (me!.role === "church_admin") {
    query = query.eq("church_id", me!.church_id);
  } else {
    query = query.eq("created_by", me!.id);
  }

  const { data: tickets } = await query;

  return (
    <div className="max-w-2xl">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-semibold">
          {me?.role === "super_admin" ? "All support tickets" : "Support"}
        </h1>
        <Link
          href="/dashboard/support/new"
          className="bg-ember text-white px-4 py-2 rounded-lg text-sm font-medium"
        >
          + New ticket
        </Link>
      </div>

      <div className="space-y-2">
        {tickets?.map((t: any) => (
          <Link
            key={t.id}
            href={`/dashboard/support/${t.id}`}
            className="flex items-center justify-between border border-ink/10 rounded-xl p-4 bg-white/60 hover:bg-white"
          >
            <div>
              <p className="font-medium">{t.subject}</p>
              <p className="text-xs text-ink/40">
                {me?.role === "super_admin" && t.churches?.name ? `${t.churches.name} · ` : ""}
                {new Date(t.created_at).toLocaleDateString()}
              </p>
            </div>
            <StatusBadge status={t.status} />
          </Link>
        ))}
        {!tickets?.length && <p className="text-ink/40 text-sm">No tickets yet.</p>}
      </div>
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const color =
    status === "closed" ? "text-ink/40" : status === "in_progress" ? "text-amber-700" : "text-blue-700";
  return <span className={`text-xs ${color}`}>{status.replace("_", " ")}</span>;
}
