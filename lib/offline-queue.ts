// Write without signal: journal entries and prayer requests made offline are
// kept on this device and sent automatically when the connection returns
// (components/OfflineQueue.tsx). Browser only; cleared on sign-out.
//
// Kept in localStorage on purpose: small, survives the app being closed, and
// lives only on the person's own device until it's sent.

export type QueuedKind = "journal" | "prayer";

export interface QueuedItem {
  id: string;
  kind: QueuedKind;
  fields: Record<string, string>;
  queuedAt: string;
}

export const QUEUE_KEY = "offline-queue";
export const QUEUE_EVENT = "offline-queue-changed";
const MAX_ITEMS = 50;

export function readQueue(): QueuedItem[] {
  try {
    const parsed = JSON.parse(localStorage.getItem(QUEUE_KEY) ?? "[]");
    return Array.isArray(parsed) ? parsed.filter((i) => i && (i.kind === "journal" || i.kind === "prayer") && typeof i.fields === "object") : [];
  } catch {
    return [];
  }
}

function writeQueue(items: QueuedItem[]) {
  try {
    if (items.length) localStorage.setItem(QUEUE_KEY, JSON.stringify(items));
    else localStorage.removeItem(QUEUE_KEY);
  } catch {
    // Storage blocked: nothing more we can do; the form told the person.
  }
  window.dispatchEvent(new Event(QUEUE_EVENT));
}

/** Saves a form for later. Returns false when it couldn't be stored (full or blocked). */
export function enqueue(kind: QueuedKind, form: HTMLFormElement): boolean {
  const fields: Record<string, string> = {};
  new FormData(form).forEach((value, key) => {
    // Skip React's own hidden fields for the server action ($ACTION_…).
    if (typeof value === "string" && !key.startsWith("$ACTION")) fields[key] = value;
  });
  const items = readQueue();
  if (items.length >= MAX_ITEMS) return false;
  const item: QueuedItem = { id: crypto.randomUUID(), kind, fields, queuedAt: new Date().toISOString() };
  writeQueue([...items, item]);
  return readQueue().some((i) => i.id === item.id);
}

export function removeFromQueue(id: string) {
  writeQueue(readQueue().filter((i) => i.id !== id));
}

export function clearQueue() {
  writeQueue([]);
}

/** Is the browser offline right now? (navigator.onLine is only trustworthy when it says false.) */
export const isOffline = () => typeof navigator !== "undefined" && navigator.onLine === false;
