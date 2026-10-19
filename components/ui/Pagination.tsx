import { ChevronLeft, ChevronRight } from "lucide-react";
import Link from "next/link";

/**
 * Previous/next links for server-side paginated lists. `hrefFor(page)` builds
 * the URL so the current search and filters are kept.
 */
export function Pagination({
  page,
  hasMore,
  hrefFor,
  summary,
}: {
  page: number;
  hasMore: boolean;
  hrefFor: (page: number) => string;
  summary?: string;
}) {
  if (page === 0 && !hasMore) return summary ? <p className="mt-4 text-xs text-ink/60">{summary}</p> : null;
  return (
    <nav aria-label="Pagination" className="mt-6 flex items-center justify-between gap-3 text-sm">
      {page > 0 ? (
        <Link href={hrefFor(page - 1)} className="btn-secondary btn-sm" rel="prev">
          <ChevronLeft aria-hidden className="h-4 w-4" /> Previous
        </Link>
      ) : (
        <span />
      )}
      <span className="tabular text-xs text-ink/60">{summary ?? `Page ${page + 1}`}</span>
      {hasMore ? (
        <Link href={hrefFor(page + 1)} className="btn-secondary btn-sm" rel="next">
          Next <ChevronRight aria-hidden className="h-4 w-4" />
        </Link>
      ) : (
        <span />
      )}
    </nav>
  );
}
