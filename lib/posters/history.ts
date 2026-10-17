// Undo/redo for the poster editor. Pure and immutable: each change records a
// whole design snapshot (designs are small JSON), capped so a long session
// can't use unbounded memory. Unit-tested in tests/unit/poster-editor.test.ts.

export const HISTORY_LIMIT = 100;

export interface History<T> {
  past: T[];
  present: T;
  future: T[];
}

export function createHistory<T>(present: T): History<T> {
  return { past: [], present, future: [] };
}

/** Records a new state. Clears redo. Ignores a "change" to the identical object. */
export function record<T>(history: History<T>, next: T): History<T> {
  if (next === history.present) return history;
  return { past: [...history.past, history.present].slice(-HISTORY_LIMIT), present: next, future: [] };
}

/** Replaces the present without a new undo step (e.g. each keystroke while typing, committed once on blur). */
export function replacePresent<T>(history: History<T>, next: T): History<T> {
  return { ...history, present: next };
}

/**
 * Records `next`, but merges it into the previous step when it's the same
 * kind of change (same `key`, e.g. "title:text") made within `windowMs` —
 * so typing a word or dragging a colour picker is one undo step, not dozens.
 */
export function recordCoalesced<T>(
  history: History<T>,
  next: T,
  key: string,
  last: { key: string; at: number },
  now: number,
  windowMs = 1000,
): History<T> {
  const merge = key !== "" && key === last.key && now - last.at < windowMs && history.past.length > 0;
  return merge ? replacePresent(history, next) : record(history, next);
}

export function undo<T>(history: History<T>): History<T> {
  if (!history.past.length) return history;
  return { past: history.past.slice(0, -1), present: history.past[history.past.length - 1], future: [history.present, ...history.future] };
}

export function redo<T>(history: History<T>): History<T> {
  if (!history.future.length) return history;
  return { past: [...history.past, history.present], present: history.future[0], future: history.future.slice(1) };
}
