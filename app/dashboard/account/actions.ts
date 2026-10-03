"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { getCurrentAppUser } from "@/lib/current-user";
import { flash } from "@/lib/flash";
import { nameSchema, phoneSchema } from "@/lib/member-schemas";
import { passwordSchema } from "@/lib/account-schemas";
import { FormState, SESSION_EXPIRED, invalid, optionalField } from "@/lib/forms";

// Self-service account changes. RLS lets people update their own name and
// phone; the security trigger stops anyone changing their own role, status,
// church or email this way.

/** Form fields: name, phone?, birth_date? */
export async function updateMyProfile(_prev: FormState, formData: FormData): Promise<FormState> {
  const me = await getCurrentAppUser();
  if (!me) return { error: SESSION_EXPIRED };

  const parsed = z
    .object({
      name: nameSchema,
      phone: phoneSchema,
      birthDate: z
        .union([z.string().regex(/^\d{4}-\d{2}-\d{2}$/).refine((d) => d >= "1900-01-01" && d <= new Date().toISOString().slice(0, 10), "Birthdays can't be in the future."), z.literal("")])
        .transform((v) => v || null),
    })
    .safeParse({ name: formData.get("name"), phone: optionalField(formData, "phone"), birthDate: formData.get("birth_date") ?? "" });
  if (!parsed.success) {
    const result = invalid(parsed.error, formData);
    if (result?.fieldErrors?.birthDate) result.fieldErrors.birth_date = result.fieldErrors.birthDate;
    return result;
  }

  const supabase = createClient();
  const { error } = await supabase.from("app_users").update({ name: parsed.data.name, phone: parsed.data.phone ?? null }).eq("id", me.id);
  if (error) {
    console.error("[account] profile update failed:", error.message);
    return { error: "Couldn't save your details — please try again." };
  }

  if (me.church_id) {
    const { error: bdayError } = parsed.data.birthDate
      ? await supabase.from("member_birthdays").upsert({ user_id: me.id, church_id: me.church_id, birth_date: parsed.data.birthDate, updated_by: me.id })
      : await supabase.from("member_birthdays").delete().eq("user_id", me.id);
    if (bdayError) return { error: "Your name and phone were saved, but your birthday couldn't be — please try again." };
  }

  revalidatePath("/dashboard", "layout");
  flash("Your details were saved.");
  return { ok: true };
}

/** Form fields: password, confirm_password */
export async function changeMyPassword(_prev: FormState, formData: FormData): Promise<FormState> {
  const me = await getCurrentAppUser();
  if (!me) return { error: SESSION_EXPIRED };

  const parsed = z
    .object({ password: passwordSchema, confirm: z.string() })
    .refine((v) => v.password === v.confirm, { message: "The passwords don't match.", path: ["confirm"] })
    .safeParse({ password: formData.get("password") ?? "", confirm: formData.get("confirm_password") ?? "" });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Check your new password." };

  const { error } = await createClient().auth.updateUser({ password: parsed.data.password });
  if (error) {
    console.error("[account] password change failed:", error.message);
    return {
      error: /same/i.test(error.message)
        ? "Choose a password you haven't used before."
        : /reauthent|recent/i.test(error.message)
        ? "For security, sign out and back in, then change your password."
        : "Couldn't change your password — please try again.",
    };
  }
  flash("Password changed.");
  return { ok: true };
}
