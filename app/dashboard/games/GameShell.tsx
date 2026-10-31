"use client";

import { haptic } from "@/lib/haptics";
import { useEffect, useState } from "react";
import Link from "next/link";
import { Award, CalendarCheck, CheckCircle2, ChevronLeft, LoaderCircle, Smile, Timer, Trophy, XCircle } from "lucide-react";
import { GAMES, LEVELS, LEVEL_LABELS, type GameKey, type Level } from "@/lib/games/catalog";
import { formatDuration } from "@/lib/chat";
import { Alert } from "@/components/ui/Alert";
import { finishGame, startGame, type FinishResult, type GameMode } from "./actions";
import { callAction, CONNECTION_FAILED } from "@/lib/call-action";

export interface BoardProps<View> {
  sessionId: string;
  view: View;
  level: Level;
  /** Call when the player is done; pass the game's answers (or null for games marked as they go). */
  finish: (answers: unknown) => void;
  finishing: boolean;
}

type Phase =
  | { kind: "intro"; error?: string }
  | { kind: "starting" }
  | { kind: "playing"; sessionId: string; view: unknown; level: Level; timed: boolean; parSeconds: number; startedAt: number }
  | { kind: "finishing"; sessionId: string; view: unknown; level: Level; timed: boolean; parSeconds: number; startedAt: number }
  | { kind: "result"; result: FinishResult; level: Level; timed: boolean };

/**
 * The frame around every game: choose a level (and timed mode) → play →
 * see your score. The server starts the game, keeps the answers and marks
 * them; each game only supplies its board.
 */
