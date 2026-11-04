"use client";

import { useId, useState } from "react";
import { NO_YEAR } from "@/lib/birthdays";

const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
const DAYS_IN = [31, 29, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];

/**
 * A birthday as day + month, with the year optional. Others only ever see the
 * day and month ("14 March"), never the year or an age. Submits one hidden
 * field `name` = YYYY-MM-DD (year 1904 when left out — see lib/birthdays.ts),
 * or "" when no birthday is given, so the server code stays the same.
 */
export function BirthdayField({ name, label = "Birthday", defaultValue, error, hint }: { name: string; label?: string; defaultValue?: string | null; error?: string; hint?: string }) {
  const id = useId();
  const [y0, m0, d0] = (defaultValue ?? "").split("-");
  const [day, setDay] = useState(d0 ? String(Number(d0)) : "");
  const [month, setMonth] = useState(m0 ? String(Number(m0)) : "");
  const [year, setYear] = useState(y0 && Number(y0) !== NO_YEAR ? y0 : "");

  const thisYear = new Date().getFullYear();
  const maxDay = month ? DAYS_IN[Number(month) - 1] : 31;
  const yearOk = !year || (/^\d{4}$/.test(year) && Number(year) >= 1900 && Number(year) <= thisYear);
  const value = day && month && yearOk ? `${year || NO_YEAR}-${month.padStart(2, "0")}-${String(Math.min(Number(day), maxDay)).padStart(2, "0")}` : "";

  return (
    <fieldset aria-describedby={`${id}-hint`}>
      <legend className="label">
        {label} <span className="font-normal text-ink/60">(optional)</span>
      </legend>
      <div className="grid grid-cols-[4.75rem_minmax(0,1fr)_5.5rem] gap-2">
        <select aria-label="Day" className="input" value={day} onChange={(e) => setDay(e.target.value)} aria-invalid={Boolean(error)}>
          <option value="">Day</option>
          {Array.from({ length: maxDay }, (_, i) => (
            <option key={i + 1} value={String(i + 1)}>
              {i + 1}
            </option>
          ))}
        </select>
        <select aria-label="Month" className="input" value={month} onChange={(e) => setMonth(e.target.value)} aria-invalid={Boolean(error)}>
          <option value="">Month</option>
          {MONTHS.map((m, i) => (
            <option key={m} value={String(i + 1)}>
              {m}
            </option>
          ))}
        </select>
        <input
          aria-label="Year (optional)"
          className="input"
          inputMode="numeric"
          maxLength={4}
          placeholder="Year"
          value={year}
          onChange={(e) => setYear(e.target.value.replace(/\D/g, "").slice(0, 4))}
          aria-invalid={!yearOk || Boolean(error)}
        />
      </div>
      <input type="hidden" name={name} value={value} />
      <p id={`${id}-hint`} className="hint mt-1">
        {hint ?? "Only the day and month are shown — never the year or age. The year is optional."}
      </p>
      {!yearOk && <p className="mt-1 text-sm text-danger">Enter a 4-digit year, or leave it empty.</p>}
      {error && <p className="mt-1 text-sm text-danger">{error}</p>}
      {(day || month) && !(day && month) && <p className="mt-1 text-sm text-ink/60">Choose both the day and the month.</p>}
    </fieldset>
  );
}
