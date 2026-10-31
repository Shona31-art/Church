"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { getCurrentAppUser } from "@/lib/current-user";
import { logAudit } from "@/lib/audit";
import { flash } from "@/lib/flash";
import { can, canEditMemberRole } from "@/lib/permissions";
import { FormState, SESSION_EXPIRED, formValues, invalid } from "@/lib/forms";

// Departments: pastors and church admins create and rename; only church
// admins delete (departments_policies.sql enforces the same).

const nameSchema = z.object({
  name: z.string().trim().min(2, "Give the department a name.").max(60, "Keep the name under 60 characters."),
});

function friendlyDbError(message: string | undefined) {
  return message?.includes("duplicate") ? "A department with this name already exists." : "Couldn't save the department — please try again.";
}

/** Form fields: name */
export async function createDepartment(_prev: FormState, formData: FormData): Promise<FormState> {
  const me = await getCurrentAppUser();
  if (!me || !me.church_id || !can(me.role, "manageDepartments")) return { error: "Only church admins and pastors can create departments." };

  const parsed = nameSchema.safeParse({ name: formData.get("name") });
  if (!parsed.success) return invalid(parsed.error, formData);

  const supabase = createClient();
  const { data: department, error } = await supabase
    .from("departments")
    .insert({ church_id: me.church_id, name: parsed.data.name })
    .select("id")
    .single();
  if (error || !department) {
    if (!error?.message.includes("duplicate")) console.error("[departments] create failed:", error?.message);
    return { error: friendlyDbError(error?.message), fieldErrors: { name: friendlyDbError(error?.message) }, values: formValues(formData) };
  }

  // Every department gets its own chat channel. Not fatal if it fails — the
  // department exists — but say so.
  const { error: channelError } = await supabase
    .from("chat_channels")
    .insert({ church_id: me.church_id, department_id: department.id, name: parsed.data.name });
  if (channelError) console.error("[departments] chat channel failed:", channelError.message);

  await logAudit({ churchId: me.church_id, actorId: me.id, action: "department.created", targetTable: "departments", targetId: department.id });
  revalidatePath("/dashboard/departments");
  flash(channelError ? `${parsed.data.name} was created, but its chat channel couldn't be set up.` : `${parsed.data.name} was created.`, channelError ? "info" : "success");
  redirect(`/dashboard/departments/${department.id}`);
}

/** Form fields: department_id, name */
export async function renameDepartment(_prev: FormState, formData: FormData): Promise<FormState> {
  const me = await getCurrentAppUser();
  if (!me || !me.church_id || !can(me.role, "manageDepartments")) return { error: SESSION_EXPIRED };

  const id = z.string().uuid().safeParse(formData.get("department_id"));
  const parsed = nameSchema.safeParse({ name: formData.get("name") });
  if (!id.success) return { error: "That department couldn't be found." };
  if (!parsed.success) return invalid(parsed.error, formData);

  const supabase = createClient();
  const { data: updated, error } = await supabase
    .from("departments")
    .update({ name: parsed.data.name })
    .eq("id", id.data)
    .eq("church_id", me.church_id)
    .select("id");
  if (error) return { error: friendlyDbError(error.message), fieldErrors: { name: friendlyDbError(error.message) } };
  if (!updated?.length) return { error: "That department couldn't be found — it may have been deleted." };

  // Keep the department's chat channel name in step.
  await supabase.from("chat_channels").update({ name: parsed.data.name }).eq("department_id", id.data).eq("is_dm", false);

  revalidatePath("/dashboard/departments");
  revalidatePath(`/dashboard/departments/${id.data}`);
  flash("Department renamed.");
  return { ok: true };
}

