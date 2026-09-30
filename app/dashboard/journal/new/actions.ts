"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { encryptJournalContent } from "@/lib/encryption";
import { getCurrentAppUser } from "@/lib/current-user";

export async function createJournalEntry(
  _prevState: { error?: string } | null,
  formData: FormData
): Promise<{ error?: string } | null> {
  const me = await getCurrentAppUser();
  if (!me) return { error: "Not signed in." };

  const content = String(formData.get("content") || "").trim();
  if (!content) return { error: "Write something before saving." };

  const supabase = createClient();
  const { encrypted_content, iv, auth_tag } = encryptJournalContent(content);

  const { error } = await supabase.from("journal_entries").insert({
    user_id: me.id,
    church_id: me.church_id,
    encrypted_content,
    iv,
    auth_tag,
  });

  if (error) return { error: "Couldn't save your entry — try again." };

  redirect("/dashboard/journal");
}
