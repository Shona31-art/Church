// Per-device reader conveniences kept in localStorage: the last place read
// and reading settings. Not synced between devices, and fine to lose — so
// every read/write is wrapped in try/catch (storage can be blocked or full)
// and failures are ignored.

const LAST_PLACE_KEY = "bible:last-place";
const SETTINGS_KEY = "bible:settings";

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

// ---------------------------------------------------------------------------
// Reading settings

export const TEXT_SIZES = ["small", "medium", "large", "xlarge"] as const;
export const LINE_SPACINGS = ["compact", "normal", "relaxed"] as const;
export const FONTS = ["sans", "serif"] as const;
export const LAYOUTS = ["verses", "paragraph"] as const;

export interface ReaderSettings {
  textSize: (typeof TEXT_SIZES)[number];
  lineSpacing: (typeof LINE_SPACINGS)[number];
  font: (typeof FONTS)[number];
  /** "verses": each verse on its own line. "paragraph": continuous text like a printed Bible. */
  layout: (typeof LAYOUTS)[number];
  /** A second version shown under each verse, or null for none. */
  compareWith: string | null;
}

export const DEFAULT_SETTINGS: ReaderSettings = {
  textSize: "medium",
  lineSpacing: "normal",
  font: "sans",
  layout: "verses",
  compareWith: null,
};

/** Keeps only known values, so an old or hand-edited entry can't break the reader. */
export function sanitizeSettings(value: unknown): ReaderSettings {
  const v = (value && typeof value === "object" ? value : {}) as Record<string, unknown>;
  const pick = <T extends string>(options: readonly T[], x: unknown, fallback: T): T => (options.includes(x as T) ? (x as T) : fallback);
  return {
    textSize: pick(TEXT_SIZES, v.textSize, DEFAULT_SETTINGS.textSize),
    lineSpacing: pick(LINE_SPACINGS, v.lineSpacing, DEFAULT_SETTINGS.lineSpacing),
    font: pick(FONTS, v.font, DEFAULT_SETTINGS.font),
    layout: pick(LAYOUTS, v.layout, DEFAULT_SETTINGS.layout),
    compareWith: typeof v.compareWith === "string" ? v.compareWith : null,
  };
}

export function readSettings(): ReaderSettings {
  try {
    return sanitizeSettings(JSON.parse(localStorage.getItem(SETTINGS_KEY) ?? "null"));
  } catch {
    return DEFAULT_SETTINGS;
  }
}

export function writeSettings(settings: ReaderSettings): void {
  try {
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
  } catch {
    // storage blocked or full: settings last for this visit only
  }
}
