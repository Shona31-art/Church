"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { getCurrentAppUser } from "@/lib/current-user";
import { checkModuleAccess } from "@/lib/paywall";
import { encryptJournalContent, isJournalEncryptionConfigured, toBytea } from "@/lib/encryption";
import { flash } from "@/lib/flash";
import { FormState, SESSION_EXPIRED, formValues } from "@/lib/forms";

// The journal is private to its author: RLS has no admin bypass, and the
// text is encrypted before it reaches the database (lib/encryption.ts).

/** Form fields: content */
export async function createJournalEntry(_prev: FormState, formData: FormData): Promise<FormState> {
  const me = await getCurrentAppUser();
  if (!me || !me.church_id) return { error: SESSION_EXPIRED, values: formValues(formData) };
  if (!(await checkModuleAccess("journal")).allowed) return { error: "The journal isn't available on your church's plan." };
  if (!isJournalEncryptionConfigured()) {
    return { error: "The journal isn't set up yet (missing encryption key). Your church admin needs to contact support.", values: formValues(formData) };
  }

  const parsed = z
    .string()
    .trim()
    .min(1, "Write something before saving.")
    .max(20_000, "That entry is very long — split it into two (20,000 characters max).")
    .safeParse(formData.get("content"));
  if (!parsed.success) return { error: parsed.error.issues[0]?.message, values: formValues(formData) };

  const { encrypted_content, iv, auth_tag } = encryptJournalContent(parsed.data);
  const { error } = await createClient().from("journal_entries").insert({
    user_id: me.id,
    church_id: me.church_id,
    // bytea via PostgREST must be a hex literal; a raw Buffer would be stored as JSON text.
    encrypted_content: toBytea(encrypted_content),
    iv: toBytea(iv),
    auth_tag: toBytea(auth_tag),
  });
  if (error) {
    console.error("[journal] save failed:", error.message);
    return { error: "Couldn't save your entry — please try again. Your words are still here.", values: formValues(formData) };
  }

  revalidatePath("/dashboard/journal");
  flash("Journal entry saved.");
  redirect("/dashboard/journal");
}

/** Form fields: entry_id */
export async function deleteJournalEntry(_prev: FormState, formData: FormData): Promise<FormState> {
  const me = await getCurrentAppUser();
  if (!me) return { error: SESSION_EXPIRED };
  const id = z.string().uuid().safeParse(formData.get("entry_id"));
  if (!id.success) return { error: "That entry couldn't be found." };

  const { data: deleted, error } = await createClient().from("journal_entries").delete().eq("id", id.data).eq("user_id", me.id).select("id");
  if (error || !deleted?.length) return { error: "Couldn't delete that entry — please try again." };
  revalidatePath("/dashboard/journal");
  flash("Entry deleted.");
  return { ok: true };
}
