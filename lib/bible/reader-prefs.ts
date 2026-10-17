// Per-device reader conveniences kept in localStorage: the last place read.
// Not synced between devices, and fine to lose — so every read/write is
// wrapped in try/catch (storage can be blocked or full) and failures are ignored.

const LAST_PLACE_KEY = "bible:last-place";

export interface LastPlace {
  versionId: string;
  bookIndex: number;
  chapter: number;
}

export function readLastPlace(): LastPlace | null {
  try {
    const value = JSON.parse(localStorage.getItem(LAST_PLACE_KEY) ?? "null");
    if (value && typeof value.versionId === "string" && Number.isInteger(value.bookIndex) && Number.isInteger(value.chapter)) {
      return value;
    }
  } catch {
    // unreadable or blocked storage: start fresh
  }
  return null;
}

export function writeLastPlace(place: LastPlace): void {
  try {
    localStorage.setItem(LAST_PLACE_KEY, JSON.stringify(place));
  } catch {
    // storage blocked or full: remembering the place is a nicety, not required
  }
}
