"use client";

import { useState } from "react";
import { useFormState } from "react-dom";
import { Plus, Timer, X } from "lucide-react";
import { createPrayerChain } from "./actions";
import { PendingButton } from "@/components/ConfirmSubmitButton";
import { Alert } from "@/components/ui/Alert";
import { FormActions, FormField } from "@/components/ui/FormField";

const chip = (on: boolean) => `rounded-full border px-3.5 py-2 text-sm font-medium ${on ? "border-ember bg-ember text-on-ember" : "border-line bg-surface text-ink/80"}`;

export function ChainForm({ defaultStart, today }: { defaultStart: string; today: string }) {
  const [open, setOpen] = useState(false);
  const [state, action] = useFormState(createPrayerChain, null);
  const v = state?.values;
  const [mode, setMode] = useState<"clock" | "times">((v?.mode as "clock" | "times") ?? "clock");
  const [times, setTimes] = useState<string[]>(v?.times ? v.times.split(",").filter(Boolean) : ["05:00", "15:00", "18:00"]);
  const [newTime, setNewTime] = useState("12:00");

  if (!open)
    return (
      <button type="button" className="btn-primary" onClick={() => setOpen(true)}>
        <Timer aria-hidden className="h-4 w-4" /> New prayer chain
      </button>
    );
  const addTime = () => setTimes((t) => (newTime && !t.includes(newTime) && t.length < 24 ? [...t, newTime].sort() : t));

  return (
    <form action={action} className="card-elevated space-y-4 rounded-2xl p-5" noValidate>
      <input type="hidden" name="mode" value={mode} />
      <input type="hidden" name="times" value={times.join(",")} />
      {state?.error && <Alert tone="error">{state.error}</Alert>}
      <FormField label="Name" htmlFor="title" required>
        <input id="title" name="title" maxLength={120} required defaultValue={v?.title} placeholder="e.g. 7 days of prayer & fasting" className="input" />
      </FormField>
      <FormField label="What are we praying for?" htmlFor="description" optional>
        <textarea id="description" name="description" rows={3} maxLength={1000} defaultValue={v?.description} className="input" />
      </FormField>

      <fieldset>
        <legend className="mb-2 text-sm font-semibold">When</legend>
        <div className="flex flex-wrap gap-2">
          <button type="button" aria-pressed={mode === "clock"} className={chip(mode === "clock")} onClick={() => setMode("clock")}>
            Round the clock
          </button>
          <button type="button" aria-pressed={mode === "times"} className={chip(mode === "times")} onClick={() => setMode("times")}>
            Only at set times
          </button>
        </div>
      </fieldset>

      {mode === "clock" ? (
        <div className="grid gap-4 sm:grid-cols-2">
          <FormField label="Starts" htmlFor="starts_at" required>
            <input id="starts_at" name="starts_at" type="datetime-local" required defaultValue={v?.starts_at ?? defaultStart} className="input" />
          </FormField>
          <FormField label="How long" htmlFor="hours">
            <select id="hours" name="hours" defaultValue={v?.hours ?? "24"} className="input">
              <option value="1">1 hour</option>
              <option value="2">2 hours</option>
              <option value="3">3 hours</option>
              <option value="6">6 hours</option>
              <option value="12">12 hours</option>
              <option value="24">24 hours</option>
              <option value="72">3 days</option>
              <option value="168">7 days</option>
              <option value="504">21 days</option>
              <option value="720">30 days</option>
            </select>
          </FormField>
        </div>
      ) : (
        <>
          <div className="grid gap-4 sm:grid-cols-2">
            <FormField label="First day" htmlFor="start_date" required>
              <input id="start_date" name="start_date" type="date" required defaultValue={v?.start_date ?? today} className="input" />
            </FormField>
            <FormField label="For how many days" htmlFor="days">
              <select id="days" name="days" defaultValue={v?.days ?? "7"} className="input">
                {[1, 3, 5, 7, 10, 14, 21, 30, 40].map((d) => (
                  <option key={d} value={d}>
                    {d === 1 ? "1 day" : `${d} days`}
                  </option>
                ))}
              </select>
            </FormField>
          </div>
          <div>
            <p className="mb-2 text-sm font-semibold">Prayer times each day</p>
            <ul className="mb-3 flex flex-wrap gap-2">
              {times.map((t) => (
                <li key={t} className="inline-flex items-center gap-1 rounded-full border border-line bg-surface py-1 pl-3 pr-1 text-sm font-semibold tabular-nums">
                  {t}
                  <button type="button" onClick={() => setTimes((x) => x.filter((y) => y !== t))} className="rounded-full p-1 text-ink/50 hover:text-ink" aria-label={`Remove ${t}`}>
                    <X aria-hidden className="h-3.5 w-3.5" />
                  </button>
                </li>
              ))}
              {!times.length && <li className="text-sm text-danger">Add at least one time.</li>}
            </ul>
            <div className="flex gap-2">
              <input type="time" value={newTime} onChange={(e) => setNewTime(e.target.value)} className="input w-36" aria-label="Prayer time to add" />
              <button type="button" className="btn-secondary" onClick={addTime}>
                <Plus aria-hidden className="h-4 w-4" /> Add time
              </button>
            </div>
          </div>
        </>
      )}

      <div className="grid gap-4 sm:grid-cols-2">
        <FormField label={mode === "clock" ? "Each slot" : "Each prayer time lasts"} htmlFor="slot_minutes">
          <select id="slot_minutes" name="slot_minutes" defaultValue={v?.slot_minutes ?? (mode === "clock" ? "60" : "30")} className="input">
            <option value="15">15 minutes</option>
            <option value="30">30 minutes</option>
            <option value="60">1 hour</option>
            <option value="120">2 hours</option>
          </select>
        </FormField>
        <FormField label="People per slot" htmlFor="max_per_slot">
          <input id="max_per_slot" name="max_per_slot" type="number" min={1} max={50} defaultValue={v?.max_per_slot ?? "3"} className="input" />
        </FormField>
      </div>
      <FormActions>
        <PendingButton pendingLabel="Creating…" disabled={mode === "times" && !times.length}>
          Create and invite the church
        </PendingButton>
        <button type="button" className="btn-ghost" onClick={() => setOpen(false)}>
          Cancel
        </button>
      </FormActions>
    </form>
  );
}
