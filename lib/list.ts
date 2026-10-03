// Helpers for server-side paginated, searchable lists (pure — unit-tested).

export const PAGE_SIZE = 25;

/** Builds "?a=1&b=2" from the current filters, dropping empty values and page 0. */
export function buildQuery(params: Record<string, string | number | undefined | null>): string {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value === undefined || value === null || value === "") continue;
    if (key === "page" && Number(value) === 0) continue;
    search.set(key, String(value));
  }
  const s = search.toString();
  return s ? `?${s}` : "?";
}

/** Parses ?page= safely: anything that isn't a positive whole number is page 0. */
export function pageFrom(value: string | undefined): number {
  const n = Number(value);
  return Number.isInteger(n) && n > 0 ? Math.min(n, 10_000) : 0;
}

/** Escapes LIKE wildcards so a search for "50%" means literally that. */
export function likePattern(q: string): string {
  return `%${q.replace(/[%_\\]/g, (m) => `\\${m}`)}%`;
}

/**
 * likePattern for use inside a PostgREST .or() filter string, where commas,
 * parentheses and quotes are syntax. They become spaces, so searching for
 * "Smith, John" can't break or alter the filter.
 */
export function orFilterPattern(q: string): string {
  return likePattern(q.replace(/[,()"]/g, " ").replace(/\s+/g, " ").trim());
}
