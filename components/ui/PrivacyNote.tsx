import { Lock } from "lucide-react";

/**
 * "Who can see this" line under a page or section title (journal, care log,
 * counselling, sermon notes). The lock replaces the 🔒 emoji these pages
 * used, so the icon matches the rest of the app's lucide set.
 */
export function PrivacyNote({ children }: { children: React.ReactNode }) {
  return (
    <span className="inline-flex items-start gap-1.5">
      <Lock aria-hidden className="mt-[3px] h-3.5 w-3.5 shrink-0 text-gold" strokeWidth={2} />
      <span>{children}</span>
    </span>
  );
}
