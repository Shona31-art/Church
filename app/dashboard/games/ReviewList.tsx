import { CheckCircle2, XCircle } from "lucide-react";
import type { ReviewItem } from "./engine";

/** The after-game "Answers" list: what each answer was and whether you got it. */
export function ReviewList({ items }: { items: ReviewItem[] }) {
  return (
    <section className="mt-8 text-left" aria-labelledby="review-heading">
      <h2 id="review-heading" className="eyebrow mb-2">
        Answers
      </h2>
      <ul className="divide-y divide-line rounded-xl border border-line">
        {items.map((item, i) => (
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
  );
}
