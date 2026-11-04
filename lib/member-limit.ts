import "server-only";
import { createClient } from "@/lib/supabase/server";

export interface MemberLimitStatus {
  /** Active + invited members (deactivated and record-only people don't count). */
  count: number;
  /** The plan's limit; null = unlimited. */
  limit: number | null;
  /** True when no more members can be added. */
  reached: boolean;
}

/**
 * The church's plan member limit (plans.member_limit) against its current
 * head-count. Deactivated people don't count, so a church can make room by
 * deactivating someone who has left. Used to block invites and to warn the
 * church admin.
 */
export async function getMemberLimitStatus(churchId: string): Promise<MemberLimitStatus> {
  const supabase = createClient();
  const { data: sub } = await supabase.from("church_subscriptions").select("plan_key").eq("church_id", churchId).maybeSingle();
  if (!sub) return { count: 0, limit: null, reached: false };
  const { data: plan } = await supabase.from("plans").select("member_limit").eq("key", sub.plan_key).maybeSingle();
  const limit = plan?.member_limit ?? null;
  if (limit === null) return { count: 0, limit, reached: false };
  const base = () => supabase.from("app_users").select("id", { count: "exact", head: true }).eq("church_id", churchId).neq("status", "disabled");
  // Record-only members (record_members.sql) don't count; before that's run, everyone does.
  let { count, error } = await base().eq("record_only", false);
  if (error) ({ count } = await base());
  return { count: count ?? 0, limit, reached: (count ?? 0) >= limit };
}