export function GameShell<View>({
  game,
  initialLevel,
  mode = "practice",
  rules,
  Board,
}: {
  game: GameKey;
  initialLevel?: Level;
  /** "daily": today's challenge (Medium, timed, one try). "kids": Easy, untimed, larger text. */
  mode?: GameMode;
  /** One or two sentences on how to play. */
  rules: string;
  Board: (props: BoardProps<View>) => React.ReactNode;
}) {
  const info = GAMES[game];
  const fixedLevel: Level | null = mode === "daily" ? "medium" : mode === "kids" ? "easy" : null;
  const [level, setLevel] = useState<Level>(fixedLevel ?? initialLevel ?? "easy");
  const [timed, setTimed] = useState(mode === "daily");
  const [phase, setPhase] = useState<Phase>({ kind: "intro" });
  const [finishError, setFinishError] = useState<string | null>(null);
  // Quitting a game in progress asks first, so a stray tap doesn't throw a game away.
  const [confirmQuit, setConfirmQuit] = useState(false);

  async function start() {
    setPhase({ kind: "starting" });
    const result = await callAction(() => startGame(game, level, timed, mode), { error: CONNECTION_FAILED });
    if ("error" in result) return setPhase({ kind: "intro", error: result.error });
    setPhase({ kind: "playing", sessionId: result.sessionId, view: result.view, level: result.level, timed: result.timed, parSeconds: result.parSeconds, startedAt: Date.now() });
  }

  async function finish(answers: unknown) {
    if (phase.kind !== "playing") return;
    setFinishError(null);
    setPhase({ ...phase, kind: "finishing" });
    const result = await callAction(() => finishGame(phase.sessionId, answers ?? null), { error: CONNECTION_FAILED });
    if (result.error) {
      // Rare (lost connection, expired session): keep the board so nothing is lost.
      setPhase({ ...phase, kind: "playing" });
      setFinishError(result.error);
      return;
    }
    setPhase({ kind: "result", result, level: phase.level, timed: phase.timed });
  }

  return (
    // Kids mode: everything a size larger.
    <div className={`max-w-3xl ${mode === "kids" ? "text-[17px] [&_.btn]:min-h-[48px] [&_.btn]:text-base" : ""}`}>
      <Link href={mode === "kids" ? "/dashboard/games?kids=1" : "/dashboard/games"} className="mb-3 inline-flex items-center gap-1 text-sm font-medium text-ink/60 hover:text-ink">
        <ChevronLeft aria-hidden className="h-4 w-4" /> Games
      </Link>
      <h1 className="text-title font-semibold leading-tight sm:text-title-lg">{info.title}</h1>
      {mode !== "practice" && (
        <p className="mt-2 inline-flex items-center gap-1.5 rounded-full border border-gold/50 bg-gold/10 px-3 py-1 text-xs font-semibold text-ink/80">
          {mode === "daily" ? <CalendarCheck aria-hidden className="h-3.5 w-3.5 text-gold" /> : <Smile aria-hidden className="h-3.5 w-3.5 text-gold" />}
          {mode === "daily" ? "Today's challenge" : "Kids mode"}
        </p>
      )}
      <div className="rule-gold mt-3 mb-6" />

      {(phase.kind === "intro" || phase.kind === "starting") && (
        <div className="card-elevated space-y-6 rounded-2xl p-6">
          {phase.kind === "intro" && phase.error && <Alert tone="error">{phase.error}</Alert>}
          <p className="text-lede text-ink/70">{rules}</p>

          {mode === "daily" && (
            <Alert tone="info" title="One try today">
              Everyone in your church gets this same puzzle today, on Medium with the clock running. Your score goes on today&apos;s challenge board — and once you start, you can&apos;t restart.
            </Alert>
          )}

          {!fixedLevel && (
          <fieldset>
            <legend className="label">Level</legend>
            <div className="mt-2 grid gap-2 sm:grid-cols-3">
              {LEVELS.map((l) => (
                <label
                  key={l}
                  className={`cursor-pointer rounded-xl border p-3 transition-colors has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-gold ${
                    level === l ? "border-gold bg-gold/10" : "border-line hover:border-line-strong"
                  }`}
                >
                  <input type="radio" name="level" value={l} checked={level === l} onChange={() => setLevel(l)} className="sr-only" />
                  <span className="block font-semibold">{LEVEL_LABELS[l]}</span>
                  <span className="mt-0.5 block text-xs text-ink/60">{info.levels[l]}</span>
                </label>
              ))}
            </div>
          </fieldset>
          )}

          {mode === "practice" && (
          <label className="flex items-start gap-3 text-sm">
            <input type="checkbox" checked={timed} onChange={(e) => setTimed(e.target.checked)} className="mt-0.5 accent-[rgb(var(--ember))]" />
            <span>
              <span className="font-medium">Timed mode</span>
              <span className="block text-xs text-ink/60">
                Finish a perfect game in under {formatDuration(info.parSeconds[level] * 1000)} for up to 50% bonus points. Without it, take as long as you like.
              </span>
            </span>
          </label>
          )}

          <button type="button" className="btn-primary" onClick={start} disabled={phase.kind === "starting"}>
            {phase.kind === "starting" ? <LoaderCircle aria-hidden className="h-4 w-4 animate-spin" /> : null}
            {phase.kind === "starting" ? "Getting ready…" : "Start"}
          </button>
        </div>
      )}

      {(phase.kind === "playing" || phase.kind === "finishing") && (
        <div>
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2 text-sm">
              <span className="rounded-full border border-line bg-surface px-2.5 py-0.5 text-xs font-medium">{LEVEL_LABELS[phase.level]}</span>
              <Clock startedAt={phase.startedAt} parSeconds={phase.timed ? phase.parSeconds : null} />
            </div>
            {confirmQuit ? (
              <div role="alertdialog" aria-label="Leave this game?" className="flex flex-wrap items-center gap-2 rounded-xl border border-warning-line bg-warning-tint px-3 py-2 text-sm text-warning">
                <span>Leave this game? It won&apos;t count.</span>
                <button type="button" className="btn-secondary btn-sm" onClick={() => setConfirmQuit(false)} autoFocus>
                  Keep playing
                </button>
                <button
                  type="button"
                  className="btn-ghost btn-sm"
                  onClick={() => {
                    setConfirmQuit(false);
                    setPhase({ kind: "intro" });
                  }}
                >
                  Leave game
                </button>
              </div>
            ) : (
              <button type="button" className="btn-ghost btn-sm" onClick={() => setConfirmQuit(true)} disabled={phase.kind === "finishing"}>
                Quit
              </button>
            )}
          </div>
          {finishError && <Alert tone="error" className="mb-4">{finishError}</Alert>}
          <Board sessionId={phase.sessionId} view={phase.view as View} level={phase.level} finish={finish} finishing={phase.kind === "finishing"} />
        </div>
      )}

      {phase.kind === "result" && (
        <ResultCard result={phase.result} level={phase.level} timed={phase.timed} mode={mode} onReplay={start} onChangeLevel={() => setPhase({ kind: "intro" })} />
      )}
    </div>
  );
}

/** Elapsed time; in timed mode, shown against the par time. */
function Clock({ startedAt, parSeconds }: { startedAt: number; parSeconds: number | null }) {
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);
  const elapsed = now - startedAt;
  const over = parSeconds !== null && elapsed > parSeconds * 1000;
  return (
    <span className={`tabular inline-flex items-center gap-1 ${over ? "text-warning" : "text-ink/60"}`} aria-label={`Time ${formatDuration(elapsed)}`}>
      <Timer aria-hidden className="h-4 w-4" />
      {formatDuration(elapsed)}
      {parSeconds !== null && <span className="text-ink/60">/ {formatDuration(parSeconds * 1000)}</span>}
    </span>
  );
}

