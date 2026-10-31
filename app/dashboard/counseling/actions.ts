"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getCurrentAppUser, type AppUser } from "@/lib/current-user";
import { checkModuleAccess } from "@/lib/paywall";
import { logAudit } from "@/lib/audit";
import { flash } from "@/lib/flash";
import { notify } from "@/lib/notify";
import { can } from "@/lib/permissions";
import { getCounselingReply } from "@/lib/counseling";
import { FormState, SESSION_EXPIRED, formValues } from "@/lib/forms";

// AI counseling. Privacy model (counseling_schema.sql + platform_hardening.sql):
//   * A member sees only their own conversations.
//   * Pastors/admins see a conversation only if the member shared it, or the
//     crisis detector flagged it.
//   * Crisis flags, assistant replies and escalations are written by trusted
//     server code (service role) after checking the member owns the
//     conversation — members can't forge or clear them.

async function requireCounselingMember(): Promise<AppUser | null> {
  const me = await getCurrentAppUser();
  if (!me || !me.church_id) return null;
  if (!(await checkModuleAccess("ai_counseling")).allowed) return null;
  const { data: settings } = await createClient().from("counseling_settings").select("enabled").eq("church_id", me.church_id).maybeSingle();
  return settings?.enabled ? me : null;
}

export async function startConversation(): Promise<void> {
  const me = await requireCounselingMember();
  if (!me) {
    flash("Counseling isn't available right now.", "error");
    redirect("/dashboard/counseling");
  }
  const { data, error } = await createClient()
    .from("counseling_conversations")
    .insert({ church_id: me.church_id, member_id: me.id })
    .select("id")
    .single();
  if (error || !data) {
    console.error("[counseling] start failed:", error?.message);
    flash("Couldn't start a conversation — please try again.", "error");
    redirect("/dashboard/counseling");
  }
  redirect(`/dashboard/counseling/${data.id}`);
}

/** Form fields: conversation_id, content */
export async function sendCounselingMessage(_prev: FormState, formData: FormData): Promise<FormState> {
  const me = await requireCounselingMember();
  if (!me) return { error: SESSION_EXPIRED };

  const parsed = z
    .object({ conversationId: z.string().uuid(), content: z.string().trim().min(1, "Write a message first.").max(4000, "Keep messages under 4,000 characters.") })
    .safeParse({ conversationId: formData.get("conversation_id"), content: formData.get("content") });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message, values: formValues(formData) };
  const { conversationId, content } = parsed.data;

  const supabase = createClient();
  // Ownership check through the member's own session (RLS) before any
  // service-role write below.
  const { data: conversation } = await supabase
    .from("counseling_conversations")
    .select("id, flagged")
    .eq("id", conversationId)
    .eq("member_id", me.id)
    .maybeSingle();
  if (!conversation) return { error: "That conversation couldn't be found." };

  const { error: insertError } = await supabase.from("counseling_messages").insert({ conversation_id: conversationId, sender: "member", content });
  if (insertError) {
    console.error("[counseling] message failed:", insertError.message);
    return { error: "Couldn't send your message — please try again.", values: formValues(formData) };
  }

  const [{ data: history }, { data: settings }] = await Promise.all([
    supabase.from("counseling_messages").select("sender, content").eq("conversation_id", conversationId).order("created_at").limit(200),
    supabase.from("counseling_settings").select("theological_stance, escalation_pastor_id").eq("church_id", me.church_id).maybeSingle(),
  ]);
  const { reply, isCrisis } = await getCounselingReply({ history: (history ?? []) as any, theologicalStance: settings?.theological_stance });

  const admin = createAdminClient();
  const now = new Date().toISOString();
  const { error: replyError } = await admin.from("counseling_messages").insert({ conversation_id: conversationId, sender: "assistant", content: reply });
  if (replyError) console.error("[counseling] reply insert failed:", replyError.message);
  await admin.from("counseling_conversations").update({ last_message_at: now }).eq("id", conversationId);

  if (isCrisis) {
    await escalate(conversationId, me, settings?.escalation_pastor_id ?? null, conversation.flagged);
  }

  revalidatePath(`/dashboard/counseling/${conversationId}`);
  return { ok: true };
}

