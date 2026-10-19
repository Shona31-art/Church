import Link from "next/link";
import { formatDate, formatTime } from "@/lib/format";
import { buildMonthGrid, eventDays, monthKey, shiftMonth, type YearMonth } from "@/lib/calendar-grid";
import { ChevronLeft, ChevronRight } from "lucide-react";

export interface MonthEvent {
  id: string;
  title: string;
  start_time: string;
  end_time: string | null;
  cancelled_at: string | null;
}

const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const MAX_PER_CELL = 3;

/**
 * Month grid for the calendar page. Wide screens show event titles in each
 * day; phones show a dot per day plus the month's events as a list underneath,
 * because titles don't fit in a 50px-wide cell.
 */
export function MonthView({ ym, today, events }: { ym: YearMonth; today: string; events: MonthEvent[] }) {
  const weeks = buildMonthGrid(ym);
  const byDay = new Map<string, MonthEvent[]>();
  for (const e of events) {
    for (const day of eventDays(e.start_time, e.end_time)) {
      byDay.set(day, [...(byDay.get(day) ?? []), e]);
    }
  }

  const label = new Date(Date.UTC(ym.year, ym.month - 1, 15)).toLocaleDateString("en-ZA", { month: "long", year: "numeric", timeZone: "UTC" });
  const href = (target: YearMonth) => `?when=month&month=${monthKey(target)}`;
  const isCurrentMonth = monthKey(ym) === today.slice(0, 7);

  return (
    <div>
      <div className="mb-3 flex items-center justify-between gap-2">
        <h2 className="text-lg font-semibold" aria-live="polite">
          {label}
        </h2>
        <div className="flex items-center gap-1">
          {!isCurrentMonth && (
            <Link href="?when=month" className="btn-secondary px-3 py-1.5 text-sm">
              Today
            </Link>
          )}
          <Link href={href(shiftMonth(ym, -1))} className="btn-secondary btn-icon" aria-label="Previous month">
            <ChevronLeft aria-hidden className="h-4 w-4" />
          </Link>
          <Link href={href(shiftMonth(ym, 1))} className="btn-secondary btn-icon" aria-label="Next month">
            <ChevronRight aria-hidden className="h-4 w-4" />
          </Link>
        </div>
      </div>

      <table className="w-full table-fixed border-collapse card-elevated rounded-2xl overflow-hidden">
        <caption className="sr-only">Events in {label}</caption>
        <thead>
          <tr>
            {WEEKDAYS.map((d) => (
              <th key={d} scope="col" className="py-2 text-xs font-medium uppercase tracking-wide text-ink/60 border-b border-line">
                {d}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {weeks.map((week) => (
            <tr key={week[0].date}>
              {week.map((day) => {
                const list = byDay.get(day.date) ?? [];
                const isToday = day.date === today;
                return (
                  <td key={day.date} className={`align-top border-t border-l first:border-l-0 border-line p-1 h-14 md:h-24 ${day.inMonth ? "" : "bg-ink/[0.02]"}`}>
                    <span className="sr-only">{formatDate(day.date)}{isToday ? " (today)" : ""}</span>
                    <span
                      aria-hidden
                      className={`inline-flex h-6 w-6 items-center justify-center rounded-full text-xs ${
                        isToday ? "bg-ember text-on-ember font-semibold" : day.inMonth ? "text-ink" : "text-ink/30"
                      }`}
                    >
                      {Number(day.date.slice(8))}
                    </span>

                    {list.length > 0 && (
                      <>
                        {/* Phones: one dot per day; the list below the grid carries the details. */}
                        <span className="md:hidden mt-1 flex justify-center" aria-hidden>
                          <span className="h-1.5 w-1.5 rounded-full bg-ember" />
                        </span>
                        <span className="sr-only md:hidden">
                          {list.length} event{list.length === 1 ? "" : "s"}
                        </span>

                        <ul className="hidden md:block mt-1 space-y-0.5">
                          {list.slice(0, MAX_PER_CELL).map((e) => (
                            <li key={e.id}>
                              <Link
                                href={`/dashboard/calendar/${e.id}`}
                                className={`block truncate rounded px-1 py-0.5 text-xs bg-info-tint text-info hover:underline ${e.cancelled_at ? "line-through opacity-60" : ""}`}
                                title={e.title}
                              >
                                <span className="font-medium">{formatTime(e.start_time)}</span> {e.title}
                                {e.cancelled_at && <span className="sr-only"> (cancelled)</span>}
                              </Link>
                            </li>
                          ))}
                          {list.length > MAX_PER_CELL && <li className="px-1 text-xs text-ink/60">+{list.length - MAX_PER_CELL} more</li>}
                        </ul>
                      </>
                    )}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>

      {/* Phones: the month's events as a tappable list. */}
      <section aria-label={`All events in ${label}`} className="md:hidden mt-4">
        {events.length === 0 ? (
          <p className="text-sm text-ink/60">No events this month.</p>
        ) : (
          <ul className="space-y-2">
            {events.map((e) => (
              <li key={e.id}>
                <Link href={`/dashboard/calendar/${e.id}`} className="card-elevated rounded-2xl p-3 block">
                  <p className={`font-medium ${e.cancelled_at ? "line-through text-ink/60" : ""}`}>{e.title}</p>
                  <p className="text-sm text-ink/60">
                    {formatDate(e.start_time)} · {formatTime(e.start_time)}
                    {e.cancelled_at ? " · Cancelled" : ""}
                  </p>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
