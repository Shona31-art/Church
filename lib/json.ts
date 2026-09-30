/**
 * Pulls the first JSON object/array out of model output. Models sometimes wrap
 * JSON in ```json fences or add a sentence before it, so we slice from the
 * first "{"/"[" to the matching last "}"/"]" rather than trusting the raw text.
 * Returns null (never throws) if nothing parseable is found.
 */
export function extractJson<T>(text: string): T | null {
  const cleaned = text.replace(/```(?:json)?/gi, "").trim();
  const start = cleaned.search(/[[{]/);
  if (start === -1) return null;
  const close = cleaned[start] === "[" ? "]" : "}";
  const end = cleaned.lastIndexOf(close);
  if (end <= start) return null;
  try {
    return JSON.parse(cleaned.slice(start, end + 1)) as T;
  } catch {
    return null;
  }
}