/**
 * Flags the conversation and records who was notified. Notifies the
 * configured pastor, or every active pastor/admin when none is set — a
 * crisis must never depend on one person seeing it.
 */
async function escalate(conversationId: string, me: AppUser, configuredPastor: string | null, alreadyFlagged: boolean) {
  const admin = createAdminClient();
  const { error: flagError } = await admin
    .from("counseling_conversations")
    .update({ flagged: true, flagged_at: new Date().toISOString(), flagged_reason: "crisis_language_detected" })
    .eq("id", conversationId);
  if (flagError) console.error("[counseling] FLAG FAILED — crisis not recorded:", flagError.message);

  // One escalation per conversation is enough; follow-up crisis messages
  // in the same conversation are visible to the pastor already.
  if (alreadyFlagged) return;

  let recipients: string[] = [];
  if (configuredPastor) {
    const { data } = await admin.from("app_users").select("id").eq("id", configuredPastor).eq("church_id", me.church_id).neq("status", "disabled").maybeSingle();
    if (data) recipients = [data.id];
  }
  if (!recipients.length) {
    const { data } = await admin.from("app_users").select("id").eq("church_id", me.church_id).in("role", ["pastor", "church_admin"]).neq("status", "disabled");
    recipients = (data ?? []).map((u) => u.id);
  }

  if (recipients.length) {
    const { error } = await admin.from("counseling_escalations").insert(recipients.map((id) => ({ conversation_id: conversationId, notified_user_id: id })));
    if (error) console.error("[counseling] ESCALATION FAILED:", error.message);
  } else {
    console.error(`[counseling] crisis in church ${me.church_id} but no active pastor or admin to notify`);
  }

  await logAudit({ churchId: me.church_id, actorId: me.id, action: "counseling.crisis_flagged", targetTable: "counseling_conversations", targetId: conversationId });
  await notify({ type: "counseling.crisis_flagged", churchId: me.church_id!, conversationId, notifyUserIds: recipients });
}

/** Member shares (or stops sharing) a conversation with their pastors. Form fields: conversation_id, share ("true" | "false") */
export async function setShareWithPastor(_prev: FormState, formData: FormData): Promise<FormState> {
  const me = await getCurrentAppUser();
  if (!me) return { error: SESSION_EXPIRED };
  const id = z.string().uuid().safeParse(formData.get("conversation_id"));
  if (!id.success) return { error: "That conversation couldn't be found." };
  const share = formData.get("share") === "true";

  const { data: updated, error } = await createClient()
    .from("counseling_conversations")
    .update({ shared_with_pastor: share, shared_at: share ? new Date().toISOString() : null })
    .eq("id", id.data)
    .eq("member_id", me.id)
    .select("id");
  if (error || !updated?.length) return { error: "Couldn't change sharing — please try again." };

  revalidatePath(`/dashboard/counseling/${id.data}`);
  revalidatePath("/dashboard/counseling");
  flash(share ? "Shared with your pastors. They can now read this conversation." : "Stopped sharing. Pastors can no longer open this conversation (unless it was flagged for safety).");
  return { ok: true };
}

/** Pastor/admin acknowledges an escalation. Form fields: conversation_id, outcome_notes? */
export async function acknowledgeEscalation(_prev: FormState, formData: FormData): Promise<FormState> {
  const me = await getCurrentAppUser();
  if (!me || !me.church_id || !can(me.role, "reviewCounseling")) return { error: SESSION_EXPIRED };
  const parsed = z
    .object({ conversationId: z.string().uuid(), notes: z.string().trim().max(2000).optional() })
    .safeParse({ conversationId: formData.get("conversation_id"), notes: (formData.get("outcome_notes") as string) || undefined });
  if (!parsed.success) return { error: "Please check the form." };

  const { data: updated, error } = await createClient()
    .from("counseling_escalations")
    .update({ acknowledged_at: new Date().toISOString(), outcome_notes: parsed.data.notes ?? null })
    .eq("conversation_id", parsed.data.conversationId)
    .is("acknowledged_at", null)
    .select("id");
  if (error) {
    console.error("[counseling] acknowledge failed:", error.message);
    return { error: "Couldn't record that — please try again." };
  }
  if (!updated?.length) return { error: "This has already been acknowledged by someone else." };

  await logAudit({ churchId: me.church_id, actorId: me.id, action: "counseling.escalation_acknowledged", targetTable: "counseling_conversations", targetId: parsed.data.conversationId });
  revalidatePath(`/dashboard/counseling/${parsed.data.conversationId}`);
  revalidatePath("/dashboard/counseling");
  flash("Marked as followed up.");
  return { ok: true };
}

