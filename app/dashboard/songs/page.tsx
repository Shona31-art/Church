import Link from "next/link";
import { Music, Plus, Upload } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { PageHeader, Section } from "@/components/ui/PageHeader";
import { FilterBar } from "@/components/ui/FilterBar";
import { EmptyState } from "@/components/ui/EmptyState";
import { Alert } from "@/components/ui/Alert";
import { songLetter } from "@/lib/songs";
import { songAccess } from "./access";
import { WorshipTeamForm } from "./SongForms";

export default async function SongsPage({ searchParams }: { searchParams: { q?: string } }) {
  const access = await songAccess();
  if (!access) return null; // the dashboard layout already sends signed-out visitors to sign in
  const { me, canManage, worshipDepartmentId, notSetUp } = access;
  const shepherd = ["pastor", "church_admin"].includes(me.role);

  // Search titles, writers and lyrics. Characters that mean something to the query syntax are dropped.
  const q = (searchParams.q ?? "").replace(/[,()%_*\\]/g, " ").trim().slice(0, 80);
  const supabase = createClient();
  let query = supabase.from("songs").select("id, title, author, song_key").eq("church_id", me.church_id).order("title").limit(2000);
  if (q) query = query.or(`title.ilike.%${q}%,author.ilike.%${q}%,lyrics.ilike.%${q}%`);
  const [{ data: songs, error }, { data: departments }] = await Promise.all([
    notSetUp ? Promise.resolve({ data: [], error: null }) : query,
    shepherd ? supabase.from("departments").select("id, name").eq("church_id", me.church_id).order("name") : Promise.resolve({ data: [] }),
  ]);
  if (error) console.error("[songs] list failed:", error.message);

  const groups = new Map<string, NonNullable<typeof songs>>();
  for (const s of songs ?? []) {
    const letter = songLetter(s.title);
    groups.set(letter, [...(groups.get(letter) ?? []), s]);
  }
  const letters = [...groups.keys()].sort((a, b) => (a === "#" ? -1 : b === "#" ? 1 : a.localeCompare(b)));
  const worshipName = (departments ?? []).find((d) => d.id === worshipDepartmentId)?.name;

  return (
    <div className="max-w-3xl">
      <PageHeader
        back={{ href: "/dashboard", label: "Home" }}
        title="Songs"
        description="The songs we sing, with their lyrics. Search by title, writer or a line you remember."
        actions={
          canManage && !notSetUp ? (
            <>
              <Link href="/dashboard/songs/new" className="btn-primary">
                <Plus aria-hidden className="h-4 w-4" /> Add song
              </Link>
              <Link href="/dashboard/songs/import" className="btn-secondary">
                <Upload aria-hidden className="h-4 w-4" /> Import many
              </Link>
            </>
          ) : undefined
        }
      />

      {notSetUp ? (
        <Alert tone="warning" title="Songs need a database update">
          {shepherd ? "Run supabase/songs.sql in the Supabase SQL Editor, then refresh this page." : "Ask your church admin to finish setting up songs."}
        </Alert>
      ) : (
        <>
          <FilterBar query={q} placeholder="Search songs or lyrics" label="Search songs" resetHref="/dashboard/songs" active={Boolean(q)} />

          {error ? (
            <Alert tone="error">Couldn&apos;t load the songs — refresh to try again.</Alert>
          ) : !songs?.length ? (
            <EmptyState
              icon={Music}
              title={q ? "No songs match that" : "No songs yet"}
              description={q ? "Try a different word or a line from the chorus." : canManage ? "Add your first song, or import your whole list at once." : "Your worship team hasn't added any songs yet."}
            />
          ) : (
            <>
              {!q && letters.length > 3 && (
                <nav aria-label="Jump to letter" className="mb-4 flex flex-wrap gap-1">
                  {letters.map((l) => (
                    <a key={l} href={`#letter-${l === "#" ? "num" : l}`} className="grid h-9 min-w-9 place-items-center rounded-lg border border-line px-2 text-sm font-semibold hover:border-gold hover:bg-gold/10">
                      {l}
                    </a>
                  ))}
                </nav>
              )}
              <p className="mb-2 text-sm text-ink/60">
                {songs.length} {songs.length === 1 ? "song" : "songs"}
                {q ? ` matching “${q}”` : ""}
              </p>
              <div className="card-elevated rounded-2xl">
                {letters.map((l) => (
                  <section key={l} id={`letter-${l === "#" ? "num" : l}`} className="scroll-mt-24 border-t border-line first:border-t-0" aria-label={l === "#" ? "Numbers" : `Songs starting with ${l}`}>
                    <h2 className="px-4 pt-3 text-xs font-bold uppercase tracking-widest text-gold-deep">{l}</h2>
                    <ul>
                      {groups.get(l)!.map((s) => (
                        <li key={s.id}>
                          <Link href={`/dashboard/songs/${s.id}`} className="flex items-center gap-3 px-4 py-3 hover:bg-ink/[0.03]">
                            <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-gold/10 text-gold-deep">
                              <Music aria-hidden className="h-4 w-4" />
                            </span>
                            <span className="min-w-0 flex-1">
                              <span className="block truncate font-medium">{s.title}</span>
                              {(s.author || s.song_key) && (
                                <span className="block truncate text-xs text-ink/60">{[s.author, s.song_key && `Key ${s.song_key}`].filter(Boolean).join(" · ")}</span>
                              )}
                            </span>
                          </Link>
                        </li>
                      ))}
                    </ul>
                  </section>
                ))}
              </div>
            </>
          )}

          {shepherd && (
            <Section title="Who can edit songs" description={`Pastors and church admins always can. Choose the department that's your worship team and everyone in it can add, edit and delete songs too.${worshipName ? ` Now: ${worshipName}.` : ""}`}>
              <WorshipTeamForm departments={departments ?? []} current={worshipDepartmentId} />
            </Section>
          )}
        </>
      )}
    </div>
  );
}
