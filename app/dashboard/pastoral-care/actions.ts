"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { getCurrentAppUser, type AppUser } from "@/lib/current-user";
import { checkModuleAccess } from "@/lib/paywall";
import { logAudit } from "@/lib/audit";
import { flash } from "@/lib/flash";
import { can } from "@/lib/permissions";
import { LOG_TYPES } from "@/lib/pastoral-care";
import { FormState, SESSION_EXPIRED, formValues, invalid, optionalField } from "@/lib/forms";

// Pastoral care notes are the most sensitive data in the app. Three layers:
//   1. RLS (pastoral_logs_all) — only pastors/church admins of that church;
//      deliberately no platform super-admin access.
//   2. The role check below, re-done in every action (never trust the page).
//   3. Every create/update/delete is written to audit_logs — without the
//      note's content.

const LogSchema = z.object({
  memberId: z.string().uuid().optional(),
  memberName: z.string().trim().max(120).optional(),
  logType: z.enum(LOG_TYPES, { message: "Choose a type of care." }),
  notes: z.string().trim().min(1, "Add a few notes about the visit.").max(10_000, "Notes are too long (10,000 characters max)."),
  location: z.string().trim().max(200).optional(),
  followUpDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Follow-up date is invalid.").optional(),
});

async function requireShepherd(): Promise<AppUser | null> {
  const me = await getCurrentAppUser();
  if (!me || !me.church_id || !can(me.role, "pastoralCare")) return null;
  return (await checkModuleAccess("pastoral_care")).allowed ? me : null;
}

function refresh() {
  revalidatePath("/dashboard/pastoral-care");
  revalidatePath("/dashboard");
}

/**
 * Create or edit a care record. Form fields: log_id? + updated_at? (edit),
 * member_id?, member_name? (when not an app user), log_type, notes,
 * location?, follow_up_date?
 */
export async function saveCareLog(_prev: FormState, formData: FormData): Promise<FormState> {
  const me = await requireShepherd();
  if (!me) return { error: "Only pastors and church admins can record pastoral care. If you are one, sign in again." };

  const parsed = LogSchema.safeParse({
    memberId: optionalField(formData, "member_id"),
    memberName: optionalField(formData, "member_name"),
    logType: formData.get("log_type"),
    notes: formData.get("notes"),
    location: optionalField(formData, "location"),
    followUpDate: optionalField(formData, "follow_up_date"),
  });
  if (!parsed.success) return invalid(parsed.error, formData);
  const input = parsed.data;
  const values = formValues(formData);

  const supabase = createClient();
  // Resolve the name from the member record when one is chosen — never trust
  // a client-supplied name for an existing member.
  let memberName = input.memberName ?? "";
  if (input.memberId) {
    const { data: member } = await supabase.from("app_users").select("name").eq("id", input.memberId).eq("church_id", me.church_id).maybeSingle();
    if (!member) return { error: "That member couldn't be found in your church.", values };
    memberName = member.name;
  }
  if (!memberName) return { error: "Please fix the highlighted fields.", fieldErrors: { member_name: "Choose a member or type the person's name." }, values };

  const row = {
    member_id: input.memberId ?? null,
    member_name: memberName,
    log_type: input.logType,
    notes: input.notes,
    location: input.location ?? null,
    follow_up_date: input.followUpDate ?? null,
  };

  const existingId = formData.get("log_id");
  if (existingId) {
    const id = z.string().uuid().safeParse(existingId);
    const updatedAt = String(formData.get("updated_at") ?? "");
    if (!id.success || !updatedAt) return { error: "That care record couldn't be found.", values };
    const { data: updated, error } = await supabase
      .from("pastoral_care_logs")
      .update({ ...row, updated_by: me.id })
      .eq("id", id.data)
      .eq("church_id", me.church_id)
      .eq("updated_at", updatedAt)
      .select("id");
    if (error) {
      console.error("[pastoral-care] update failed:", error.message);
      return { error: "Couldn't save this care record — please try again. Your text is still in the form.", values };
    }
    if (!updated?.length) return { error: "Someone else updated this record while you were editing. Reload to see their changes.", values };
    await logAudit({ churchId: me.church_id, actorId: me.id, action: "pastoral_care.updated", targetTable: "pastoral_care_logs", targetId: id.data, metadata: { log_type: input.logType } });
    refresh();
    flash("Care record updated.");
    redirect("/dashboard/pastoral-care");
  }

  const { data: created, error } = await supabase
    .from("pastoral_care_logs")
    .insert({ ...row, church_id: me.church_id, created_by: me.id })
    .select("id")
    .single();
  if (error || !created) {
    console.error("[pastoral-care] create failed:", error?.message);
    return { error: "Couldn't save this care record — please try again. Your text is still in the form.", values };
  }

  await logAudit({ churchId: me.church_id, actorId: me.id, action: "pastoral_care.created", targetTable: "pastoral_care_logs", targetId: created.id, metadata: { log_type: input.logType } });
  refresh();
  flash("Care record saved.");
  redirect("/dashboard/pastoral-care");
}

/** Form fields: id, done ("true" | "false") */
export async function setFollowUpDone(_prev: FormState, formData: FormData): Promise<FormState> {
  const me = await requireShepherd();
  if (!me) return { error: SESSION_EXPIRED };
  const id = z.string().uuid().safeParse(formData.get("id"));
  if (!id.success) return { error: "That record couldn't be found." };
  const done = formData.get("done") === "true";

  const { data: updated, error } = await createClient()
    .from("pastoral_care_logs")
    .update({ follow_up_done: done, updated_by: me.id })
    .eq("id", id.data)
    .eq("church_id", me.church_id)
    .select("id");
  if (error || !updated?.length) return { error: "Couldn't update the follow-up — please try again." };

  await logAudit({
    churchId: me.church_id,
    actorId: me.id,
    action: done ? "pastoral_care.follow_up_done" : "pastoral_care.follow_up_reopened",
    targetTable: "pastoral_care_logs",
    targetId: id.data,
  });
  refresh();
  flash(done ? "Follow-up marked done." : "Follow-up reopened.");
  return { ok: true };
}

/** Form fields: id */
export async function deleteCareLog(_prev: FormState, formData: FormData): Promise<FormState> {
  const me = await requireShepherd();
  if (!me) return { error: SESSION_EXPIRED };
  const id = z.string().uuid().safeParse(formData.get("id"));
  if (!id.success) return { error: "That record couldn't be found." };

  const { data: deleted, error } = await createClient().from("pastoral_care_logs").delete().eq("id", id.data).eq("church_id", me.church_id).select("id");
  if (error || !deleted?.length) {
    if (error) console.error("[pastoral-care] delete failed:", error.message);
    return { error: "Couldn't delete this record — please try again." };
  }
  await logAudit({ churchId: me.church_id, actorId: me.id, action: "pastoral_care.deleted", targetTable: "pastoral_care_logs", targetId: id.data });
  refresh();
  flash("Care record deleted.");
  return { ok: true };
}