/** Form fields: enabled ("on"), theological_stance?, escalation_pastor_id? */
export async function saveCounselingSettings(_prev: FormState, formData: FormData): Promise<FormState> {
  const me = await getCurrentAppUser();
  if (!me || !me.church_id || !can(me.role, "configureCounseling")) return { error: "Only pastors and church admins can change counseling settings." };

  const parsed = z
    .object({
      enabled: z.boolean(),
      stance: z.string().trim().max(1000, "Keep the guidance under 1,000 characters.").optional(),
      pastorId: z.union([z.string().uuid(), z.literal("")]).transform((v) => v || null),
    })
    .safeParse({
      enabled: formData.get("enabled") === "on",
      stance: (formData.get("theological_stance") as string) || undefined,
      pastorId: formData.get("escalation_pastor_id") ?? "",
    });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message, values: formValues(formData) };

  const supabase = createClient();
  if (parsed.data.pastorId) {
    const { data: pastor } = await supabase
      .from("app_users")
      .select("id")
      .eq("id", parsed.data.pastorId)
      .eq("church_id", me.church_id)
      .in("role", ["pastor", "church_admin"])
      .maybeSingle();
    if (!pastor) return { error: "Choose a pastor or admin from your church." };
  }

  const { error } = await supabase.from("counseling_settings").upsert({
    church_id: me.church_id,
    enabled: parsed.data.enabled,
    theological_stance: parsed.data.stance ?? null,
    escalation_pastor_id: parsed.data.pastorId,
    updated_at: new Date().toISOString(),
  });
  if (error) {
    console.error("[counseling] settings failed:", error.message);
    return { error: "Couldn't save the settings — please try again.", values: formValues(formData) };
  }
  await logAudit({ churchId: me.church_id, actorId: me.id, action: "counseling.settings_changed", targetTable: "counseling_settings", metadata: { enabled: parsed.data.enabled } });
  revalidatePath("/dashboard/counseling");
  flash("Counseling settings saved.");
  return { ok: true };
}

/**
 * Form fields: conversation_id. The member deletes their own conversation and
 * all its messages. Blocked while a safety flag waits for a pastor's follow-up
 * (supabase/counseling_delete.sql enforces both).
 */
export async function deleteConversation(formData: FormData): Promise<void> {
  const me = await getCurrentAppUser();
  if (!me) return flash(SESSION_EXPIRED, "error");
  const id = z.string().uuid().safeParse(formData.get("conversation_id"));
  if (!id.success) return flash("That conversation couldn't be found.", "error");

  const supabase = createClient();
  const { data: convo } = await supabase.from("counseling_conversations").select("id, member_id, flagged").eq("id", id.data).maybeSingle();
  if (!convo || convo.member_id !== me.id) return flash("You can only delete your own conversations.", "error");

  const { data: deleted, error } = await supabase.from("counseling_conversations").delete().eq("id", id.data).eq("member_id", me.id).select("id");
  if (error) {
    console.error("[counseling] delete failed:", error.code, error.message);
    return flash(
      /policy|permission/i.test(error.message) ? "This needs a database update: a church admin should run supabase/counseling_delete.sql." : "Couldn't delete the conversation — please try again.",
      "error"
    );
  }
  if (!deleted?.length) {
    return flash(
      convo.flagged
        ? "This conversation can be deleted once a pastor has followed up on it. They were told because it mentioned your safety."
        : "Couldn't delete the conversation. If this keeps happening, a church admin should run supabase/counseling_delete.sql.",
      "error"
    );
  }
  revalidatePath("/dashboard/counseling");
  flash("Conversation deleted.");
  redirect("/dashboard/counseling");
}
