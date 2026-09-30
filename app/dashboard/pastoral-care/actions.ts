"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { getCurrentAppUser } from "@/lib/current-user";
import { checkModuleAccess } from "@/lib/paywall";
import { logAudit } from "@/lib/audit";
import { LOG_TYPES } from "@/lib/pastoral-care";

// Pastoral care notes are the most sensitive data in the app. Three layers:
//   1. RLS (pastoral_logs_all) — only pastor/church_admin of that church.
//   2. The role check below, re-done in every action (never trust the page).
//   3. Every create/update/delete is written to audit_logs.


const LogSchema = z.object({
  memberId: z.string().uuid().optional(),
  memberName: z.string().trim().max(120).optional(),
  logType: z.enum(LOG_TYPES, { message: "Choose a type of care." }),
  notes: z.string().trim().min(1, "Add a few notes about the visit.").max(10_000, "Notes are too long (10,000 characters max)."),
  location: z.string().trim().max(200).optional(),
  followUpDate: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "Follow-up date is invalid.")
    .optional(),
});

async function requireShepherd() {
  const me = await getCurrentAppUser();
  if (!me || !["pastor", "church_admin"].includes(me.role) || !me.church_id) return null;
  const access = await checkModuleAccess("pastoral_care");
  if (!access.allowed) return null;
  return me;
}

export type FormResult = { error?: string } | null;

export async function createCareLog(_prev: FormResult, formData: FormData): Promise<FormResult> {
  const me = await requireShepherd();
  if (!me) return { error: "Only pastors and church admins can record pastoral care." };

  const parsed = LogSchema.safeParse({
    memberId: formData.get("member_id") || undefined,
    memberName: formData.get("member_name") || undefined,
    logType: formData.get("log_type"),
    notes: formData.get("notes"),
    location: formData.get("location") || undefined,
    followUpDate: formData.get("follow_up_date") || undefined,
  });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Please check the form." };
  const input = parsed.data;

  const supabase = createClient();

  // Resolve the display name from the member record when one is chosen —
  // never trust a client-supplied name for an existing member.
  let memberName = input.memberName ?? "";
  if (input.memberId) {
    const { data: member } = await supabase
      .from("app_users")
      .select("name")
      .eq("id", input.memberId)
      .eq("church_id", me.church_id)
      .single();
    if (!member) return { error: "That member couldn't be found in your church." };
    memberName = member.name;
  }
  if (!memberName) return { error: "Choose a member or type the person's name." };

  const { data: created, error } = await supabase
    .from("pastoral_care_logs")
    .insert({
      church_id: me.church_id,
      member_id: input.memberId ?? null,
      member_name: memberName,
      log_type: input.logType,
      notes: input.notes,
      location: input.location ?? null,
      follow_up_date: input.followUpDate ?? null,
      created_by: me.id,
    })
    .select("id")
    .single();

  if (error || !created) {
    console.error("[pastoral-care] create failed:", error?.message);
    return { error: "Couldn't save this care note — please try again. Your text is still in the form." };
  }

  // No note content in the audit trail — only that a record exists.
  await logAudit({
    churchId: me.church_id,
    actorId: me.id,
    action: "pastoral_care.created",
    targetTable: "pastoral_care_logs",
    targetId: created.id,
    metadata: { log_type: input.logType },
  });

  revalidatePath("/dashboard/pastoral-care");
  revalidatePath("/dashboard");
  redirect("/dashboard/pastoral-care");
}

export async function setFollowUpDone(formData: FormData) {
  const me = await requireShepherd();
  const id = z.string().uuid().safeParse(formData.get("id"));
  if (!me || !id.success) return;
  const done = formData.get("done") === "true";

  const supabase = createClient();
  const { error } = await supabase
    .from("pastoral_care_logs")
    .update({ follow_up_done: done, updated_by: me.id })
    .eq("id", id.data)
    .eq("church_id", me.church_id);

  if (!error) {
    await logAudit({
      churchId: me.church_id,
      actorId: me.id,
      action: done ? "pastoral_care.follow_up_done" : "pastoral_care.follow_up_reopened",
      targetTable: "pastoral_care_logs",
      targetId: id.data,
    });
  }
  revalidatePath("/dashboard/pastoral-care");
  revalidatePath("/dashboard");
}

export async function deleteCareLog(formData: FormData) {
  const me = await requireShepherd();
  const id = z.string().uuid().safeParse(formData.get("id"));
  if (!me || !id.success) return;

  const supabase = createClient();
  const { error } = await supabase
    .from("pastoral_care_logs")
    .delete()
    .eq("id", id.data)
    .eq("church_id", me.church_id);

  if (!error) {
    await logAudit({
      churchId: me.church_id,
      actorId: me.id,
      action: "pastoral_care.deleted",
      targetTable: "pastoral_care_logs",
      targetId: id.data,
    });
  }
  revalidatePath("/dashboard/pastoral-care");
}
