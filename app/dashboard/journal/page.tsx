import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { decryptJournalContent } from "@/lib/encryption";
import { moduleGate } from "@/lib/gate";

export default async function JournalPage() {
  const gate = await moduleGate("journal");
  if (gate) return gate;

  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // RLS already restricts this to rows where user_id = auth.uid() — this
  // query cannot return anyone else's entries even if the code had a bug,
  // because the database itself enforces it.
  const { data: entries } = await supabase
    .from("journal_entries")
    .select("*")
    .eq("user_id", user!.id)
    .order("entry_date", { ascending: false });

  const decrypted = (entries || []).map((e) => ({
    ...e,
    content: decryptJournalContent({
      encrypted_content: Buffer.from(e.encrypted_content),
      iv: Buffer.from(e.iv),
      auth_tag: Buffer.from(e.auth_tag),
    }),
  }));

  return (
    <div className="max-w-2xl">
      <div className="flex items-center justify-between mb-2">
        <h1 className="text-2xl font-semibold">My Journal</h1>
        <Link
          href="/dashboard/journal/new"
          className="bg-ember text-white px-4 py-2 rounded-lg text-sm font-medium"
        >
          + New entry
        </Link>
      </div>
      <p className="text-xs text-ink/40 mb-6">
        🔒 Private by default. Only you can read these — not your pastor, not
        your church admin, not the platform owner.
      </p>

      {!decrypted.length && (
        <p className="text-ink/40 text-sm">No entries yet. Start writing whenever you're ready.</p>
      )}

      <div className="space-y-4">
        {decrypted.map((entry) => (
          <div key={entry.id} className="border border-ink/10 rounded-xl p-4 bg-white/60">
            <p className="text-xs text-ink/40 mb-1">{entry.entry_date}</p>
            <p className="whitespace-pre-wrap">{entry.content}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
