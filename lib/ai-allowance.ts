import { todayInAppZone } from "@/lib/format";

/** The first day of this month and next (YYYY-MM-DD, the app's time zone). */
export function monthBounds(today = todayInAppZone()): { start: string; nextMonth: string } {
  const [y, m] = today.split("-").map(Number);
  const next = m === 12 ? `${y + 1}-01-01` : `${y}-${String(m + 1).padStart(2, "0")}-01`;
  return { start: `${today.slice(0, 7)}-01`, nextMonth: next };
}

