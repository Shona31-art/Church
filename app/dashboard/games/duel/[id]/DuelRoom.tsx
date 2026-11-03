"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { CheckCircle2, Clock, RotateCcw, Swords, Trophy, XCircle } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { callAction, CONNECTION_FAILED } from "@/lib/call-action";
import { haptic } from "@/lib/haptics";
import { showToast } from "@/components/ui/Toaster";
import { Avatar } from "@/components/ui/Avatar";
import { BackLink } from "@/components/ui/PageHeader";
import { DUEL_SECONDS, duelClock, duelPhase, otherSide, sideOf, type DuelRow } from "@/lib/games/duel";
import { answerDuel, cancelDuel, createDuel, startDuel, type DuelReviewItem } from "../actions";
import { RespondButtons } from "../RespondButtons";

type Person = { name: string; photoUrl: string | null };

/** How long the right answer stays on screen before the next question. */
const REVEAL_MS = 1200;

export function DuelRoom({ initial, meId, me, them, review }: { initial: DuelRow; meId: string; me: Person; them: Person & { id: string }; review: DuelReviewItem[] | null }) {
  const router = useRouter();
  const [duel, setDuel] = useState(initial);
  const side = sideOf(duel, meId)!;
  const theirSide = otherSide(side);
  const phase = duelPhase(duel, meId);
  const total = duel.questions.length;

  useEffect(() => setDuel(initial), [initial]);

  // Live: their progress, their accepting, the result.
  useEffect(() => {
    const supabase = createClient();
    const channel = supabase
      .channel(`duel:${initial.id}`)
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "game_duels", filter: `id=eq.${initial.id}` }, ({ new: row }) => {
        setDuel((current) => {
          const next = { ...current, ...(row as Partial<DuelRow>) };
          if (next.status === "finished" && current.status !== "finished") setTimeout(() => router.refresh(), 300);
          return next;
        });
      })
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [initial.id, router]);

  const theirName = them.name.split(" ")[0];
  const theirDone = duel[`${theirSide}_done`];
  const theirStatus =
    duel.status === "pending" && theirSide === "opponent"
      ? "hasn't accepted yet"
      : duel[`${theirSide}_finished_at`]
      ? "finished"
      : duel[`${theirSide}_started_at`]
      ? `on question ${Math.min(theirDone + 1, total)} of ${total}`
      : "hasn't started yet";

  const header = (
    <div className="mb-5 flex items-center justify-between gap-3">
      <PlayerChip person={me} label="You" done={duel[`${side}_done`]} total={total} />
      <Swords aria-hidden className="h-6 w-6 shrink-0 text-gold" />
      <PlayerChip person={them} label={theirName} done={theirDone} total={total} right live={Boolean(duel[`${theirSide}_started_at`]) && !duel[`${theirSide}_finished_at`] && duel.status !== "finished"} />
    </div>
  );

  return (
    <div className="mx-auto max-w-xl">
      <BackLink href="/dashboard/games/duel" label="Bible duels" />
      <h1 className="sr-only">Bible duel with {them.name}</h1>
      {header}

      {phase === "respond" && (
        <Card>
          <p className="font-display text-xl font-semibold">{theirName} challenged you! ⚔️</p>
          <p className="mt-1 text-sm text-ink/70">
            {cap(duel.level)} Bible quiz · {total} questions · {DUEL_SECONDS} seconds each. Most right answers wins; a tie goes to the quicker player.
          </p>
          <div className="mt-5">
            <RespondButtons duelId={duel.id} size="md" />
          </div>
        </Card>
      )}

      {phase === "ready" && (
        <Card>
          <p className="font-display text-xl font-semibold">Ready?</p>
          <p className="mt-1 text-sm text-ink/70">
            {total} {cap(duel.level).toLowerCase()} questions, {DUEL_SECONDS} seconds each. The clock starts when you tap Start — and keeps going if you leave.
          </p>
          {side === "challenger" && duel.status === "pending" && <p className="mt-2 text-sm text-ink/70">{theirName} hasn&apos;t accepted yet — you can play your turn now.</p>}
          <div className="mt-5 flex flex-wrap gap-2">
            <StartButton duelId={duel.id} onStarted={() => setDuel((d) => ({ ...d, [`${side}_started_at`]: new Date().toISOString() }))} />
            {side === "challenger" && duel.status === "pending" && <CancelButton duelId={duel.id} />}
          </div>
        </Card>
      )}

      {phase === "playing" && <Questions duel={duel} side={side} onProgress={(patch) => setDuel((d) => ({ ...d, ...patch }))} theirLine={`${theirName} ${theirStatus}`} />}

      {phase === "waiting" && (
        <Card>
          <p className="font-display text-xl font-semibold">Well done — you&apos;ve finished!</p>
          <p className="mt-1 text-sm text-ink/70">
            Waiting for {theirName}: {theirStatus}. You&apos;ll get a notification with the result.
          </p>
          <Progress done={theirDone} total={total} />
        </Card>
      )}

      {phase === "finished" && <Result duel={duel} side={side} meName={me.name} them={them} review={review} />}

      {(phase === "declined" || phase === "cancelled" || phase === "expired") && (
        <Card>
          <p className="font-display text-xl font-semibold">{phase === "declined" ? `${theirName} declined this duel` : phase === "cancelled" ? "This duel was cancelled" : "This duel ran out of time"}</p>
          <Link href={`/dashboard/games/duel/new?with=${them.id}`} className="btn-primary mt-5">
            <Swords aria-hidden className="h-4 w-4" /> Challenge {theirName} again
          </Link>
        </Card>
      )}
    </div>
  );
}