/** Form fields: department_id. Church admins only. */
export async function deleteDepartment(_prev: FormState, formData: FormData): Promise<FormState> {
  const me = await getCurrentAppUser();
  if (!me || !me.church_id || !can(me.role, "deleteDepartments")) return { error: "Only a church admin can delete a department." };

  const id = z.string().uuid().safeParse(formData.get("department_id"));
  if (!id.success) return { error: "That department couldn't be found." };

  const supabase = createClient();
  const { data: deleted, error } = await supabase
    .from("departments")
    .delete()
    .eq("id", id.data)
    .eq("church_id", me.church_id)
    .select("id, name");
  if (error) {
    console.error("[departments] delete failed:", error.message);
    return { error: "Couldn't delete the department — please try again." };
  }
  if (!deleted?.length) return { error: "That department couldn't be found — it may already be deleted." };

  await logAudit({
    churchId: me.church_id,
    actorId: me.id,
    action: "department.deleted",
    targetTable: "departments",
    targetId: id.data,
    metadata: { name: deleted[0].name },
  });
  revalidatePath("/dashboard/departments");
  revalidatePath("/dashboard/members");
  flash(`${deleted[0].name} was deleted.`);
  redirect("/dashboard/departments");
}

// ---------------------------------------------------------------------------
// Managing who is in a department, from the department's own page.
// A person belongs to one department (app_users.department_id), so "add"
// moves them here from wherever they were. Same rules as editing a member:
// pastors and church admins (who may also move themselves); only a church
// admin changes another church admin (lib/permissions.ts canEditMemberRole). RLS and the
// app_users trigger enforce the same in the database.

export type DeptResult = { ok?: boolean; error?: string; skipped?: string[] } | null;

async function memberManager() {
  const me = await getCurrentAppUser();
  if (!me || !me.church_id) return { error: SESSION_EXPIRED } as const;
  if (!can(me.role, "manageMembers")) return { error: "Only pastors and church admins can change who's in a department." } as const;
  return { me: me as typeof me & { church_id: string } } as const;
}

/**
 * May `me` change this person's department? Pastors and church admins may
 * change their own (it doesn't change their role — the database allows it
 * too); for anyone else, the usual member-editing rule applies.
 */
function canMoveDepartment(me: { id: string; role: string }, person: { id: string; role: string }) {
  return person.id === me.id || canEditMemberRole(me, person);
}

async function loadDept(id: string, churchId: string) {
  const { data } = await createClient().from("departments").select("id, name").eq("id", id).eq("church_id", churchId).maybeSingle();
  return data;
}

/** Form fields: department_id, member_id (repeated). */
export async function addPeopleToDepartment(_prev: DeptResult, formData: FormData): Promise<DeptResult> {
  const auth = await memberManager();
  if ("error" in auth) return { error: auth.error };
  const { me } = auth;
  const deptId = z.string().uuid().safeParse(formData.get("department_id"));
  const ids = z.array(z.string().uuid()).min(1, "Tick at least one person.").max(200).safeParse(formData.getAll("member_id"));
  if (!deptId.success) return { error: "That department couldn't be found." };
  if (!ids.success) return { error: ids.error.issues[0]?.message ?? "Tick at least one person." };
  const dept = await loadDept(deptId.data, me.church_id);
  if (!dept) return { error: "That department couldn't be found." };

  const supabase = createClient();
  const { data: people } = await supabase.from("app_users").select("id, name, role, department_id").eq("church_id", me.church_id).in("id", ids.data);
  const skipped: string[] = [];
  let added = 0;
  for (const person of people ?? []) {
    if (person.department_id === dept.id) continue;
    if (!canMoveDepartment(me, person)) {
      skipped.push(person.name);
      continue;
    }
    const { error } = await supabase.from("app_users").update({ department_id: dept.id }).eq("id", person.id).eq("church_id", me.church_id);
    if (error) {
      console.error("[departments] add member failed:", error.message);
      skipped.push(person.name);
      continue;
    }
    added++;
    await logAudit({
      churchId: me.church_id,
      actorId: me.id,
      action: "member.role_changed",
      targetTable: "app_users",
      targetId: person.id,
      metadata: { from: { department_id: person.department_id }, to: { department_id: dept.id } },
    });
  }
  revalidatePath(`/dashboard/departments/${dept.id}`);
  revalidatePath("/dashboard/departments");
  revalidatePath("/dashboard/members");
  if (added) flash(`${added} ${added === 1 ? "person" : "people"} added to ${dept.name}.`);
  return { ok: true, skipped };
}

