"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { getCurrentAppUser } from "@/lib/current-user";
import { flash } from "@/lib/flash";
import { nameSchema, phoneSchema } from "@/lib/member-schemas";
import { passwordSchema } from "@/lib/account-schemas";
import { FormState, SESSION_EXPIRED, invalid, optionalField } from "@/lib/forms";
import { AVATAR_BUCKET, isOwnAvatarPath } from "@/lib/avatar-path";
import { verifyPassword } from "@/lib/supabase/verify-password";
import { logAudit } from "@/lib/audit";

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

/**
 * Start changing the sign-in email (docs/plans/email-change.md).
 * Form fields: new_email, current_password.
 *
 * Nothing changes yet: Supabase emails a confirmation link (to both the old
 * and the new address when "Secure email change" is on) and switches the
 * sign-in only once it's confirmed; migration #33 then updates app_users.
 */
export async function requestEmailChange(_prev: FormState, formData: FormData): Promise<FormState> {
  const me = await getCurrentAppUser();
  if (!me) return { error: SESSION_EXPIRED };

  const parsed = z
    .object({
      new_email: z.string().trim().toLowerCase().email("Enter a valid email address.").max(254, "That email is too long."),
      current_password: z.string().min(1, "Enter your current password."),
    })
    .safeParse({ new_email: formData.get("new_email") ?? "", current_password: formData.get("current_password") ?? "" });
  if (!parsed.success) {
    const result = invalid(parsed.error, formData);
    if (result?.values) delete result.values.current_password; // never echo a password back
    return result;
  }
  const keep = { new_email: parsed.data.new_email };
  if (parsed.data.new_email === me.email.toLowerCase()) {
    return { error: "That's already your email address.", fieldErrors: { new_email: "Enter a different address." }, values: keep };
  }

  const check = await verifyPassword(me.email, parsed.data.current_password);
  if (check === "wrong") return { error: "That password isn't right.", fieldErrors: { current_password: "Check your current password." }, values: keep };
  if (check === "limited") return { error: "Too many attempts. Wait a few minutes, then try again.", values: keep };
  if (check === "error") return { error: "We couldn't check your password just now — please try again.", values: keep };

  const appUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
  const { error } = await createClient().auth.updateUser({ email: parsed.data.new_email }, { emailRedirectTo: `${appUrl}/auth/confirm-email` });
  if (error) {
    console.error("[account] email change request failed:", error.message);
    const taken = /already|registered|exists/i.test(error.message);
    return {
      error: taken
        ? "That email address is already used by another account."
        : error.status === 429
          ? "Too many emails sent just now. Wait a few minutes, then try again."
          : "We couldn't start the change — please try again. Your email hasn't changed.",
      fieldErrors: taken ? { new_email: "Use a different address." } : undefined,
      values: keep,
    };
  }

  await logAudit({ churchId: me.church_id, actorId: me.id, action: "account.email_change_requested", targetTable: "app_users", targetId: me.id });
  revalidatePath("/dashboard/account");
  flash("Check your email. Confirm the change from the links we sent — your sign-in stays the same until you do.", "info");
  return { ok: true };
}

// ---------------------------------------------------------------------------
// Profile photo and "About" line (supabase/chat_v2.sql)
// ---------------------------------------------------------------------------

const MIGRATION_MISSING = "Profile photos need a database update first — ask your church admin to contact support.";

/**
 * Saves a photo the browser has already uploaded to Storage. Input: the
 * Storage path. The path must be in the caller's own folder (checked here,
 * by the Storage policy, and by the app_users trigger). The previous photo
 * file is removed afterwards.
 */
export async function setMyPhoto(path: string): Promise<{ error?: string }> {
  const me = await getCurrentAppUser();
  if (!me?.church_id) return { error: SESSION_EXPIRED };
  if (typeof path !== "string" || !isOwnAvatarPath(path, me.church_id, me.id)) {
    return { error: "That upload didn't work — please choose the photo again." };
  }

  const supabase = createClient();
  const { data: before } = await supabase.from("app_users").select("avatar_path").eq("id", me.id).maybeSingle();
  const { error } = await supabase.from("app_users").update({ avatar_path: path }).eq("id", me.id);
  if (error) {
    console.error("[account] photo update failed:", error.message);
    // Don't leave an orphaned file behind.
    await supabase.storage.from(AVATAR_BUCKET).remove([path]);
    return { error: error.code === "42703" ? MIGRATION_MISSING : "Couldn't save your photo — please try again." };
  }

  if (before?.avatar_path && before.avatar_path !== path) {
    const { error: removeError } = await supabase.storage.from(AVATAR_BUCKET).remove([before.avatar_path]);
    if (removeError) console.error("[account] old photo not removed:", removeError.message);
  }
  revalidatePath("/dashboard", "layout");
  return {};
}

/** Removes the caller's photo (record and file). */
export async function removeMyPhoto(): Promise<{ error?: string }> {
  const me = await getCurrentAppUser();
  if (!me) return { error: SESSION_EXPIRED };

  const supabase = createClient();
  const { data: before } = await supabase.from("app_users").select("avatar_path").eq("id", me.id).maybeSingle();
  const { error } = await supabase.from("app_users").update({ avatar_path: null }).eq("id", me.id);
  if (error) {
    console.error("[account] photo removal failed:", error.message);
    return { error: "Couldn't remove your photo — please try again." };
  }
  if (before?.avatar_path) await supabase.storage.from(AVATAR_BUCKET).remove([before.avatar_path]);
  revalidatePath("/dashboard", "layout");
  return {};
}

/** Form fields: about (optional, up to 140 characters). */
export async function updateMyAbout(_prev: FormState, formData: FormData): Promise<FormState> {
  const me = await getCurrentAppUser();
  if (!me) return { error: SESSION_EXPIRED };

  const parsed = z
    .string()
    .trim()
    .max(140, "Keep it to 140 characters or fewer.")
    .transform((v) => v || null)
    .safeParse(formData.get("about") ?? "");
  if (!parsed.success) return { error: "Please fix the highlighted field.", fieldErrors: { about: parsed.error.issues[0].message } };

  const { error } = await createClient().from("app_users").update({ about: parsed.data }).eq("id", me.id);
  if (error) {
    console.error("[account] about update failed:", error.message);
    return { error: error.code === "42703" ? MIGRATION_MISSING : "Couldn't save — please try again." };
  }
  revalidatePath("/dashboard", "layout");
  flash("Saved.");
  return { ok: true };
}

/** Form fields: dm_privacy (everyone | leaders | nobody), share_read_receipts (checkbox). */
export async function updateChatPrivacy(_prev: FormState, formData: FormData): Promise<FormState> {
  const me = await getCurrentAppUser();
  if (!me) return { error: SESSION_EXPIRED };

  const parsed = z
    .object({ dmPrivacy: z.enum(["everyone", "leaders", "nobody"]), receipts: z.boolean() })
    .safeParse({ dmPrivacy: formData.get("dm_privacy"), receipts: formData.get("share_read_receipts") === "on" });
  if (!parsed.success) return { error: "Choose who can message you." };

  const { error } = await createClient()
    .from("app_users")
    .update({ dm_privacy: parsed.data.dmPrivacy, share_read_receipts: parsed.data.receipts })
    .eq("id", me.id);
  if (error) {
    console.error("[account] chat privacy update failed:", error.message);
    return { error: error.code === "42703" ? MIGRATION_MISSING : "Couldn't save — please try again." };
  }
  revalidatePath("/dashboard/account");
  flash("Chat privacy saved.");
  return { ok: true };
}
