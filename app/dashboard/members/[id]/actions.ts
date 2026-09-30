"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getCurrentAppUser } from "@/lib/current-user";
import { logAudit } from "@/lib/audit";

// These rules mirror the database trigger in security_fix_app_users.sql —
// the trigger is the real boundary; checking here too gives people a clear
// message instead of a raw database error.

export type FormResult = { error?: string; ok?: boolean } | null;

const UpdateSchema = z.object({
  memberId: z.string().uuid(),
  role: z.enum(["member", "department_leader", "pastor", "church_admin"]),
  status: z.enum(["active", "invited", "disabled"]),
  departmentId: z.union([z.string().uuid(), z.literal("")]),
  birthDate: z.union([z.string().regex(/^\d{4}-\d{2}-\d{2}$/), z.literal("")]),
});

async function loadTarget(memberId: string, churchId: string | null) {
  const supabase = createClient();
  const { data } = await supabase
    .from("app_users")
    .select("id, name, role, status, church_id, department_id")
    .eq("id", memberId)
    .eq("church_id", churchId)
    .single();
  return data;
}

export async function updateMember(_prev: FormResult, formData: FormData): Promise<FormResult> {
  const me = await getCurrentAppUser();
  if (!me || !["church_admin", "pastor"].includes(me.role)) {
    return { error: "Only church admins and pastors can edit members." };
  }

  const parsed = UpdateSchema.safeParse({
    memberId: formData.get("member_id"),
    role: formData.get("role"),
    status: formData.get("status"),
    departmentId: formData.get("department_id") ?? "",
    birthDate: formData.get("birth_date") ?? "",
  });
  if (!parsed.success) return { error: "Some of those values aren't valid — please check the form." };
  const input = parsed.data;

  const target = await loadTarget(input.memberId, me.church_id);
  if (!target) return { error: "That member couldn't be found in your church." };

  const roleOrStatusChanged = input.role !== target.role || input.status !== target.status;
  if (target.id === me.id && roleOrStatusChanged) {
    return { error: "You can't change your own role or status — ask another church admin." };
  }
  if ((target.role === "church_admin" || input.role === "church_admin") && input.role !== target.role && me.role !== "church_admin") {
    return { error: "Only a church admin can grant or remove the church admin role." };
  }
  const departmentChanged = (input.departmentId || null) !== target.department_id;
  if (target.role === "church_admin" && me.role !== "church_admin" && (roleOrStatusChanged || departmentChanged)) {
    return { error: "Only a church admin can change another church admin's role, status or department." };
  }

  const supabase = createClient();
  const { error } = await supabase
    .from("app_users")
    .update({ role: input.role, status: input.status, department_id: input.departmentId || null })
    .eq("id", input.memberId)
    .eq("church_id", me.church_id);
  if (error) {
    console.error("[members] update failed:", error.message);
    return { error: "Couldn't save changes — please try again." };
  }

  if (input.birthDate) {
    const { error: bdayError } = await supabase.from("member_birthdays").upsert({
      user_id: input.memberId,
      church_id: me.church_id,
      birth_date: input.birthDate,
      updated_by: me.id,
    });
    if (bdayError) return { error: "Saved role and status, but the birthday couldn't be saved — try again." };
  } else {
    await supabase.from("member_birthdays").delete().eq("user_id", input.memberId);
  }

  if (roleOrStatusChanged) {
    await logAudit({
      churchId: me.church_id,
      actorId: me.id,
      action: "member.role_status_changed",
      targetTable: "app_users",
      targetId: input.memberId,
      metadata: { from: { role: target.role, status: target.status }, to: { role: input.role, status: input.status } },
    });
  }

  revalidatePath("/dashboard/members");
  revalidatePath(`/dashboard/members/${input.memberId}`);
  return { ok: true };
}

export async function deactivateMember(formData: FormData) {
  const me = await getCurrentAppUser();
  const memberId = z.string().uuid().safeParse(formData.get("member_id"));
  if (!me || !["church_admin", "pastor"].includes(me.role) || !memberId.success) return;
  if (memberId.data === me.id) return;

  const target = await loadTarget(memberId.data, me.church_id);
  if (!target || (target.role === "church_admin" && me.role !== "church_admin")) return;

  const supabase = createClient();
  const { error } = await supabase
    .from("app_users")
    .update({ status: "disabled" })
    .eq("id", memberId.data)
    .eq("church_id", me.church_id);
  if (!error) {
    await logAudit({ churchId: me.church_id, actorId: me.id, action: "member.deactivated", targetTable: "app_users", targetId: memberId.data });
  }
  redirect("/dashboard/members");
}

/**
 * Permanent deletion / POPIA erasure. Church admin only. Removes the login,
 * the profile, and (via ON DELETE rules) the person's own data; giving
 * records are kept but de-identified. Pastoral care notes that only
 * reference the person by typed name are deleted explicitly here.
 */
export async function deleteMemberPermanently(_prev: FormResult, formData: FormData): Promise<FormResult> {
  const me = await getCurrentAppUser();
  if (!me || me.role !== "church_admin") return { error: "Only a church admin can permanently delete a member." };

  const memberId = z.string().uuid().safeParse(formData.get("member_id"));
  if (!memberId.success) return { error: "Invalid member." };
  if (memberId.data === me.id) return { error: "You can't delete your own account from here." };
  if (formData.get("confirm_name") !== "DELETE") return { error: 'Type DELETE in the box to confirm.' };

  const target = await loadTarget(memberId.data, me.church_id);
  if (!target) return { error: "That member couldn't be found in your church." };

  const admin = createAdminClient();
  const { error: careError } = await admin
    .from("pastoral_care_logs")
    .delete()
    .eq("church_id", me.church_id)
    .eq("member_id", memberId.data);
  if (careError) return { error: "Couldn't remove this person's care records — nothing was deleted. Try again." };

  const { error } = await admin.auth.admin.deleteUser(memberId.data);
  if (error) {
    console.error("[members] delete failed:", error.message);
    return {
      error:
        "Couldn't delete this account. If this is an existing database, make sure church_os_features_schema.sql has been run (it fixes deletion). You can deactivate the member instead.",
    };
  }

  // No name in the audit metadata — the point of erasure is not keeping it.
  await logAudit({ churchId: me.church_id, actorId: me.id, action: "member.deleted", targetTable: "app_users", targetId: memberId.data });
  revalidatePath("/dashboard/members");
  redirect("/dashboard/members");
}
