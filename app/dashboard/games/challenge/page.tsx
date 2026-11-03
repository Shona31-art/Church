import Link from "next/link";
import { Church, Plus, Trophy } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { getCurrentAppUser } from "@/lib/current-user";
import { moduleGate } from "@/lib/gate";
import { can } from "@/lib/permissions";
import { formatDate } from "@/lib/format";
import { challengeState, closesIn, ordinal, rankEntries } from "@/lib/games/challenge";
import { PageHeader } from "@/components/ui/PageHeader";
import { Alert } from "@/components/ui/Alert";

type Row = { id: string; title: string; level: string; questions: unknown[]; starts_at: string; ends_at: string; church_challenge_entries: { user_id: string; score: number; ms: number; done: number; finished_at: string | null; app_users: { name: string } | null }[] };

/** Church challenges: the ones running now, and past results. */
export default async function ChallengesPage() {
  const gate = await moduleGate("bible_games");
  if (gate) return gate;
  const me = (await getCurrentAppUser())!;
  const { data, error } = await createClient()
    .from("church_challenges")
    .select("id, title, level, questions, starts_at, ends_at, church_challenge_entries(user_id, score, ms, done, finished_at, app_users(name))")
    .order("ends_at", { ascending: false })
    .limit(30);
  const all = (data ?? []) as unknown as Row[];
  const open = all.filter((c) => challengeState(c) === "open");
  const past = all.filter((c) => challengeState(c) === "closed");
  const host = can(me.role, "manageQuizQuestions");

  return (
    <div className="max-w-2xl">
      <PageHeader
        back={{ href: "/dashboard/games", label: "Games" }}
        title={
          <span className="flex items-center gap-3">
            <Church aria-hidden className="h-7 w-7 text-gold" /> Church challenges
          </span>
        }
        description="The whole church plays the same Bible quiz. Top the leaderboard: most right answers, then quickest."
        actions={
          host ? (
            <Link href="/dashboard/games/challenge/new" className="btn-primary">
              <Plus aria-hidden className="h-4 w-4" /> New challenge
            </Link>
          ) : undefined
        }
      />
      {error && <Alert tone="info" title="One step left">Church challenges need a database update first: ask your church admin to run supabase/church_challenges.sql.</Alert>}

      <section className="mb-8">
        <h2 className="mb-3 text-lg font-semibold">Running now</h2>
        {!open.length ? (
          <p className="rounded-2xl border border-dashed border-line p-6 text-center text-sm text-ink/60">
            No challenge is running right now.{host ? " Start one — everyone in the church gets a notification." : " Your pastor can start one."}
          </p>
        ) : (
          <ul className="space-y-3">
            {open.map((c) => {
              const mine = c.church_challenge_entries.find((e) => e.user_id === me.id);
              const ranked = rankEntries(c.church_challenge_entries);
              const myRank = ranked.find((e) => e.user_id === me.id)?.rank;
              return (
                <li key={c.id}>
                  <Link href={`/dashboard/games/challenge/${c.id}`} className="card-elevated flex items-center gap-4 rounded-2xl p-4 hover:border-gold/60">
                    <span aria-hidden className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-gold/15 text-2xl">⛪</span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate font-semibold">{c.title}</span>
                      <span className="block text-xs text-ink/60">
                        {c.questions.length} {c.level} questions · {c.church_challenge_entries.length} played · closes in {closesIn(c.ends_at)}
                      </span>
                    </span>
                    {mine?.finished_at ? (
                      <span className="shrink-0 rounded-full bg-gold/15 px-3 py-1 text-xs font-semibold">{myRank ? ordinal(myRank) : "Done"} · {mine.score}/{c.questions.length}</span>
                    ) : (
                      <span className="btn-primary btn-sm shrink-0">{mine ? "Carry on" : "Play"}</span>
                    )}
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      {past.length > 0 && (
        <section>
          <h2 className="mb-3 text-lg font-semibold">Past challenges</h2>
          <ul className="space-y-2">
            {past.map((c) => {
              const ranked = rankEntries(c.church_challenge_entries.map((e) => ({ ...e, finished_at: e.finished_at ?? "closed" })));
              const winner = ranked[0];
              const myRank = ranked.find((e) => e.user_id === me.id)?.rank;
              return (
                <li key={c.id}>
                  <Link href={`/dashboard/games/challenge/${c.id}`} className="flex items-center gap-3 rounded-2xl border border-line bg-surface p-3 hover:border-line-strong">
                    <Trophy aria-hidden className="h-5 w-5 shrink-0 text-gold" />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-medium">{c.title}</span>
                      <span className="block text-xs text-ink/60">
                        {formatDate(c.ends_at)} · {winner ? `${winner.app_users?.name ?? "Someone"} won with ${winner.score}/${c.questions.length}` : "Nobody played"}
                      </span>
                    </span>
                    {myRank && <span className="shrink-0 text-xs font-semibold text-ink/70">You: {ordinal(myRank)}</span>}
                  </Link>
                </li>
              );
            })}
          </ul>
        </section>
      )}
    </div>
  );
}
