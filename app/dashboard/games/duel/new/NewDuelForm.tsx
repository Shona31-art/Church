"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Check, Swords } from "lucide-react";
import { Avatar } from "@/components/ui/Avatar";
import { callAction, CONNECTION_FAILED } from "@/lib/call-action";
import { DUEL_DEFAULT_LENGTH, DUEL_LENGTHS, DUEL_SECONDS } from "@/lib/games/duel";
import { LEVELS, LEVEL_LABELS, type Level } from "@/lib/games/catalog";
import { createDuel } from "../actions";

export function NewDuelForm({ people, preset }: { people: { id: string; name: string; photoUrl: string | null }[]; preset: string | null }) {
  const router = useRouter();
  const [who, setWho] = useState<string | null>(people.some((p) => p.id === preset) ? preset : null);
  const [query, setQuery] = useState("");
  const [level, setLevel] = useState<Level>("medium");
  const [length, setLength] = useState<number>(DUEL_DEFAULT_LENGTH);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const q = query.trim().toLowerCase();
  const shown = useMemo(() => people.filter((p) => !q || p.name.toLowerCase().includes(q)), [people, q]);
  const chosen = people.find((p) => p.id === who);

  async function send() {
    if (!who) return;
    setBusy(true);
    setError(null);
    const r = await callAction(() => createDuel(who, level, length), { error: CONNECTION_FAILED });
    if (r.error || !r.duelId) {
      setBusy(false);
      return setError(r.error ?? "Couldn't send the challenge.");
    }
    router.push(`/dashboard/games/duel/${r.duelId}`);
  }

  const chip = (on: boolean) => `rounded-full border px-4 py-2 text-sm ${on ? "border-gold bg-gold/15 font-semibold" : "border-line hover:border-line-strong"}`;

  return (
    <div className="space-y-6">
      <section>
        <h2 className="mb-2 font-medium">Who?</h2>
        <input type="search" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search names" aria-label="Search names" className="input" />
        <ul className="mt-2 max-h-72 space-y-1 overflow-y-auto rounded-2xl border border-line p-1" aria-label="Church members">
          {!shown.length && <li className="p-4 text-center text-sm text-ink/60">Nobody by that name.</li>}
          {shown.map((p) => (
            <li key={p.id}>
              <button type="button" onClick={() => setWho(p.id)} aria-pressed={who === p.id} className={`flex w-full items-center gap-3 rounded-xl px-2 py-2 text-left ${who === p.id ? "bg-gold/15" : "hover:bg-ink/5"}`}>
                <Avatar name={p.name} src={p.photoUrl} size="sm" />
                <span className="flex-1 truncate text-sm">{p.name}</span>
                {who === p.id && <Check aria-hidden className="h-4 w-4 text-gold" />}
              </button>
            </li>
          ))}
        </ul>
      </section>

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
        <p className="mt-2 text-xs text-ink/60">{DUEL_SECONDS} seconds per question — about {Math.ceil((length * DUEL_SECONDS) / 60)} minutes at most.</p>
      </section>

      {error && (
        <p role="alert" className="text-sm text-danger">
          {error}
        </p>
      )}
      <button type="button" onClick={send} disabled={!who || busy} className="btn-primary w-full">
        <Swords aria-hidden className="h-4 w-4" /> {busy ? "Sending…" : chosen ? `Challenge ${chosen.name.split(" ")[0]}` : "Choose who to challenge"}
      </button>
      <p className="text-center text-xs text-ink/60">They get a notification. You can play your turn straight away; they have two days to play theirs.</p>
    </div>
  );
}
