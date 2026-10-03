"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { provisionChurch } from "@/lib/provision";
import { registerSchema } from "@/lib/account-schemas";
import { FormState, formValues, invalid, optionalField } from "@/lib/forms";

const APP_URL = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";

/**
 * Self-service sign-up: creates the login and the church in ONE server
 * request, so the account the church is attached to is always the one just
 * created here. (The previous version exported a provisioning action that
 * accepted any user id from the browser.)
 *
 * Form fields: church_name, admin_name, email, phone?, password,
 * confirm_password, website (honeypot — must be empty).
 * Returns { ok: true } with values.email when email confirmation is needed;
 * otherwise signs the person in and redirects to setup.
 * Abuse protection: Supabase Auth rate-limits sign-ups per IP; the honeypot
 * stops simple bots.
 */
export async function registerChurch(_prev: FormState, formData: FormData): Promise<FormState> {
  // Bots fill every field; people never see this one.
  if (optionalField(formData, "website")) return { ok: true, values: { email: "" } };

  const parsed = registerSchema.safeParse({
    churchName: formData.get("church_name"),
    adminName: formData.get("admin_name"),
    email: formData.get("email"),
    phone: optionalField(formData, "phone"),
    password: formData.get("password") ?? "",
    confirmPassword: formData.get("confirm_password") ?? "",
  });
  if (!parsed.success) {
    const result = invalid(parsed.error, formData);
    const map: Record<string, string> = { churchName: "church_name", adminName: "admin_name", confirmPassword: "confirm_password" };
    if (result?.fieldErrors) result.fieldErrors = Object.fromEntries(Object.entries(result.fieldErrors).map(([k, v]) => [map[k] ?? k, v]));
    if (result?.values) {
      delete result.values.password;
      delete result.values.confirm_password;
    }
    return result;
  }
  const input = parsed.data;
  const values = formValues(formData);
  delete values.password;
  delete values.confirm_password;

  const supabase = createClient();
  const { data, error } = await supabase.auth.signUp({
    email: input.email,
    password: input.password,
    options: { emailRedirectTo: `${APP_URL}/login`, data: { name: input.adminName } },
  });

  if (error || !data.user) {
    console.error("[register] sign-up failed:", error?.message);
    return {
      error:
        error?.status === 429
          ? "Too many sign-up attempts. Please wait a few minutes and try again."
          : /already/i.test(error?.message ?? "")
          ? "An account with this email already exists. Sign in instead, or reset your password."
          : "We couldn't create your account. Check your details and try again.",
      values,
    };
  }
  // Supabase hides existing accounts by returning a user with no identities.
  if (!data.user.identities?.length) {
    return { error: "An account with this email already exists. Sign in instead, or reset your password.", values };
  }

  const result = await provisionChurch({
    userId: data.user.id,
    churchName: input.churchName,
    adminName: input.adminName,
    email: input.email,
    phone: input.phone,
  });
  if (!result.ok) {
    // Remove the login too, so they can simply try again with the same email.
    await createAdminClient().auth.admin.deleteUser(data.user.id);
    await supabase.auth.signOut();
    return { error: result.error, values };
  }

  if (!data.session) return { ok: true, values: { email: input.email } };
  redirect("/dashboard/setup");
}
