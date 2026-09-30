import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { checkModuleAccess } from "@/lib/paywall";
import { getCurrentAppUser } from "@/lib/current-user";

export default async function AnnouncementsPage() {
  const access = await checkModuleAccess("announcements");
  if (!access.allowed) return <p className="text-red-600">{access.reason}</p>;

  const me = await getCurrentAppUser();
  const supabase = createClient();

  // RLS already scopes this correctly, but selecting explicitly by church
  // keeps the query efficient rather than relying purely on the policy scan.
  const { data: announcements } = await supabase
    .from("announcements")
    .select("*, departments(name), app_users!announcements_author_id_fkey(name)")
    .eq("church_id", me!.church_id)
    .order("pinned", { ascending: false })
    .order("created_at", { ascending: false });

  const canPost = me && ["church_admin", "pastor", "department_leader"].includes(me.role);

  return (
    <div className="max-w-2xl">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-semibold">Announcements</h1>
        {canPost && (
          <Link
            href="/dashboard/announcements/new"
            className="bg-ember text-white px-4 py-2 rounded-lg text-sm font-medium"
          >
            + New
          </Link>
        )}
      </div>

      <div className="space-y-4">
        {announcements?.map((a: any) => (
          <div key={a.id} className="border border-ink/10 rounded-xl p-4 bg-white/60">
            <div className="flex items-center gap-2 mb-1">
              {a.pinned && <span className="text-xs text-ember">📌 Pinned</span>}
              {a.departments?.name && (
                <span className="text-xs text-ink/40">{a.departments.name}</span>
              )}
            </div>
            <h2 className="font-semibold mb-1">{a.title}</h2>
            {a.image_url && (
              <img src={a.image_url} alt="" className="w-full rounded-lg mb-2 max-h-64 object-cover" />
            )}
            <p className="text-sm text-ink/70 whitespace-pre-wrap">{a.body}</p>
            <p className="text-xs text-ink/30 mt-2">
              {a.app_users?.name} · {new Date(a.created_at).toLocaleDateString()}
            </p>
          </div>
        ))}
        {!announcements?.length && (
          <p className="text-ink/40 text-sm">No announcements yet.</p>
        )}
      </div>
    </div>
  );
}
