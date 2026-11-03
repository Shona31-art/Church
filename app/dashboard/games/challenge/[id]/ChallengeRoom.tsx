"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Church, Crown, Trophy } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { callAction, CONNECTION_FAILED } from "@/lib/call-action";
import { showToast } from "@/components/ui/Toaster";
import { useConfirm } from "@/components/ui/ConfirmDialog";
import { Avatar } from "@/components/ui/Avatar";
import { BackLink } from "@/components/ui/PageHeader";
import { TimedQuiz } from "@/components/games/TimedQuiz";
import { DUEL_SECONDS, duelClock } from "@/lib/games/duel";
import { challengeState, closesIn, ordinal, rankEntries } from "@/lib/games/challenge";
import { answerChallenge, closeChallenge, startChallenge, type ChallengeReviewItem } from "../actions";

export type Entry = { user_id: string; score: number; ms: number; done: number; finished_at: string | null; name: string; photoUrl?: string | null };
type Challenge = { id: string; title: string; level: string; questions: { question: string; choices: string[] }[]; starts_at: string; ends_at: string };

export function ChallengeRoom({ challenge, hostName, meId, meName, canClose, initialEntries, review }: { challenge: Challenge; hostName: string | null; meId: string; meName: string; canClose: boolean; initialEntries: Entry[]; review: ChallengeReviewItem[] | null }) {
  const router = useRouter();
  const [entries, setEntries] = useState(initialEntries);
  const [confirm, confirmDialog] = useConfirm();
  const [now, setNow] = useState(() => Date.now());
  const total = challenge.questions.length;
  const state = challengeState(challenge, new Date(now));
  const mine = entries.find((e) => e.user_id === meId);

  useEffect(() => setEntries(initialEntries), [initialEntries]);

  // Countdown to closing; refresh for the results when it closes.
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 30_000);
    const untilClose = new Date(challenge.ends_at).getTime() - Date.now();
    const close = untilClose > 0 && untilClose < 2_147_000_000 ? setTimeout(() => router.refresh(), untilClose + 1500) : undefined;
    return () => {
      clearInterval(t);
      clearTimeout(close);
    };
  }, [challenge.ends_at, router]);

  // Live leaderboard: everyone's progress as they play.
  useEffect(() => {
    const supabase = createClient();
    const names = new Map(initialEntries.map((e) => [e.user_id, { name: e.name, photoUrl: e.photoUrl ?? null }]));
    const channel = supabase
      .channel(`challenge:${challenge.id}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "church_challenge_entries", filter: `challenge_id=eq.${challenge.id}` }, async ({ new: row }) => {
        const r = row as Entry;
        if (!r?.user_id) return;
        let who = names.get(r.user_id);
        if (!who) {
          const { data } = await supabase.from("app_users").select("name").eq("id", r.user_id).maybeSingle();
          who = { name: data?.name ?? "Member", photoUrl: null };
          names.set(r.user_id, who);
        }
        setEntries((list) => [...list.filter((e) => e.user_id !== r.user_id), { ...r, ...who! }]);
      })
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [challenge.id, initialEntries]);

  const ranked = useMemo(() => rankEntries(state === "closed" ? entries.map((e) => ({ ...e, finished_at: e.finished_at ?? "closed" })) : entries), [entries, state]);
  const myRank = ranked.find((e) => e.user_id === meId)?.rank ?? null;

  async function start() {
    const r = await callAction(() => startChallenge(challenge.id), { error: CONNECTION_FAILED });
    if (r.error) return showToast(r.error, "error");
    setEntries((list) => (list.some((e) => e.user_id === meId) ? list : [...list, { user_id: meId, score: 0, ms: 0, done: 0, finished_at: null, name: meName }]));
  }

  async function closeNow() {
    if (!(await confirm({ title: "Close the challenge now?", message: "Nobody else can play, and everyone who played gets the results.", confirmLabel: "Close and send results" }))) return;
    const r = await callAction(() => closeChallenge(challenge.id), { error: CONNECTION_FAILED });
    if (r.error) return showToast(r.error, "error");
    router.refresh();
  }

  // Started (now, or earlier and left part-way): carry on with the questions.
  const inQuiz = state === "open" && Boolean(mine) && !mine?.finished_at;

  return (
    <div className="mx-auto max-w-xl">
      <BackLink href="/dashboard/games/challenge" label="Church challenges" />
      <header className="mb-5 flex items-start gap-3">
        <span aria-hidden className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-gold/15 text-2xl">⛪</span>
        <div className="min-w-0">
          <h1 className="font-display text-2xl font-semibold leading-tight">{challenge.title}</h1>
          <p className="text-sm text-ink/60">
            {total} {challenge.level} questions · {DUEL_SECONDS} s each{hostName ? ` · from ${hostName}` : ""} · {state === "open" ? `closes in ${closesIn(challenge.ends_at, new Date(now))}` : state === "closed" ? "closed" : "starts soon"}
          </p>
        </div>
      </header>

      {state === "open" && !mine && (
        <div className="card-elevated rounded-2xl p-6">
          <p className="font-display text-xl font-semibold">The whole church is playing!</p>
          <p className="mt-1 text-sm text-ink/70">
            You get one go: {total} questions, {DUEL_SECONDS} seconds each. Most right answers wins; a tie goes to the quicker player. The clock starts when you tap Start.
          </p>
          <button type="button" className="btn-primary mt-5" onClick={start}>
            <Church aria-hidden className="h-4 w-4" /> Start
          </button>
        </div>
      )}

      {inQuiz && mine && (
        <TimedQuiz
          questions={challenge.questions}
          startIndex={mine.done}
          answer={(i, c) => answerChallenge(challenge.id, i, c)}
          onAnswered={(done, finished, correct) => {
            setEntries((list) => list.map((e) => (e.user_id === meId ? { ...e, done, score: e.score + (correct ? 1 : 0), ...(finished ? { finished_at: new Date().toISOString() } : {}) } : e)));
            // Finished: fetch my exact time and place from the server.
            if (finished) router.refresh();
          }}
          footer={`${entries.length} ${entries.length === 1 ? "person has" : "people have"} played so far`}
        />
      )}

      {state === "open" && mine?.finished_at && (
        <div className="card-elevated rounded-2xl p-6 text-center">
          <p className="font-display text-xl font-semibold">Done! You&apos;re {myRank ? ordinal(myRank) : "on the board"} so far</p>
          <p className="mt-1 text-sm text-ink/70">
            {mine.score}/{total} in {duelClock(mine.ms)}. The answers are shown when the challenge closes — you&apos;ll get a notification.
          </p>
        </div>
      )}

      {state === "closed" && <Podium ranked={ranked} total={total} meId={meId} />}

      {/* The leaderboard (not while I'm answering, to keep the screen calm). */}
      {!(inQuiz && state === "open") && ranked.length > 0 && (
        <section className="mt-6">
          <h2 className="mb-3 flex items-center gap-2 text-lg font-semibold">
            Leaderboard {state === "open" && <span className="flex items-center gap-1 text-xs font-normal text-ink/60"><span aria-hidden className="h-2 w-2 rounded-full bg-green-500 motion-safe:animate-pulse" /> live</span>}
          </h2>
          <ol className="space-y-1.5">
            {ranked.map((e) => (
              <li key={e.user_id} className={`flex items-center gap-3 rounded-xl border px-3 py-2 ${e.user_id === meId ? "border-gold bg-gold/10" : "border-line bg-surface"}`}>
                <span className="w-8 shrink-0 text-center text-sm font-semibold tabular">{e.rank ? (e.rank <= 3 ? ["🥇", "🥈", "🥉"][e.rank - 1] : e.rank) : "…"}</span>
                <Avatar name={e.name} src={e.photoUrl ?? null} size="sm" />
                <span className="min-w-0 flex-1 truncate text-sm">{e.user_id === meId ? `${e.name} (you)` : e.name}</span>
                <span className="shrink-0 text-right text-xs tabular text-ink/70">
                  {e.finished_at ? (
                    <>
                      <span className="font-semibold text-ink">
                        {e.score}/{total}
                      </span>{" "}
                      · {duelClock(e.ms)}
                    </>
                  ) : (
                    `playing · ${e.done}/${total}`
                  )}
                </span>
              </li>
            ))}
          </ol>
        </section>
      )}

      {state === "open" && !ranked.length && <p className="mt-6 text-center text-sm text-ink/60">Nobody has played yet — be the first!</p>}

      {review && mine && (
        <section className="mt-8">
          <h2 className="mb-3 text-lg font-semibold">Your answers</h2>
          <ol className="space-y-2">
            {review.map((q, i) => {
              const right = q.mine === q.correct;
              return (
                <li key={i} className="rounded-2xl border border-line bg-surface p-3 text-sm">
                  <p className="font-medium">
                    {i + 1}. {q.question}
                  </p>
                  <p className="mt-1 text-success">✓ {q.choices[q.correct] ?? "—"}</p>
                  {!right && <p className="text-danger">✗ You: {q.mine === null ? "didn't answer" : q.mine < 0 ? "ran out of time" : q.choices[q.mine]}</p>}
                </li>
              );
            })}
          </ol>
        </section>
      )}

      {canClose && state === "open" && (
        <div className="mt-8 text-center">
          <button type="button" className="text-sm text-ink/60 underline" onClick={closeNow}>
            Close the challenge now and send the results
          </button>
        </div>
      )}
      {confirmDialog}
    </div>
  );
}

function Podium({ ranked, total, meId }: { ranked: (Entry & { rank: number | null })[]; total: number; meId: string }) {
  const top = ranked.slice(0, 3);
  const me = ranked.find((e) => e.user_id === meId);
  if (!top.length) return <p className="card-elevated rounded-2xl p-6 text-center text-sm text-ink/60">Nobody played this one.</p>;
  const order = [top[1], top[0], top[2]].filter(Boolean) as typeof top;
  return (
    <div className="card-elevated rounded-2xl p-6 text-center">
      <Trophy aria-hidden className="mx-auto h-10 w-10 text-gold" />
      <p className="mt-1 font-display text-2xl font-semibold">{top[0].user_id === meId ? "You won! 🎉" : `${top[0].name} won!`}</p>
      {me?.rank && me.user_id !== top[0].user_id && <p className="text-sm text-ink/60">You came {ordinal(me.rank)} of {ranked.length}.</p>}
      <div className="mt-6 flex items-end justify-center gap-3">
        {order.map((e) => {
          const first = e.rank === 1;
          return (
            <div key={e.user_id} className="flex w-24 flex-col items-center">
              {first && <Crown aria-hidden className="mb-1 h-5 w-5 text-gold" />}
              <Avatar name={e.name} src={e.photoUrl ?? null} size={first ? "lg" : "md"} />
              <p className="mt-1 w-full truncate text-xs font-semibold">{e.name.split(" ")[0]}</p>
              <div className={`mt-1 flex w-full items-start justify-center rounded-t-xl pt-2 text-sm font-semibold ${first ? "h-24 bg-gold/30" : e.rank === 2 ? "h-16 bg-gold/20" : "h-12 bg-gold/10"}`}>
                {e.score}/{total}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