/** The questions, one at a time, against the clock. Resumes where I left off. */
function Questions({ duel, side, onProgress, theirLine }: { duel: DuelRow; side: "challenger" | "opponent"; onProgress: (patch: Partial<DuelRow>) => void; theirLine: string }) {
  const total = duel.questions.length;
  const [index, setIndex] = useState(duel[`${side}_done`]);
  const [picked, setPicked] = useState<number | null>(null);
  const [correctIndex, setCorrectIndex] = useState<number | null>(null);
  const [checking, setChecking] = useState(false);
  const [left, setLeft] = useState(DUEL_SECONDS);
  const [score, setScore] = useState(0);
  const lockRef = useRef(false);
  const question = duel.questions[index];

  const choose = useCallback(
    async (choice: number) => {
      if (lockRef.current) return;
      lockRef.current = true;
      setChecking(true);
      if (choice >= 0) setPicked(choice);
      const r = await callAction(() => answerDuel(duel.id, index, choice), { error: CONNECTION_FAILED });
      setChecking(false);
      if (r.error || r.correctIndex === undefined) {
        // Already answered (e.g. on another device): move on.
        if (/already answered|in order/.test(r.error ?? "")) {
          setIndex((i) => i + 1);
          lockRef.current = false;
          return;
        }
        lockRef.current = false;
        setPicked(null);
        return showToast(r.error ?? "Couldn't save your answer.", "error");
      }
      setCorrectIndex(r.correctIndex);
      haptic(r.correct ? "success" : "error");
      if (r.correct) setScore((s) => s + 1);
      onProgress({ [`${side}_done`]: index + 1, ...(r.finished ? { [`${side}_finished_at`]: new Date().toISOString() } : {}) } as Partial<DuelRow>);
      if (!r.finished) {
        setTimeout(() => {
          setIndex((i) => i + 1);
          setPicked(null);
          setCorrectIndex(null);
          lockRef.current = false;
        }, REVEAL_MS);
      }
    },
    [duel.id, index, onProgress, side]
  );

  // The clock for this question; out of time counts as a wrong answer.
  useEffect(() => {
    setLeft(DUEL_SECONDS);
    const started = Date.now();
    const t = setInterval(() => {
      const remaining = DUEL_SECONDS - Math.floor((Date.now() - started) / 1000);
      setLeft(Math.max(0, remaining));
      if (remaining <= 0) {
        clearInterval(t);
        void choose(-1);
      }
    }, 250);
    return () => clearInterval(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- restart only for a new question
  }, [index]);

  if (!question) return <Card>Saving your answers…</Card>;
  const answered = correctIndex !== null;

  return (
    <Card>
      <div className="mb-3 flex items-center justify-between text-xs text-ink/60">
        <span className="tabular">
          Question {index + 1} of {total} · ✓ {score}
        </span>
        <span className={`flex items-center gap-1 font-semibold tabular ${left <= 5 && !answered ? "text-danger motion-safe:animate-pulse" : ""}`} aria-live="off">
          <Clock aria-hidden className="h-3.5 w-3.5" /> {answered ? "—" : `${left}s`}
        </span>
      </div>
      <div className="mb-5 h-1.5 overflow-hidden rounded-full bg-ink/10" aria-hidden>
        <div className={`h-full rounded-full transition-[width] duration-200 ${left <= 5 ? "bg-danger" : "bg-gold"}`} style={{ width: `${answered ? 0 : (left / DUEL_SECONDS) * 100}%` }} />
      </div>
      <p className="mb-5 font-display text-xl font-semibold" id="duel-question">
        {question.question}
      </p>
      <div className="space-y-2" role="group" aria-labelledby="duel-question">
        {question.choices.map((choice, i) => {
          const isAnswer = correctIndex === i;
          const wrongPick = picked === i && answered && correctIndex !== i;
          return (
            <button
              key={i}
              type="button"
              onClick={() => choose(i)}
              disabled={picked !== null || checking || answered}
              className={`flex w-full items-center justify-between gap-3 rounded-xl border px-4 py-3 text-left text-sm transition-colors ${
                isAnswer ? "border-success-line bg-success-tint text-success" : wrongPick ? "border-danger-line bg-danger-tint text-danger" : picked === i ? "border-gold bg-gold/10" : "border-line bg-surface hover:border-line-strong"
              }`}
            >
              <span>{choice}</span>
              {isAnswer && <CheckCircle2 aria-label="Correct answer" className="h-4 w-4 shrink-0" />}
              {wrongPick && <XCircle aria-label="Your answer" className="h-4 w-4 shrink-0" />}
            </button>
          );
        })}
      </div>
      {answered && picked === null && <p className="mt-3 text-sm text-danger">Out of time!</p>}
      <p className="mt-5 text-center text-xs text-ink/60" aria-live="polite">
        {theirLine}
      </p>
    </Card>
  );
}

function Result({ duel, side, meName, them, review }: { duel: DuelRow; side: "challenger" | "opponent"; meName: string; them: Person & { id: string }; review: DuelReviewItem[] | null }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const theirSide = otherSide(side);
  const mine = { score: duel[`${side}_score`] ?? 0, ms: duel[`${side}_ms`] ?? 0 };
  const theirs = { score: duel[`${theirSide}_score`] ?? 0, ms: duel[`${theirSide}_ms`] ?? 0 };
  const iWon = duel.winner_id && duel.winner_id !== them.id;
  const draw = !duel.winner_id;
  const theirName = them.name.split(" ")[0];
  const byTime = mine.score === theirs.score && !draw;

  async function rematch() {
    setBusy(true);
    const r = await callAction(() => createDuel(them.id, duel.level, duel.questions.length), { error: CONNECTION_FAILED });
    setBusy(false);
    if (r.error || !r.duelId) return showToast(r.error ?? "Couldn't start a rematch.", "error");
    router.push(`/dashboard/games/duel/${r.duelId}`);
  }

  return (
    <>
      <Card>
        <div className="text-center">
          {iWon ? <Trophy aria-hidden className="mx-auto h-12 w-12 text-gold" /> : <Swords aria-hidden className="mx-auto h-10 w-10 text-ink/50" />}
          <p className="mt-2 font-display text-2xl font-semibold">{iWon ? "You won! 🎉" : draw ? "It's a draw!" : `${theirName} won`}</p>
          {byTime && <p className="text-sm text-ink/60">Same score — decided by time.</p>}
          <div className="mt-5 grid grid-cols-2 gap-3">
            {[
              [meName.split(" ")[0] + " (you)", mine],
              [theirName, theirs],
            ].map(([label, r]) => {
              const res = r as { score: number; ms: number };
              return (
                <div key={label as string} className="rounded-2xl border border-line p-3">
                  <p className="truncate text-xs text-ink/60">{label as string}</p>
                  <p className="font-display text-3xl font-semibold tabular">
                    {res.score}
                    <span className="text-base text-ink/50">/{duel.questions.length}</span>
                  </p>
                  <p className="text-xs text-ink/60 tabular">{duelClock(res.ms)}</p>
                </div>
              );
            })}
          </div>
          <button type="button" onClick={rematch} disabled={busy} className="btn-primary mt-5">
            <RotateCcw aria-hidden className="h-4 w-4" /> {busy ? "Sending…" : "Rematch"}
          </button>
        </div>
      </Card>

      {review && (
        <section className="mt-6">
          <h2 className="mb-3 text-lg font-semibold">The answers</h2>
          <ol className="space-y-3">
            {review.map((q, i) => (
              <li key={i} className="rounded-2xl border border-line bg-surface p-4">
                <p className="text-sm font-medium">
                  {i + 1}. {q.question}
                </p>
                <p className="mt-1 text-sm text-success">✓ {q.choices[q.correct] ?? "—"}</p>
                <div className="mt-2 flex flex-wrap gap-2 text-xs">
                  <Pick label="You" choice={q.mine} q={q} />
                  <Pick label={theirName} choice={q.theirs} q={q} />
                </div>
              </li>
            ))}
          </ol>
        </section>
      )}
    </>
  );
}

function Pick({ label, choice, q }: { label: string; choice: number | null; q: DuelReviewItem }) {
  const right = choice === q.correct;
  const text = choice === null ? "didn't answer" : choice < 0 ? "ran out of time" : q.choices[choice];
  return (
    <span className={`rounded-full px-2.5 py-1 ${right ? "bg-success-tint text-success" : "bg-danger-tint text-danger"}`}>
      {right ? "✓" : "✗"} {label}: {text}
    </span>
  );
}

function PlayerChip({ person, label, done, total, right = false, live = false }: { person: Person; label: string; done: number; total: number; right?: boolean; live?: boolean }) {
  return (
    <div className={`flex min-w-0 flex-1 items-center gap-2 ${right ? "flex-row-reverse text-right" : ""}`}>
      <span className="relative">
        <Avatar name={person.name} src={person.photoUrl} size="md" />
        {live && <span title="Playing now" aria-hidden className="absolute -right-0.5 -top-0.5 h-3 w-3 rounded-full border-2 border-surface bg-green-500" />}
      </span>
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-semibold">{label}</p>
        <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-ink/10" aria-label={`${label}: ${done} of ${total} answered`}>
          <div className={`h-full rounded-full bg-gold transition-[width] ${right ? "ml-auto" : ""}`} style={{ width: `${(done / total) * 100}%` }} />
        </div>
      </div>
    </div>
  );
}

function Progress({ done, total }: { done: number; total: number }) {
  return (
    <div className="mt-4 h-2 overflow-hidden rounded-full bg-ink/10" aria-hidden>
      <div className="h-full rounded-full bg-gold transition-[width]" style={{ width: `${(done / total) * 100}%` }} />
    </div>
  );
}

function StartButton({ duelId, onStarted }: { duelId: string; onStarted: () => void }) {
  const [busy, setBusy] = useState(false);
  return (
    <button
      type="button"
      className="btn-primary"
      disabled={busy}
      onClick={async () => {
        setBusy(true);
        const r = await callAction(() => startDuel(duelId), { error: CONNECTION_FAILED });
        setBusy(false);
        if (r.error) return showToast(r.error, "error");
        onStarted();
      }}
    >
      {busy ? "Starting…" : "Start"}
    </button>
  );
}

function CancelButton({ duelId }: { duelId: string }) {
  const router = useRouter();
  return (
    <button
      type="button"
      className="btn-ghost"
      onClick={async () => {
        const r = await callAction(() => cancelDuel(duelId), { error: CONNECTION_FAILED });
        if (r.error) return showToast(r.error, "error");
        router.push("/dashboard/games/duel");
        router.refresh();
      }}
    >
      Cancel challenge
    </button>
  );
}

function Card({ children }: { children: React.ReactNode }) {
  return <div className="card-elevated rounded-2xl p-6">{children}</div>;
}

const cap = (s: string) => s[0].toUpperCase() + s.slice(1);
