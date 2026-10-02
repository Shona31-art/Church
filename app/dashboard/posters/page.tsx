import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { checkModuleAccess } from "@/lib/paywall";
import { getCurrentAppUser } from "@/lib/current-user";
import { isPosterRole } from "@/lib/posters";

export default async function PostersPage() {
  const access = await checkModuleAccess("ai_poster");
  if (!access.allowed) return <p className="text-red-600">{access.reason}</p>;

  const me = await getCurrentAppUser();
  const supabase = createClient();

  const { data: posters, error } = await supabase
    .from("posters")
    .select("id, event_title, event_date, template_key")
    .eq("church_id", me!.church_id)
    .order("created_at", { ascending: false });
  if (error) console.error("[posters] list failed:", error.message);

  const canCreate = isPosterRole(me?.role);

  return (
    <div className="max-w-2xl">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-semibold">Poster Studio</h1>
        {canCreate && (
          <Link
            href="/dashboard/posters/new"
            className="bg-ember text-white px-4 py-2 rounded-lg text-sm font-medium"
          >
            + New poster
          </Link>
        )}
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
        {posters?.map((p) => (
          <Link
            key={p.id}
            href={`/dashboard/posters/${p.id}`}
            className="border border-ink/10 rounded-xl p-4 bg-white/60 hover:bg-white"
          >
            <p className="font-medium text-sm">{p.event_title}</p>
            <p className="text-xs text-ink/40">{p.event_date}</p>
          </Link>
        ))}
        {error && (
          <p role="alert" className="text-sm text-red-700 col-span-full">⚠ Couldn't load posters — refresh the page to try again.</p>
        )}
        {!error && !posters?.length && (
          <p className="text-ink/40 text-sm col-span-full">
            No posters yet.{canCreate && " Use “New poster” to design one for your next event in a couple of minutes."}
          </p>
        )}
      </div>
    </div>
  );
}
