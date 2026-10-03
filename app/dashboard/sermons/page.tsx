import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { getCurrentAppUser } from "@/lib/current-user";
import { moduleGate } from "@/lib/gate";
import { can } from "@/lib/permissions";
import { formatDate } from "@/lib/format";
import { PAGE_SIZE, buildQuery, orFilterPattern, pageFrom } from "@/lib/list";
import { PageHeader } from "@/components/ui/PageHeader";
import { FilterBar } from "@/components/ui/FilterBar";
import { Pagination } from "@/components/ui/Pagination";
import { EmptyState } from "@/components/ui/EmptyState";
import { Alert } from "@/components/ui/Alert";

export default async function SermonsPage({ searchParams }: { searchParams: { q?: string; page?: string } }) {
  const gate = await moduleGate("sermon_ai");
  if (gate) return gate;

  const me = (await getCurrentAppUser())!;
  const q = (searchParams.q ?? "").trim().slice(0, 80);
  const page = pageFrom(searchParams.page);

  let query = createClient()
    .from("sermons")
    .select("id, title, speaker, sermon_date, ai_summary, video_url, audio_url")
    .eq("church_id", me.church_id)
    .order("sermon_date", { ascending: false })
    .range(page * PAGE_SIZE, page * PAGE_SIZE + PAGE_SIZE);
  if (q) query = query.or(`title.ilike.${orFilterPattern(q)},speaker.ilike.${orFilterPattern(q)}`);
  const { data, error } = await query;
  if (error) console.error("[sermons] list failed:", error.message);

  const sermons = (data ?? []).slice(0, PAGE_SIZE);
  const canCreate = can(me.role, "manageSermons");
  const addButton = canCreate ? (
    <Link href="/dashboard/sermons/new" className="btn-primary">
      Add sermon
    </Link>
  ) : null;

  return (
    <div className="max-w-3xl">
      <PageHeader title="Sermons" description="Past messages with study notes for small groups, and your own private notes." actions={addButton} />
      <FilterBar query={q} placeholder="Search by title or speaker…" label="Search sermons" resetHref="/dashboard/sermons" active={Boolean(q)} />

      {error ? (
        <Alert tone="error" title="Couldn't load sermons">Refresh the page to try again.</Alert>
      ) : sermons.length === 0 ? (
        q ? (
          <EmptyState title="No sermons match that search" />
        ) : (
          <EmptyState
            icon="🎤"
            title="No sermons yet"
            description={canCreate ? "Add last Sunday's message so members can revisit it during the week." : "Sermons your church shares will appear here."}
            action={addButton}
          />
        )
      ) : (
        <ul className="space-y-2">
          {sermons.map((s) => (
            <li key={s.id}>
              <Link href={`/dashboard/sermons/${s.id}`} className="card-elevated rounded-xl p-4 block hover:border-gold/60">
                <p className="font-semibold">{s.title}</p>
                <p className="text-sm text-ink/60">
                  {s.speaker ? `${s.speaker} · ` : ""}
                  {formatDate(s.sermon_date)}
                  {s.video_url ? " · Video" : s.audio_url ? " · Audio" : ""}
                </p>
                {s.ai_summary && <p className="text-sm text-ink/70 mt-2 line-clamp-2">{s.ai_summary}</p>}
              </Link>
            </li>
          ))}
        </ul>
      )}
      <Pagination page={page} hasMore={(data?.length ?? 0) > PAGE_SIZE} hrefFor={(p) => buildQuery({ q, page: p })} />
    </div>
  );
}
