import "server-only";
import { createClient } from "@/lib/supabase/server";
import { getCurrentAppUser } from "@/lib/current-user";

// AI calls cost real money per request, so each person gets a rolling hourly
// allowance. Counted in Postgres (not memory) because Vercel runs many
// short-lived server instances that don't share memory.
const LIMIT_PER_HOUR = Number(process.env.AI_CALLS_PER_USER_PER_HOUR || 30);

export async function consumeAiQuota(feature: string): Promise<{ ok: true } | { ok: false; error: string }> {
  const me = await getCurrentAppUser();
  if (!me) return { ok: false, error: "Your session has expired — please sign in again." };

  const supabase = createClient();
  const since = new Date(Date.now() - 60 * 60 * 1000).toISOString();

  const { count, error } = await supabase
    .from("ai_usage_events")
    .select("id", { count: "exact", head: true })
    .eq("user_id", me.id)
    .gte("created_at", since);

  if (error) {
    // Table missing (migration not run yet) shouldn't take AI features down —
    // log loudly and allow the call.
    console.error("[ai-quota] couldn't read usage, allowing call:", error.message);
    return { ok: true };
  }

  if ((count ?? 0) >= LIMIT_PER_HOUR) {
    return {
      ok: false,
      error: `You've reached the limit of ${LIMIT_PER_HOUR} AI requests per hour. Please try again a little later.`,
    };
  }

  await supabase.from("ai_usage_events").insert({ user_id: me.id, church_id: me.church_id, feature });
  return { ok: true };
}
