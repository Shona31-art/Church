"use client";

import { useState } from "react";
import { useFormState } from "react-dom";
import { BookMarked } from "lucide-react";
import { createReadingPlan } from "./actions";
import { PendingButton } from "@/components/ConfirmSubmitButton";
import { Alert } from "@/components/ui/Alert";
import { FormActions, FormField } from "@/components/ui/FormField";
import { BOOKS } from "@/lib/bible/books";
import { PRESETS, buildDays } from "@/lib/reading-plans";

export function PlanForm({ today, canChurchWide }: { today: string; canChurchWide: boolean }) {
  const [open, setOpen] = useState(false);
  const [state, action] = useFormState(createReadingPlan, null);
  const [preset, setPreset] = useState(PRESETS[0].key);
  const [from, setFrom] = useState("John");
  const [to, setTo] = useState("John");
  const [perDay, setPerDay] = useState(PRESETS[0].perDay);
  const p = PRESETS.find((x) => x.key === preset);
  const days = buildDays(p?.from ?? from, p?.to ?? to, perDay).length;

  if (!open)
    return (
      <button type="button" className="btn-primary" onClick={() => setOpen(true)}>
        <BookMarked aria-hidden className="h-4 w-4" /> Start a plan
      </button>
    );
  return (
    <form action={action} className="card-elevated space-y-4 rounded-2xl p-5" noValidate>
      {state?.error && <Alert tone="error">{state.error}</Alert>}
      <FormField label="Plan" htmlFor="preset">
        <select
          id="preset"
          name="preset"
          value={preset}
          onChange={(e) => {
            setPreset(e.target.value);
            setPerDay(PRESETS.find((x) => x.key === e.target.value)?.perDay ?? 1);
          }}
          className="input"
        >
          {PRESETS.map((x) => (
            <option key={x.key} value={x.key}>
              {x.title}
            </option>
          ))}
          <option value="custom">Choose my own books…</option>
        </select>
      </FormField>
      {p && <p className="-mt-2 text-sm text-ink/60">{p.description}</p>}
      {!p && (
        <div className="grid gap-4 sm:grid-cols-2">
          <FormField label="From" htmlFor="from">
            <select id="from" name="from" value={from} onChange={(e) => setFrom(e.target.value)} className="input">
              {BOOKS.map((b) => (
                <option key={b.name}>{b.name}</option>
              ))}
            </select>
          </FormField>
          <FormField label="To" htmlFor="to">
            <select id="to" name="to" value={to} onChange={(e) => setTo(e.target.value)} className="input">
              {BOOKS.map((b) => (
                <option key={b.name}>{b.name}</option>
              ))}
            </select>
          </FormField>
        </div>
      )}
      <div className="grid gap-4 sm:grid-cols-3">
        <FormField label="Chapters a day" htmlFor="per_day">
          <select id="per_day" name="per_day" value={perDay} onChange={(e) => setPerDay(Number(e.target.value))} className="input">
            {[1, 2, 3, 4, 5, 6, 8, 10].map((n) => (
              <option key={n}>{n}</option>
            ))}
          </select>
        </FormField>
        <FormField label="Start" htmlFor="start_date">
          <input id="start_date" name="start_date" type="date" defaultValue={today} className="input" />
        </FormField>
        <FormField label="Name" htmlFor="title" optional>
          <input id="title" name="title" maxLength={120} placeholder={p?.title ?? `${from} to ${to}`} className="input" />
        </FormField>
      </div>
      <p className="text-sm font-medium">{days ? `${days} days` : "The last book must come after the first."}</p>
      {canChurchWide && (
        <label className="flex items-center gap-2 text-sm font-medium">
          <input type="checkbox" name="church_wide" className="h-4 w-4" />
          For the whole church (everyone is invited to read along)
        </label>
      )}
      <FormActions>
        <PendingButton pendingLabel="Starting…" disabled={!days}>
          Start plan
        </PendingButton>
        <button type="button" className="btn-ghost" onClick={() => setOpen(false)}>
          Cancel
        </button>
      </FormActions>
    </form>
  );
}
