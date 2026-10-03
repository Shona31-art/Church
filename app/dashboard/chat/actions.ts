"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { getCurrentAppUser } from "@/lib/current-user";
import { checkModuleAccess } from "@/lib/paywall";
import { flash } from "@/lib/flash";

/**
 * Opens (or reuses) a direct message with someone in the same church.
 * Form fields: user_id. The start_direct_message() database function checks
 * both people are active members of the caller's church and creates the
 * channel and memberships in one step (platform_hardening.sql).
 */
export async function startDirectMessage(formData: FormData): Promise<void> {
  const me = await getCurrentAppUser();
  if (!me) redirect("/login");
  if (!(await checkModuleAccess("dept_chats")).allowed) redirect("/dashboard/chat");

  const other = z.string().uuid().safeParse(formData.get("user_id"));
  if (!other.success || other.data === me.id) {
    flash("Choose someone to message.", "error");
    redirect("/dashboard/chat/dm/new");
  }

  const { data: channelId, error } = await createClient().rpc("start_direct_message", { other_user: other.data });
  if (error || !channelId) {
    console.error("[chat] start DM failed:", error?.message);
    flash("Couldn't start that conversation. They may no longer be in your church.", "error");
    redirect("/dashboard/chat/dm/new");
  }
  redirect(`/dashboard/chat/${channelId}`);
}
