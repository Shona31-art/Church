// Fill-in-the-blank sermon notes (church_life.sql → sermon_outlines). The
// pastor writes blanks as [[answer]]; members see an empty box for each.

export type OutlinePart = { text: string } | { blank: number; answer: string };

const BLANK = /\[\[([^\[\]\n]{1,80})\]\]/g;

/** The note split into text and numbered blanks. */
export function parseOutline(body: string): OutlinePart[] {
  const parts: OutlinePart[] = [];
  let last = 0;
  let n = 0;
  for (const m of body.matchAll(BLANK)) {
    if (m.index! > last) parts.push({ text: body.slice(last, m.index) });
    parts.push({ blank: n++, answer: m[1].trim() });
    last = m.index! + m[0].length;
  }
  if (last < body.length) parts.push({ text: body.slice(last) });
  return parts;
}

export const blankCount = (body: string) => [...body.matchAll(BLANK)].length;

/** The note with the member's answers filled in (empty ones shown as ____). */
export function fillOutline(body: string, answers: readonly string[]): string {
  return parseOutline(body)
    .map((p) => ("text" in p ? p.text : (answers[p.blank] ?? "").trim() || "____"))
    .join("");
}

/** The note as the congregation reads it before the service (blanks empty). */
export const outlinePreview = (body: string) => fillOutline(body, []);

/** Answer matching, forgiving of case, spaces and punctuation. */
export const sameAnswer = (given: string, answer: string) => {
  const clean = (s: string) => s.toLowerCase().replace(/[^\p{L}\p{N}]+/gu, " ").trim();
  return clean(given) !== "" && clean(given) === clean(answer);
};
