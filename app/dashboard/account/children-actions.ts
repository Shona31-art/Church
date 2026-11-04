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

const optionalId = z.union([z.string().uuid(), z.literal("")]).transform((v) => v || null);
const optionalName = z
  .string()
  .trim()
  .max(80, "Keep names to 80 characters or fewer.")
  .transform((v) => v || null);

const childSchema = z.object({
  /** Who the child is filed under; empty on Members → Children (then the first parent who's a member). */
  parentId: optionalId,
  motherId: optionalId,
  motherName: optionalName,
  fatherId: optionalId,
  fatherName: optionalName,
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

/**
 * Who may change a child: whoever they're filed under, either linked parent,
 * or a pastor/admin of the church. RLS enforces the same in the database.
 */
async function authorise(parentId: string, childId: string | null) {
  const me = await getCurrentAppUser();
  if (!me?.church_id) return null;
  if (can(me.role, "manageMembers")) {
    const { data: parent } = await createClient().from("app_users").select("id").eq("id", parentId).eq("church_id", me.church_id).maybeSingle();
    return parent ? me : null;
  }
  if (parentId === me.id) return me;
  if (childId) {
    // A linked parent editing a child someone else added (RLS: only visible to them if linked).
    const { data: child } = await createClient().from("member_children").select("id").eq("id", childId).maybeSingle();
    return child ? me : null;
  }
  return null;
}

function refresh(parentId: string) {
  revalidatePath("/dashboard/account");
  revalidatePath(`/dashboard/members/${parentId}`);
  revalidatePath("/dashboard/members/children");
  revalidatePath("/dashboard");
}

function friendlyError(error: { code?: string; message: string }) {
  if (error.code === "42P01") return MIGRATION_MISSING;
  if (/at most 20/.test(error.message)) return "You can list up to 20 children.";
  return "Couldn't save — please try again.";
}

/** Add or edit a child. Form fields: parent_id?, child_id? (edit), name, birth_date?, mother_id?, mother_name?, father_id?, father_name? */
export async function saveChild(_prev: FormState, formData: FormData): Promise<FormState> {
  const parsed = childSchema.safeParse({
    parentId: formData.get("parent_id") ?? "",
    motherId: formData.get("mother_id") ?? "",
    motherName: formData.get("mother_name") ?? "",
    fatherId: formData.get("father_id") ?? "",
    fatherName: formData.get("father_name") ?? "",
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
  if (input.motherId && input.motherId === input.fatherId) return { error: "The mother and father can't be the same person.", values: formValues(formData) };
  const parentId = input.parentId ?? input.motherId ?? input.fatherId;
  if (!parentId) return { error: "Choose the mother or the father from the members list.", fieldErrors: { mother_id: "Choose at least one parent who is a member." }, values: formValues(formData) };
  const me = await authorise(parentId, input.childId);
  if (!me) return { error: SESSION_EXPIRED };

  const supabase = createClient();
  const parents = {
    mother_id: input.motherId,
    mother_name: input.motherId ? null : input.motherName,
    father_id: input.fatherId,
    father_name: input.fatherId ? null : input.fatherName,
  };
  const write = (withParents: boolean) => {
    const fields = { name: input.name, birth_date: input.birthDate, updated_by: me.id, ...(withParents ? parents : {}) };
    return input.childId
      ? supabase.from("member_children").update(fields).eq("id", input.childId)
      : supabase.from("member_children").insert({ ...fields, user_id: parentId, church_id: me.church_id });
  };
  let { error } = await write(true);
  // Before member_children_v2.sql: save without the parents.
  if (error?.code === "42703" || error?.code === "PGRST204") ({ error } = await write(false));
  if (error) {
    console.error("[children] save failed:", error.message);
    return { error: friendlyError(error), values: formValues(formData) };
  }

  refresh(parentId);
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
  const me = await authorise(parsed.data.parentId, parsed.data.childId);
  if (!me) {
    flash(SESSION_EXPIRED, "error");
    return;
  }
  // By id: RLS lets the parent who added them, either linked parent, or a pastor/admin remove them.
  const { error } = await createClient().from("member_children").delete().eq("id", parsed.data.childId);
  if (error) {
    console.error("[children] remove failed:", error.message);
    flash("Couldn't remove that child — please try again.", "error");
    return;
  }
  refresh(parsed.data.parentId);
  flash("Removed.");
}
