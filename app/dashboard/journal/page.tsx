import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { getCurrentAppUser } from "@/lib/current-user";
import { moduleGate } from "@/lib/gate";
import { readJournalRow, isJournalEncryptionConfigured } from "@/lib/encryption";
import { formatDate } from "@/lib/format";
import { PAGE_SIZE, buildQuery, pageFrom } from "@/lib/list";
import { PageHeader } from "@/components/ui/PageHeader";
import { EmptyState } from "@/components/ui/EmptyState";
import { Alert } from "@/components/ui/Alert";
import { Pagination } from "@/components/ui/Pagination";
import { DeleteEntry } from "./JournalForms";
import { NAV_ICONS } from "@/components/ui/NavIcon";

export default async function JournalPage({ searchParams }: { searchParams: { page?: string } }) {
  const gate = await moduleGate("journal");
  if (gate) return gate;

  const me = (await getCurrentAppUser())!;
  const page = pageFrom(searchParams.page);
  const configured = isJournalEncryptionConfigured();

  // RLS restricts this to the author's own rows — no admin can read them.
  const { data, error } = await createClient()
    .from("journal_entries")
    .select("id, encrypted_content, iv, auth_tag, entry_date, created_at")
    .eq("user_id", me.id)
    .order("created_at", { ascending: false })
    .range(page * PAGE_SIZE, page * PAGE_SIZE + PAGE_SIZE);
  if (error) console.error("[journal] load failed:", error.message);

  const entries = (data ?? []).slice(0, PAGE_SIZE).map((e) => ({ id: e.id, date: e.entry_date ?? e.created_at, content: configured ? readJournalRow(e) : null }));
  const newButton = (
    <Link href="/dashboard/journal/new" className="btn-primary">
      New entry
    </Link>
  );

  return (
    <div className="max-w-3xl">
      <PageHeader
        title="My journal"
        description="🔒 Private and encrypted. Only you can read these — not your pastor, not your church admin, not the platform owner."
        actions={configured ? newButton : null}
      />

      {!configured && (
        <Alert tone="warning" title="The journal isn't set up yet" className="mb-4">
          The app is missing its journal encryption key, so entries can&apos;t be written or read. Your church admin should contact support.
        </Alert>
      )}
      {error ? (
        <Alert tone="error">Couldn&apos;t load your journal — refresh the page to try again.</Alert>
      ) : entries.length === 0 ? (
        <EmptyState icon={NAV_ICONS.journal} title="No entries yet" description="Start writing whenever you're ready. This is just between you and God." action={configured ? newButton : undefined} />
      ) : (
        <ul className="space-y-3">
          {entries.map((entry) => (
            <li key={entry.id} className="card-elevated rounded-2xl p-5">
              <div className="flex items-center justify-between gap-3 mb-2">
                <p className="text-xs font-semibold text-ink/60">{formatDate(entry.date)}</p>
                <DeleteEntry id={entry.id} />
              </div>
              {entry.content !== null ? (
                <p className="whitespace-pre-wrap leading-relaxed">{entry.content}</p>
              ) : (
                <p className="text-sm text-ink/60">This entry couldn&apos;t be unlocked. It may have been written with a different encryption key.</p>
              )}
            </li>
          ))}
        </ul>
      )}
      <Pagination page={page} hasMore={(data?.length ?? 0) > PAGE_SIZE} hrefFor={(p) => buildQuery({ page: p })} />
    </div>
  );
}
