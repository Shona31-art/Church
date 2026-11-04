// Prayer chain slots (church_life.sql, church_life_v2.sql): round the clock,
// or only at set times each day. Shared by the chain page and the Monday report.
import { APP_TIMEZONE, localInputToUtcIso } from "@/lib/format";

export interface ChainTimes {
  starts_at: string;
  ends_at: string;
  slot_minutes: number;
  times?: string[] | null;
}

const localDate = (ms: number) => new Date(ms).toLocaleDateString("en-CA", { timeZone: APP_TIMEZONE });

/** Every slot start (ms): set times on each day, or back-to-back slots round the clock. */
export function slotStarts(chain: ChainTimes): number[] {
  const start = Date.parse(chain.starts_at);
  const end = Date.parse(chain.ends_at);
  const out: number[] = [];
  if (chain.times?.length) {
    for (let day = start; day < end; day += 86_400_000) {
      const date = localDate(day);
      for (const t of chain.times) {
        const iso = localInputToUtcIso(`${date}T${t}`);
        if (iso && Date.parse(iso) >= start && Date.parse(iso) < end) out.push(Date.parse(iso));
      }
    }
    return [...new Set(out)].sort((a, b) => a - b);
  }
  for (let t = start; t < end; t += chain.slot_minutes * 60_000) out.push(t);
  return out;
}

/** "daily at 05:00, 15:00 and 18:00" or "round the clock". */
export function chainSchedule(chain: ChainTimes): string {
  const t = chain.times ?? [];
  if (!t.length) return "round the clock";
  return `daily at ${t.length === 1 ? t[0] : `${t.slice(0, -1).join(", ")} and ${t[t.length - 1]}`}`;
}
