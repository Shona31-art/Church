"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { getCurrentAppUser } from "@/lib/current-user";
import { logAudit } from "@/lib/audit";
import { flash } from "@/lib/flash";
import { can } from "@/lib/permissions";
import { churchNameSchema } from "@/lib/account-schemas";
import { phoneSchema } from "@/lib/member-schemas";
import { FormState, SESSION_EXPIRED, formValues, invalid, optionalField } from "@/lib/forms";
import { givingDetailsSchema } from "@/lib/giving";

const ProfileSchema = z.object({
  name: churchNameSchema,
  email: z.string().trim().toLowerCase().email("Enter a valid email address.").max(254).optional(),
  phone: phoneSchema,
  address: z.string().trim().max(300, "Keep the address under 300 characters.").optional(),
  logoUrl: z
    .string()
    .trim()
    .url("Paste a full link starting with https://")
    .refine((u) => u.startsWith("https://"), "The logo link must start with https://")
    .max(500)
    .optional(),
});

/** Church admins only (churches_update policy). Form fields: name, email?, phone?, address?, logo_url? */
export async function saveChurchProfile(_prev: FormState, formData: FormData): Promise<FormState> {
  const me = await getCurrentAppUser();
  if (!me || !me.church_id) return { error: SESSION_EXPIRED };
  if (!can(me.role, "manageChurchProfile")) return { error: "Only church admins can change the church profile." };

  const parsed = ProfileSchema.safeParse({
    name: formData.get("name"),
    email: optionalField(formData, "email"),
    phone: optionalField(formData, "phone"),
    address: optionalField(formData, "address"),
    logoUrl: optionalField(formData, "logo_url"),
  });
  if (!parsed.success) {
    const result = invalid(parsed.error, formData);
    if (result?.fieldErrors?.logoUrl) result.fieldErrors.logo_url = result.fieldErrors.logoUrl;
    return result;
  }

  const { data: updated, error } = await createClient()
    .from("churches")
    .update({
      name: parsed.data.name,
      email: parsed.data.email ?? null,
      phone: parsed.data.phone ?? null,
      address: parsed.data.address ?? null,
      logo_url: parsed.data.logoUrl ?? null,
    })
    .eq("id", me.church_id)
    .select("id");
  if (error || !updated?.length) {
    console.error("[setup] profile save failed:", error?.message);
    return { error: "Couldn't save the church profile — please try again." };
  }

  await logAudit({ churchId: me.church_id, actorId: me.id, action: "church.profile_updated", targetTable: "churches", targetId: me.church_id });
  revalidatePath("/dashboard", "layout");
  flash("Church profile saved.");
  redirect("/dashboard/setup");
}

/**
 * Church admins only. Saves the bank details members pay into (giving by
 * bank transfer, migration #30). The database also enforces admin-only and
 * the field rules, stamps who changed it, writes the audit log and notifies
 * every church admin.
 *
 * Form fields: account_name, bank_name, account_number, branch_code,
 * account_type, reference_prefix, expected_updated_at ("" when there are no
 * details yet). If someone else saved in the meantime, nothing is written.
 */
export async function saveGivingDetails(_prev: FormState, formData: FormData): Promise<FormState> {
  const me = await getCurrentAppUser();
  if (!me || !me.church_id) return { error: SESSION_EXPIRED };
  if (!can(me.role, "manageChurchProfile")) return { error: "Only church admins can change the bank details." };

  const parsed = givingDetailsSchema.safeParse({
    account_name: formData.get("account_name") ?? "",
    bank_name: formData.get("bank_name") ?? "",
    account_number: formData.get("account_number") ?? "",
    branch_code: formData.get("branch_code") ?? "",
    account_type: formData.get("account_type") ?? "",
    reference_prefix: formData.get("reference_prefix") ?? "",
  });
  if (!parsed.success) return invalid(parsed.error, formData);
  const expected = String(formData.get("expected_updated_at") ?? "");

  const supabase = createClient();
  const { data: saved, error } = expected
    ? await supabase.from("church_giving_details").update(parsed.data).eq("church_id", me.church_id).eq("updated_at", expected).select("church_id")
    : await supabase.from("church_giving_details").insert({ church_id: me.church_id, ...parsed.data }).select("church_id");

  if (error?.code === "23505" || (!error && !saved?.length)) {
    return { error: "Someone else changed the bank details while you were editing. Close this form and open it again to see the latest.", values: formValues(formData) };
  }
  if (error) {
    console.error("[setup] giving details save failed:", error.message);
    return { error: "Couldn't save the bank details — please try again. Nothing was changed.", values: formValues(formData) };
  }

  revalidatePath("/dashboard/setup");
  revalidatePath("/dashboard/giving");
  flash("Bank details saved. Every church admin has been notified of the change.");
  redirect("/dashboard/setup");
}
