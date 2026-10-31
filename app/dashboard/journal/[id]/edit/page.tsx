import { notFound } from "next/navigation";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { getCurrentAppUser } from "@/lib/current-user";
import { moduleGate } from "@/lib/gate";
import { isJournalEncryptionConfigured, readJournalRow } from "@/lib/encryption";
import { formatDate } from "@/lib/format";
import { PageHeader } from "@/components/ui/PageHeader";
import { Alert } from "@/components/ui/Alert";
import { EditEntryForm } from "../../JournalForms";

export default async function EditJournalEntryPage({ params }: { params: { id: string } }) {
  const gate = await moduleGate("journal");
  if (gate) return gate;
  if (!z.string().uuid().safeParse(params.id).success) notFound();

  const me = (await getCurrentAppUser())!;
  // RLS limits this to the author's own entries; the user_id check says so explicitly.
  const { data: entry } = await createClient()
    .from("journal_entries")
    .select("id, encrypted_content, iv, auth_tag, entry_date, created_at")
    .eq("id", params.id)
    .eq("user_id", me.id)
    .maybeSingle();
  if (!entry) notFound();
  const content = isJournalEncryptionConfigured() ? readJournalRow(entry) : null;

  return (
    <div className="max-w-3xl">
      <PageHeader title="Edit entry" description={`Written ${formatDate(entry.entry_date ?? entry.created_at)}`} back={{ href: "/dashboard/journal", label: "My journal" }} />
      {content === null ? (
        <Alert tone="error" title="This entry can't be unlocked">It may have been written with a different encryption key, so it can't be edited. You can still delete it.</Alert>
      ) : (
        <EditEntryForm id={entry.id} content={content} />
      )}
    </div>
  );
}