/** Form fields: department_id, member_id. Leaders become ordinary members (a leader needs a department). */
export async function removeFromDepartment(formData: FormData): Promise<void> {
  const auth = await memberManager();
  if ("error" in auth) return flash(auth.error!, "error");
  const { me } = auth;
  const deptId = z.string().uuid().safeParse(formData.get("department_id"));
  const memberId = z.string().uuid().safeParse(formData.get("member_id"));
  if (!deptId.success || !memberId.success) return flash("That person couldn't be found.", "error");

  const supabase = createClient();
  const { data: person } = await supabase.from("app_users").select("id, name, role, department_id").eq("id", memberId.data).eq("church_id", me.church_id).maybeSingle();
  if (!person || person.department_id !== deptId.data) return flash("They're not in this department any more — refresh the page.", "error");
  if (!canMoveDepartment(me, person)) return flash("Only a church admin can change a church admin's department.", "error");
  const newRole = person.role === "department_leader" ? "member" : person.role;
  const { error } = await supabase.from("app_users").update({ department_id: null, role: newRole }).eq("id", person.id).eq("church_id", me.church_id);
  if (error) {
    console.error("[departments] remove member failed:", error.message);
    return flash("Couldn't remove them — please try again.", "error");
  }
  await logAudit({
    churchId: me.church_id,
    actorId: me.id,
    action: "member.role_changed",
    targetTable: "app_users",
    targetId: person.id,
    metadata: { from: { role: person.role, department_id: person.department_id }, to: { role: newRole, department_id: null } },
  });
  revalidatePath(`/dashboard/departments/${deptId.data}`);
  revalidatePath("/dashboard/departments");
  revalidatePath("/dashboard/members");
  flash(`${person.name} was removed from the department.`);
}

/** Form fields: department_id, member_id, lead ("1" make leader, "0" step down to member). */
export async function setDepartmentLeader(formData: FormData): Promise<void> {
  const auth = await memberManager();
  if ("error" in auth) return flash(auth.error!, "error");
  const { me } = auth;
  const deptId = z.string().uuid().safeParse(formData.get("department_id"));
  const memberId = z.string().uuid().safeParse(formData.get("member_id"));
  const lead = formData.get("lead") === "1";
  if (!deptId.success || !memberId.success) return flash("That person couldn't be found.", "error");

  const supabase = createClient();
  const { data: person } = await supabase.from("app_users").select("id, name, role, department_id").eq("id", memberId.data).eq("church_id", me.church_id).maybeSingle();
  if (!person || person.department_id !== deptId.data) return flash("They're not in this department any more — refresh the page.", "error");
  if (!canEditMemberRole(me, person)) return flash(person.id === me.id ? "You can't change your own role." : "Only a church admin can change a church admin's role.", "error");
  // Pastors and admins keep their role; only members and leaders switch.
  if (!["member", "department_leader"].includes(person.role)) return flash(`${person.name} is a ${person.role.replace("_", " ")}, which already includes leading departments.`, "error");

  const newRole = lead ? "department_leader" : "member";
  const { error } = await supabase.from("app_users").update({ role: newRole }).eq("id", person.id).eq("church_id", me.church_id);
  if (error) {
    console.error("[departments] set leader failed:", error.message);
    return flash("Couldn't change their role — please try again.", "error");
  }
  await logAudit({
    churchId: me.church_id,
    actorId: me.id,
    action: "member.role_changed",
    targetTable: "app_users",
    targetId: person.id,
    metadata: { from: { role: person.role }, to: { role: newRole } },
  });
  revalidatePath(`/dashboard/departments/${deptId.data}`);
  revalidatePath("/dashboard/members");
  flash(lead ? `${person.name} now leads this department.` : `${person.name} is no longer a leader.`);
}
