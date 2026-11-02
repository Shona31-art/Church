"use client";

import { useState } from "react";
import { BarChart3, Check } from "lucide-react";
import { tallyPoll, type PollVote } from "@/lib/chat";

/**
 * A poll in the chat: tap an option to vote (tap again to take it back;
 * several options if the poll allows). Results update live; "See votes"
 * shows who chose what, like WhatsApp.
 */
export function PollCard({
  question,
  options,
  allowMultiple,
  votes,
  currentUserId,
  nameOf,
  onVote,
  onDark,
}: {
  question: string;
  options: string[];
  allowMultiple: boolean;
  votes: PollVote[];
  currentUserId: string;
  nameOf: (id: string) => string;
  onVote?: (choices: number[]) => void;
  onDark: boolean;
}) {
  const [showVoters, setShowVoters] = useState(false);
  const { counts, voters, total } = tallyPoll(options.length, votes);
  const mine = votes.filter((v) => v.user_id === currentUserId).map((v) => v.option_index);
  const most = Math.max(1, ...counts);

  function choose(i: number) {
    if (!onVote) return;
    if (allowMultiple) onVote(mine.includes(i) ? mine.filter((x) => x !== i) : [...mine, i]);
    else onVote(mine.includes(i) ? [] : [i]);
  }

  return (
    <div className="min-w-[14rem] space-y-2">
      <p className="flex items-start gap-1.5 font-semibold">
        <BarChart3 aria-hidden className="mt-0.5 h-4 w-4 shrink-0" />
        {question}
      </p>
      <p className={`text-xs ${onDark ? "text-on-ember/70" : "text-ink/60"}`}>{allowMultiple ? "Choose one or more" : "Choose one"}</p>
      <ul className="space-y-1.5" role="group" aria-label={`Poll: ${question}`}>
        {options.map((option, i) => {
          const chosen = mine.includes(i);
          return (
            <li key={i}>
              <button
                type="button"
                onClick={() => choose(i)}
                disabled={!onVote}
                aria-pressed={chosen}
                className={`relative w-full overflow-hidden rounded-lg border px-2.5 py-1.5 text-left text-sm ${onDark ? "border-on-ember/30" : "border-line"} ${chosen ? "font-semibold" : ""}`}
              >
                <span aria-hidden className={`absolute inset-y-0 left-0 ${onDark ? "bg-on-ember/20" : "bg-gold/20"}`} style={{ width: `${(counts[i] / most) * 100}%` }} />
                <span className="relative flex items-center justify-between gap-2">
                  <span className="flex items-center gap-1.5">
                    {chosen && <Check aria-hidden className="h-3.5 w-3.5" />}
                    {option}
                  </span>
                  <span className="tabular text-xs">
                    {counts[i]}
                    <span className="sr-only"> {counts[i] === 1 ? "vote" : "votes"}</span>
                  </span>
                </span>
              </button>
            </li>
          );
        })}
      </ul>
      <button type="button" className={`text-xs underline ${onDark ? "text-on-ember/80" : "text-ink/60"}`} onClick={() => setShowVoters((s) => !s)}>
        {total === 0 ? "No votes yet" : `${total} ${total === 1 ? "person" : "people"} voted · ${showVoters ? "Hide votes" : "See votes"}`}
      </button>
      {showVoters && total > 0 && (
        <ul className={`space-y-1 text-xs ${onDark ? "text-on-ember/85" : "text-ink/70"}`}>
          {options.map((option, i) =>
            voters[i].length ? (
              <li key={i}>
                <span className="font-semibold">{option}:</span> {voters[i].map((id) => (id === currentUserId ? "You" : nameOf(id))).join(", ")}
              </li>
            ) : null
          )}
        </ul>
      )}
    </div>
  );
}
