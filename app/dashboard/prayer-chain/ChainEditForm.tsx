"use client";

import { useEffect, useState } from "react";
import { useFormState } from "react-dom";
import { Pencil, Plus, X } from "lucide-react";
import { updatePrayerChain } from "./actions";
import { PendingButton } from "@/components/ConfirmSubmitButton";
import { Alert } from "@/components/ui/Alert";
import { FormField } from "@/components/ui/FormField";

/** Pastors: change a chain's name, description, people per slot and prayer times. */
export function ChainEditForm({ chain }: { chain: { id: string; title: string; description: string | null; max_per_slot: number; times: string[] | null } }) {
  const [open, setOpen] = useState(false);
  const [state, action] = useFormState(updatePrayerChain, null);
  const [times, setTimes] = useState<string[]>(chain.times ?? []);
  const [newTime, setNewTime] = useState("12:00");
  useEffect(() => {
    if (state?.ok) setOpen(false);
  }, [state]);
  useEffect(() => setTimes(chain.times ?? []), [chain.times]);

  if (!open)
    return (
      <button type="button" className="btn-secondary" onClick={() => setOpen(true)}>
        <Pencil aria-hidden className="h-4 w-4" /> Edit prayer chain
      </button>
    );
  const addTime = () => setTimes((t) => (newTime && !t.includes(newTime) && t.length < 24 ? [...t, newTime].sort() : t));
  return (
    <form action={action} className="space-y-4" noValidate>
      <input type="hidden" name="chain_id" value={chain.id} />
      <input type="hidden" name="times" value={times.join(",")} />
      {state?.error && <Alert tone="error">{state.error}</Alert>}
      <FormField label="Name" htmlFor="edit-title" required>
        <input id="edit-title" name="title" maxLength={120} defaultValue={state?.values?.title ?? chain.title} className="input" />
      </FormField>
      <FormField label="What are we praying for?" htmlFor="edit-description" optional>
        <textarea id="edit-description" name="description" rows={3} maxLength={1000} defaultValue={state?.values?.description ?? chain.description ?? ""} className="input" />
      </FormField>
      {chain.times && (
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
          </ul>
          <div className="flex gap-2">
            <input type="time" value={newTime} onChange={(e) => setNewTime(e.target.value)} className="input w-36" aria-label="Prayer time to add" />
            <button type="button" className="btn-secondary" onClick={addTime}>
              <Plus aria-hidden className="h-4 w-4" /> Add time
            </button>
          </div>
          <p className="mt-2 text-xs text-ink/60">Removing a time cancels the bookings still to come at that time.</p>
        </div>
      )}
      <FormField label="People per slot" htmlFor="edit-max">
        <input id="edit-max" name="max_per_slot" type="number" min={1} max={50} defaultValue={state?.values?.max_per_slot ?? chain.max_per_slot} className="input w-28" />
      </FormField>
      <div className="flex flex-wrap gap-2">
        <PendingButton pendingLabel="Saving…" disabled={Boolean(chain.times) && !times.length}>
          Save changes
        </PendingButton>
        <button type="button" className="btn-ghost" onClick={() => setOpen(false)}>
          Cancel
        </button>
      </div>
    </form>
  );
}
