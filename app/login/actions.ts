"use server";

import { headers } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import { logAudit } from "@/lib/audit";
import { describeDevice } from "@/lib/audit-labels";

/** Records a successful sign-in in the audit log (called right after signing in). */
export async function recordSignIn(): Promise<void> {
  try {
    const supabase = createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return;
    const { data: profile } = await supabase.from("app_users").select("id, church_id").eq("id", user.id).maybeSingle();
    await logAudit({
      churchId: profile?.church_id ?? null,
      actorId: profile?.id ?? null,
      action: "auth.signed_in",
      metadata: { device: describeDevice(headers().get("user-agent")), ...(profile ? {} : { email: user.email }) },
    });
  } catch (error) {
    console.error("[audit] sign-in not recorded:", error);
  }
}

/** Records a sign-out in the audit log (called just before signing out). */
export async function recordSignOut(): Promise<void> {
  try {
    const supabase = createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return;
    const { data: profile } = await supabase.from("app_users").select("id, church_id").eq("id", user.id).maybeSingle();
    if (profile) await logAudit({ churchId: profile.church_id, actorId: profile.id, action: "auth.signed_out" });
  } catch (error) {
    console.error("[audit] sign-out not recorded:", error);
  }
}
