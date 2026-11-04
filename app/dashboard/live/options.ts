import "server-only";
import { createClient } from "@/lib/supabase/server";
import { formatDate } from "@/lib/format";

/** Choices for the live service form: recent/upcoming service plans, sermon notes and the church's songs. */
export async function liveFormOptions(churchId: string) {
  const supabase = createClient();
  const since = new Date(Date.now() - 30 * 86_400_000).toISOString().slice(0, 10);
  const [{ data: plans }, { data: outlines }, { data: songs }] = await Promise.all([
    supabase.from("service_plans").select("id, title, service_date, status").eq("church_id", churchId).gte("service_date", since).order("service_date").limit(50),
    supabase.from("sermon_outlines").select("id, title, sermon_date").eq("church_id", churchId).gte("sermon_date", since).order("sermon_date", { ascending: false }).limit(50),
    supabase.from("songs").select("id, title").eq("church_id", churchId).order("title").limit(2000),
  ]);
  return {
    plans: (plans ?? []).map((p) => ({ id: p.id, label: `${p.title} · ${formatDate(p.service_date)}${p.status === "draft" ? " (draft)" : ""}` })),
    outlines: (outlines ?? []).map((o) => ({ id: o.id, label: `${o.title} · ${formatDate(o.sermon_date)}` })),
    songs: (songs ?? []).map((s) => ({ id: s.id, label: s.title })),
  };
}
