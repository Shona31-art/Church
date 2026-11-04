import Link from "next/link";
import { ClipboardList, Plus } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { getCurrentAppUser } from "@/lib/current-user";
import { moduleGate } from "@/lib/gate";
import { can } from "@/lib/permissions";
import { formatDate } from "@/lib/format";
import { blankCount } from "@/lib/sermon-notes";
import { PageHeader } from "@/components/ui/PageHeader";
import { EmptyState } from "@/components/ui/EmptyState";
import { StatusBadge } from "@/components/ui/StatusBadge";

export const metadata = { title: "Sermon notes" };

export default async function SermonNotesPage() {
  const gate = await moduleGate("sermon_notes");
  if (gate) return gate;
  const me = (await getCurrentAppUser())!;
  const manage = can(me.role, "manageSermons");
  const { data } = await createClient()
    .from("sermon_outlines")
    .select("id, title, speaker, sermon_date, scripture, body, published")
    .eq("church_id", me.church_id)
    .order("sermon_date", { ascending: false })
    .limit(100);
  const notes = data ?? [];
  return (
    <div className="max-w-3xl space-y-5">
      <PageHeader
        back={{ href: "/dashboard", label: "Home" }}
        title="Sermon notes"
        description="Fill in the blanks as you listen, then keep the notes in your journal."
        actions={
          manage ? (
            <Link href="/dashboard/sermon-notes/new" className="btn-primary">
              <Plus aria-hidden className="h-4 w-4" /> New notes
            </Link>
          ) : undefined
        }
      />
      {!notes.length ? (
        <EmptyState icon={ClipboardList} title="No sermon notes yet" description={manage ? "Write this Sunday's notes with a few blanks for the church to fill in." : "Your pastor hasn't shared any notes yet."} />
      ) : (
        <ul className="space-y-3">
          {notes.map((n) => (
            <li key={n.id}>
              <Link href={`/dashboard/sermon-notes/${n.id}`} className="card-elevated block rounded-2xl p-4 hover:border-gold">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="font-semibold">{n.title}</p>
                  {!n.published && <StatusBadge tone="neutral">Draft</StatusBadge>}
                </div>
                <p className="text-sm text-ink/60">
                  {[formatDate(n.sermon_date), n.speaker, n.scripture, `${blankCount(n.body)} blanks`].filter(Boolean).join(" · ")}
                </p>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
