import { createClient } from "@/lib/supabase/server";
import { checkModuleAccess } from "@/lib/paywall";
import { getCurrentAppUser } from "@/lib/current-user";
import { isPosterRole } from "@/lib/posters";
import { PosterEditor } from "./PosterEditor";

export default async function NewPosterPage() {
  const access = await checkModuleAccess("ai_poster");
  if (!access.allowed) return <p className="text-red-600">{access.reason}</p>;

  const me = await getCurrentAppUser();
  if (!me || !isPosterRole(me.role)) {
    return <p className="text-ink/60">Only pastors, church admins and department leaders can create posters.</p>;
  }

  // The preview uses the real church name — the same one the saved poster shows.
  const supabase = createClient();
  const { data: church } = await supabase.from("churches").select("name").eq("id", me.church_id).single();

  return <PosterEditor churchName={church?.name ?? ""} />;
}
