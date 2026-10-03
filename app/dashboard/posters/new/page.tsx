import { createClient } from "@/lib/supabase/server";
import { getCurrentAppUser } from "@/lib/current-user";
import { isPosterRole } from "@/lib/posters";
import { PosterEditor } from "./PosterEditor";
import { moduleGate } from "@/lib/gate";

export default async function NewPosterPage() {
  const gate = await moduleGate("ai_poster");
  if (gate) return gate;

  const me = await getCurrentAppUser();
  if (!me || !isPosterRole(me.role)) {
    return <p className="text-ink/60">Only pastors, church admins and department leaders can create posters.</p>;
  }

  // The preview uses the real church name — the same one the saved poster shows.
  const supabase = createClient();
  const { data: church } = await supabase.from("churches").select("name").eq("id", me.church_id).single();

  return <PosterEditor churchName={church?.name ?? ""} />;
}
