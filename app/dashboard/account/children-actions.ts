"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { getCurrentAppUser } from "@/lib/current-user";
import { can } from "@/lib/permissions";
import { flash } from "@/lib/flash";
import { FormState, SESSION_EXPIRED, formValues, invalid } from "@/lib/forms";

// A member's children (supabase/member_children.sql). The parent manages their
// own from My account; pastors and church admins can manage any member's from
// the member profile. RLS enforces the same rule in the database.

const MIGRATION_MISSING = "Children can be added once your church's database update is installed — ask your church admin to contact support.";

const childSchema = z.object({
  parentId: z.string().uuid(),
  childId: z.union([z.string().uuid(), z.literal("")]).transform((v) => v || null),
  name: z.string().trim().min(1, "Enter your child's name.").max(80, "Keep the name to 80 characters or fewer."),
  birthDate: z
    .union([
      z
        .string()
        .regex(/^\d{4}-\d{2}-\d{2}$/, "Use a valid date.")
        .refine((d) => d >= "1900-01-01" && d <= new Date().toISOString().slice(0, 10), "Birthdays can't be in the future."),
      z.literal(""),
    ])
    .transform((v) => v || null),
});

/** Who may change this parent's children: the parent, or a pastor/admin of their church. */
async function authorise(parentId: string) {
  const me = await getCurrentAppUser();
  if (!me?.church_id) return null;
  if (parentId === me.id) return me;
  if (!can(me.role, "manageMembers")) return null;
  const { data: parent } = await createClient().from("app_users").select("id").eq("id", parentId).eq("church_id", me.church_id).maybeSingle();
  return parent ? me : null;
}

function refresh(parentId: string) {
  revalidatePath("/dashboard/account");
  revalidatePath(`/dashboard/members/${parentId}`);
  revalidatePath("/dashboard");
}

function friendlyError(error: { code?: string; message: string }) {
  if (error.code === "42P01") return MIGRATION_MISSING;
  if (/at most 20/.test(error.message)) return "You can list up to 20 children.";
  return "Couldn't save — please try again.";
}

/** Add or edit a child. Form fields: parent_id, child_id? (edit), name, birth_date? */
export async function saveChild(_prev: FormState, formData: FormData): Promise<FormState> {
  const parsed = childSchema.safeParse({
    parentId: formData.get("parent_id"),
    childId: formData.get("child_id") ?? "",
    name: formData.get("name") ?? "",
    birthDate: formData.get("birth_date") ?? "",
  });
  if (!parsed.success) {
    const result = invalid(parsed.error, formData);
    if (result?.fieldErrors?.birthDate) result.fieldErrors.birth_date = result.fieldErrors.birthDate;
    return result;
  }
  const input = parsed.data;
  const me = await authorise(input.parentId);
  if (!me) return { error: SESSION_EXPIRED };

  const supabase = createClient();
  const { error } = input.childId
    ? await supabase
        .from("member_children")
        .update({ name: input.name, birth_date: input.birthDate, updated_by: me.id })
        .eq("id", input.childId)
        .eq("user_id", input.parentId)
    : await supabase
        .from("member_children")
        .insert({ user_id: input.parentId, church_id: me.church_id, name: input.name, birth_date: input.birthDate, updated_by: me.id });
  if (error) {
    console.error("[children] save failed:", error.message);
    return { error: friendlyError(error), values: formValues(formData) };
  }

  refresh(input.parentId);
  flash(input.childId ? `${input.name}'s details were saved.` : `${input.name} was added.`);
  return { ok: true };
}

/** Remove a child. Form fields: parent_id, child_id */
export async function removeChild(formData: FormData): Promise<void> {
  const parsed = z.object({ parentId: z.string().uuid(), childId: z.string().uuid() }).safeParse({
    parentId: formData.get("parent_id"),
    childId: formData.get("child_id"),
  });
  if (!parsed.success) return;
  const me = await authorise(parsed.data.parentId);
  if (!me) {
    flash(SESSION_EXPIRED, "error");
    return;
  }
  const { error } = await createClient().from("member_children").delete().eq("id", parsed.data.childId).eq("user_id", parsed.data.parentId);
  if (error) {
    console.error("[children] remove failed:", error.message);
    flash("Couldn't remove that child — please try again.", "error");
    return;
  }
  refresh(parsed.data.parentId);
  flash("Removed.");
}