function ResultCard({
  result,
  level,
  timed,
  mode,
  onReplay,
  onChangeLevel,
}: {
  result: FinishResult;
  level: Level;
  timed: boolean;
  mode: GameMode;
  onReplay: () => void;
  onChangeLevel: () => void;
}) {
  const { correct = 0, maxCorrect = 0, points = 0, durationMs = 0 } = result;
  const perfect = maxCorrect > 0 && correct === maxCorrect;
  // A celebratory buzz when the score comes up.
  useEffect(() => haptic("success"), []);
  return (
    <div className="card-elevated rounded-2xl p-8 text-center" role="status">
      <span aria-hidden className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl border border-line bg-parchment text-gold">
        <Trophy className="h-6 w-6" strokeWidth={1.75} />
      </span>
      <p className="tabular mt-4 font-display text-4xl font-semibold">
        {correct} / {maxCorrect}
      </p>
      <p className="mt-2 text-ink/60">
        {perfect ? "Perfect!" : correct >= maxCorrect * 0.7 ? "Well done!" : "Good effort — try again to climb the scoreboard."}
      </p>
      <dl className="mx-auto mt-6 grid max-w-sm grid-cols-3 gap-3 text-sm">
        <div className="rounded-xl border border-line p-3">
          <dt className="eyebrow">Points</dt>
          <dd className="tabular mt-1 text-lg font-semibold">{points}</dd>
        </div>
        <div className="rounded-xl border border-line p-3">
          <dt className="eyebrow">Time</dt>
          <dd className="tabular mt-1 text-lg font-semibold">{formatDuration(durationMs)}</dd>
        </div>
        <div className="rounded-xl border border-line p-3">
          <dt className="eyebrow">Level</dt>
          <dd className="mt-1 text-lg font-semibold">{LEVEL_LABELS[level]}</dd>
        </div>
      </dl>
      {timed && !perfect && <p className="mt-3 text-xs text-ink/60">Time bonus is for perfect games.</p>}
      <p className="mt-3 flex items-center justify-center gap-1.5 text-xs text-success">
        <CheckCircle2 aria-hidden className="h-3.5 w-3.5" />
        {mode === "kids" ? "Saved to your game history. Kids mode games don't go on the church scoreboard." : "Saved to your game history and the church scoreboard."}
      </p>

      {result.newBadges && result.newBadges.length > 0 && (
        <div className="mx-auto mt-6 max-w-sm space-y-2">
          {result.newBadges.map((b) => (
            <div key={b.key} className="flex items-center gap-3 rounded-xl border border-gold/50 bg-gold/10 px-4 py-3 text-left motion-safe:animate-modal-in">
              <Award aria-hidden className="h-6 w-6 shrink-0 text-gold" />
              <span>
                <span className="block text-xs font-semibold uppercase tracking-wide text-gold-deep">New badge</span>
                <span className="block font-semibold">{b.title}</span>
                <span className="block text-xs text-ink/60">{b.description}</span>
              </span>
            </div>
          ))}
        </div>
      )}
      {result.review && result.review.length > 0 && (
        <section className="mt-8 text-left" aria-labelledby="review-heading">
          <h2 id="review-heading" className="eyebrow mb-2">
            Answers
          </h2>
          <ul className="divide-y divide-line rounded-xl border border-line">
            {result.review.map((item, i) => (
              <li key={i} className="flex items-start gap-3 px-4 py-2.5 text-sm">
                {item.correct ? (
                  <CheckCircle2 aria-label="Correct" className="mt-0.5 h-4 w-4 shrink-0 text-success" />
                ) : (
                  <XCircle aria-label="Not correct" className="mt-0.5 h-4 w-4 shrink-0 text-danger" />
                )}
                <span className="flex-1">
                  <span className="font-semibold">{item.label}</span> · {item.prompt}
                  {item.reference && <span className="block text-xs text-ink/60">{item.reference}</span>}
                </span>
                <span className="font-semibold tracking-wide">{item.answer}</span>
              </li>
            ))}
          </ul>
        </section>
      )}
      <div className="mt-7 flex flex-wrap justify-center gap-2">
        {mode !== "daily" && (
          <button type="button" className="btn-primary" onClick={onReplay}>
            Play again
          </button>
        )}
        {mode === "practice" && (
          <button type="button" className="btn-secondary" onClick={onChangeLevel}>
            Change level
          </button>
        )}
        <Link href={mode === "kids" ? "/dashboard/games?kids=1" : "/dashboard/games"} className={mode === "daily" ? "btn-primary" : "btn-ghost"}>
          Back to games
        </Link>
      </div>
    </div>
  );
}
