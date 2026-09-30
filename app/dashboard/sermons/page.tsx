import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { checkModuleAccess } from "@/lib/paywall";
import { getCurrentAppUser } from "@/lib/current-user";

export default async function SermonsPage() {
  const access = await checkModuleAccess("sermon_ai");
  if (!access.allowed) return <p className="text-red-600">{access.reason}</p>;

  const me = await getCurrentAppUser();
  const supabase = createClient();

  const { data: sermons } = await supabase
    .from("sermons")
    .select("id, title, speaker, sermon_date")
    .eq("church_id", me!.church_id)
    .order("sermon_date", { ascending: false });

  const canCreate = me && ["pastor", "church_admin"].includes(me.role);

  return (
    <div className="max-w-2xl">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-semibold">Sermons</h1>
        {canCreate && (
          <Link
            href="/dashboard/sermons/new"
            className="bg-ember text-white px-4 py-2 rounded-lg text-sm font-medium"
          >
            + Add sermon
          </Link>
        )}
      </div>

      <div className="space-y-3">
        {sermons?.map((s) => (
          <Link
            key={s.id}
            href={`/dashboard/sermons/${s.id}`}
            className="block border border-ink/10 rounded-xl p-4 bg-white/60 hover:bg-white"
          >
            <p className="font-semibold">{s.title}</p>
            <p className="text-sm text-ink/50">
              {s.speaker && `${s.speaker} · `}
              {new Date(s.sermon_date).toLocaleDateString()}
            </p>
          </Link>
        ))}
        {!sermons?.length && <p className="text-ink/40 text-sm">No sermons yet.</p>}
      </div>
    </div>
  );
}
