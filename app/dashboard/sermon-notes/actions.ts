"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { getCurrentAppUser } from "@/lib/current-user";
import { checkModuleAccess } from "@/lib/paywall";
import { can } from "@/lib/permissions";
import { flash } from "@/lib/flash";
import { FormState, SESSION_EXPIRED, formValues, invalid } from "@/lib/forms";
import { encryptJournalContent, isJournalEncryptionConfigured, toBytea } from "@/lib/encryption";
import { fillOutline } from "@/lib/sermon-notes";
import { formatDate } from "@/lib/format";

const schema = z.object({
  title: z.string().trim().min(1, "Give the sermon a title.").max(160),
  speaker: z.string().trim().max(120).transform((v) => v || null),
  sermonDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Choose the date."),
  scripture: z.string().trim().max(200).transform((v) => v || null),
  body: z.string().trim().min(1, "Write the notes.").max(20000, "Keep the notes under 20,000 characters."),
  published: z.boolean(),
});

/** Pastors: add or edit. Form fields: id?, title, speaker?, sermon_date, scripture?, body, published */
export async function saveOutline(_prev: FormState, formData: FormData): Promise<FormState> {
  const me = await getCurrentAppUser();
  if (!me?.church_id || !can(me.role, "manageSermons")) return { error: SESSION_EXPIRED, values: formValues(formData) };
  if (!(await checkModuleAccess("sermon_notes")).allowed) return { error: "Sermon notes aren't on your church's plan." };
  const parsed = schema.safeParse({
    title: formData.get("title") ?? "",
    speaker: formData.get("speaker") ?? "",
    sermonDate: formData.get("sermon_date") ?? "",
    scripture: formData.get("scripture") ?? "",
    body: formData.get("body") ?? "",
    published: formData.get("published") === "on",
  });
  if (!parsed.success) {
    const r = invalid(parsed.error, formData);
    if (r?.fieldErrors?.sermonDate) r.fieldErrors.sermon_date = r.fieldErrors.sermonDate;
    return r;
  }
  const id = z.string().uuid().safeParse(formData.get("id"));
  const row = { title: parsed.data.title, speaker: parsed.data.speaker, sermon_date: parsed.data.sermonDate, scripture: parsed.data.scripture, body: parsed.data.body, published: parsed.data.published };
  const supabase = createClient();
  const { data, error } = id.success
    ? await supabase.from("sermon_outlines").update(row).eq("id", id.data).eq("church_id", me.church_id).select("id").single()
    : await supabase.from("sermon_outlines").insert({ ...row, church_id: me.church_id, created_by: me.id }).select("id").single();
  if (error || !data) {
    console.error("[sermon-notes] save failed:", error?.message);
    return { error: "Couldn't save — please try again. Your notes are still here.", values: formValues(formData) };
  }
  revalidatePath("/dashboard/sermon-notes");
  flash(parsed.data.published ? "Saved — the church can see these notes." : "Saved as a draft. Tick “Show to the church” when you're ready.");
  redirect(`/dashboard/sermon-notes/${data.id}`);
}

/** Pastors. Form fields: id */
export async function deleteOutline(formData: FormData): Promise<void> {
  const me = await getCurrentAppUser();
  const id = z.string().uuid().safeParse(formData.get("id"));
  if (!me?.church_id || !id.success || !can(me.role, "manageSermons")) return;
  const { error } = await createClient().from("sermon_outlines").delete().eq("id", id.data).eq("church_id", me.church_id);
  if (error) {
    flash("Couldn't delete — please try again.", "error");
    return;
  }
  revalidatePath("/dashboard/sermon-notes");
  flash("Sermon notes deleted. Copies in people's journals stay.");
  redirect("/dashboard/sermon-notes");
}

/**
 * A member keeps their filled-in notes: a new private journal entry
 * (encrypted, like every journal entry). Form fields: id, answers (JSON array), thoughts?
 */
export async function keepInJournal(_prev: FormState, formData: FormData): Promise<FormState> {
  const me = await getCurrentAppUser();
  if (!me?.church_id) return { error: SESSION_EXPIRED };
  if (!(await checkModuleAccess("journal")).allowed) return { error: "The journal isn't on your church's plan, so the notes can't be kept there." };
  if (!isJournalEncryptionConfigured()) return { error: "The journal isn't set up yet (missing encryption key). Ask your church admin to contact support." };
  const id = z.string().uuid().safeParse(formData.get("id"));
  let answers: string[] = [];
  try {
    answers = z.array(z.string().max(200)).max(200).parse(JSON.parse(String(formData.get("answers") ?? "[]")));
  } catch {
    return { error: "Couldn't read your answers — please try again." };
  }
  const thoughts = String(formData.get("thoughts") ?? "").trim().slice(0, 5000);
  if (!id.success) return { error: "Those notes couldn't be found." };
  const { data: outline } = await createClient().from("sermon_outlines").select("title, speaker, sermon_date, scripture, body").eq("id", id.data).maybeSingle();
  if (!outline) return { error: "Those notes couldn't be found." };

  const text = [
    `Sermon notes: ${outline.title}`,
    [formatDate(outline.sermon_date, { weekday: undefined, month: "long" }), outline.speaker, outline.scripture].filter(Boolean).join(" · "),
    "",
    fillOutline(outline.body, answers),
    ...(thoughts ? ["", "My thoughts", thoughts] : []),
  ].join("\n");

  const { encrypted_content, iv, auth_tag } = encryptJournalContent(text);
  const { error } = await createClient()
    .from("journal_entries")
    .insert({ user_id: me.id, church_id: me.church_id, encrypted_content: toBytea(encrypted_content), iv: toBytea(iv), auth_tag: toBytea(auth_tag), has_scripture_ref: Boolean(outline.scripture) });
  if (error) {
    console.error("[sermon-notes] journal save failed:", error.message);
    return { error: "Couldn't save to your journal — please try again." };
  }
  revalidatePath("/dashboard/journal");
  return { ok: true };
}
