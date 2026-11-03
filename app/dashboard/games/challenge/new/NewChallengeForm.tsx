"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Church } from "lucide-react";
import { callAction, CONNECTION_FAILED } from "@/lib/call-action";
import { DUEL_DEFAULT_LENGTH, DUEL_LENGTHS, DUEL_SECONDS } from "@/lib/games/duel";
import { CHALLENGE_DURATIONS } from "@/lib/games/challenge";
import { LEVELS, LEVEL_LABELS, type Level } from "@/lib/games/catalog";
import { createChallenge } from "../actions";

export function NewChallengeForm() {
  const router = useRouter();
  const [title, setTitle] = useState("Sunday Bible Challenge");
  const [level, setLevel] = useState<Level>("medium");
  const [length, setLength] = useState<number>(DUEL_DEFAULT_LENGTH);
  const [hours, setHours] = useState<number>(24);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function start() {
    setBusy(true);
    setError(null);
    const r = await callAction(() => createChallenge({ title, level, length, hours }), { error: CONNECTION_FAILED });
    if (r.error || !r.id) {
      setBusy(false);
      return setError(r.error ?? "Couldn't start the challenge.");
    }
    router.push(`/dashboard/games/challenge/${r.id}`);
  }

  const chip = (on: boolean) => `rounded-full border px-4 py-2 text-sm ${on ? "border-gold bg-gold/15 font-semibold" : "border-line hover:border-line-strong"}`;

  return (
    <div className="space-y-6">
      <div>
        <label htmlFor="challenge-title" className="mb-2 block font-medium">
          Name
        </label>
        <input id="challenge-title" value={title} onChange={(e) => setTitle(e.target.value)} maxLength={80} className="input" />
      </div>
      <section>
        <h2 className="mb-2 font-medium">Level</h2>
        <div className="flex flex-wrap gap-2">
          {LEVELS.map((l) => (
            <button key={l} type="button" aria-pressed={level === l} onClick={() => setLevel(l)} className={chip(level === l)}>
              {LEVEL_LABELS[l]}
            </button>
          ))}
        </div>
      </section>
      <section>
        <h2 className="mb-2 font-medium">How many questions?</h2>
        <div className="flex flex-wrap gap-2">
          {DUEL_LENGTHS.map((n) => (
            <button key={n} type="button" aria-pressed={length === n} onClick={() => setLength(n)} className={chip(length === n)}>
              {n}
            </button>
          ))}
        </div>
        <p className="mt-2 text-xs text-ink/60">{DUEL_SECONDS} seconds per question.</p>
      </section>
      <section>
        <h2 className="mb-2 font-medium">Open for</h2>
        <div className="flex flex-wrap gap-2">
          {CHALLENGE_DURATIONS.map((d) => (
            <button key={d.hours} type="button" aria-pressed={hours === d.hours} onClick={() => setHours(d.hours)} className={chip(hours === d.hours)}>
              {d.label}
            </button>
          ))}
        </div>
        <p className="mt-2 text-xs text-ink/60">When it closes, everyone who played is told the winner and where they came. You can close it early.</p>
      </section>
      {error && (
        <p role="alert" className="text-sm text-danger">
          {error}
        </p>
      )}
      <button type="button" onClick={start} disabled={busy || !title.trim()} className="btn-primary w-full">
        <Church aria-hidden className="h-4 w-4" /> {busy ? "Starting…" : "Start — notify everyone"}
      </button>
    </div>
  );
}
