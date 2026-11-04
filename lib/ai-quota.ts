import "server-only";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getCurrentAppUser } from "@/lib/current-user";
import { APP_TIMEZONE } from "@/lib/format";
import { monthBounds } from "@/lib/ai-allowance";

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

  // The church's monthly allowance (plans.ai_monthly_limit, church_life.sql).
  if (me.church_id) {
    const usage = await churchAiUsage(me.church_id);
    if (usage && usage.limit !== null && usage.used >= usage.limit) {
      const resets = new Date(`${usage.nextMonth}T12:00:00Z`).toLocaleDateString("en-ZA", { timeZone: APP_TIMEZONE, day: "numeric", month: "long" });
      return {
        ok: false,
        error:
          usage.limit === 0
            ? "AI tools aren't included in your church's plan."
            : `Your church has used all ${usage.limit} AI requests for this month. They start again on ${resets}${usage.limit < 1000 ? " — or your church admin can move to Unlimited for 1,000 a month" : ""}.`,
      };
    }
  }

  await supabase.from("ai_usage_events").insert({ user_id: me.id, church_id: me.church_id, feature });
  return { ok: true };
}

/**
 * A church's AI use this month against its plan's allowance (null limit = no
 * monthly limit). Null when it can't be read (migration not run yet).
 */
export async function churchAiUsage(churchId: string): Promise<{ used: number; limit: number | null; nextMonth: string } | null> {
  const admin = createAdminClient(); // usage rows are private to each person; the church total is counted here
  const { start, nextMonth } = monthBounds();
  const { data: sub } = await admin.from("church_subscriptions").select("plan_key").eq("church_id", churchId).maybeSingle();
  const { data: plan, error: planError } = await admin.from("plans").select("ai_monthly_limit").eq("key", sub?.plan_key ?? "free_trial").maybeSingle();
  if (planError) return null;
  const { count, error } = await admin
    .from("ai_usage_events")
    .select("id", { count: "exact", head: true })
    .eq("church_id", churchId)
    .gte("created_at", `${start}T00:00:00+02:00`);
  if (error) return null;
  return { used: count ?? 0, limit: (plan?.ai_monthly_limit as number | null | undefined) ?? null, nextMonth };
}
