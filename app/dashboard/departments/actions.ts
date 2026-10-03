"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { getCurrentAppUser } from "@/lib/current-user";
import { logAudit } from "@/lib/audit";
import { flash } from "@/lib/flash";
import { can } from "@/lib/permissions";
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
