import "server-only";
import { cache } from "react";
import { createClient } from "@/lib/supabase/server";
import { getChurchAccess } from "@/lib/paywall";
import { isAiConfigured } from "@/lib/ai";
import type { ModuleKey } from "@/lib/subscription";

// Feature switches that sit *inside* other features — e.g. the AI buttons in
// Announcements, or voice notes in Chat. They exist so the Basic plan can
// include a feature without the parts that cost money to run.

/** Does the feature catalogue have this switch yet? (Added by plan_basic_v2.sql.) */
const switchInstalled = cache(async (key: ModuleKey): Promise<boolean> => {
  const { data, error } = await createClient().from("modules").select("key").eq("key", key).maybeSingle();
  return !error && Boolean(data);
});

/**
 * Is this switch on for the signed-in person's church? Until the migration
 * that adds the switch has been run, the answer is "yes" — so deploying this
 * code first never takes features away from churches that already had them.
 */
export async function planIncludes(key: ModuleKey): Promise<boolean> {
  const access = await getChurchAccess();
  if (!access || access.status === "error") return false;
  if (access.modules.has(key)) return true;
  return !(await switchInstalled(key));
}

/** AI helper buttons: the server has an AI key AND the church's plan includes AI writing help. */
export async function aiAssistAvailable(): Promise<boolean> {
  return isAiConfigured() && (await planIncludes("ai_assist"));
}

/** Shown when a Basic church reaches an AI helper some other way (e.g. a stale page). */
export const AI_NOT_ON_PLAN = "This AI help isn't included in your church's plan. You can still write it yourself.";
