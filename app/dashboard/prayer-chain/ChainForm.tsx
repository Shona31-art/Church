"use client";

import { useState } from "react";
import { useFormState } from "react-dom";
import { Timer } from "lucide-react";
import { createPrayerChain } from "./actions";
import { PendingButton } from "@/components/ConfirmSubmitButton";
import { Alert } from "@/components/ui/Alert";
import { FormActions, FormField } from "@/components/ui/FormField";

export function ChainForm({ defaultStart }: { defaultStart: string }) {
  const [open, setOpen] = useState(false);
  const [state, action] = useFormState(createPrayerChain, null);
  if (!open)
    return (
      <button type="button" className="btn-primary" onClick={() => setOpen(true)}>
        <Timer aria-hidden className="h-4 w-4" /> New prayer chain
      </button>
    );
  const v = state?.values;
  return (
    <form action={action} className="card-elevated space-y-4 rounded-2xl p-5" noValidate>
      {state?.error && <Alert tone="error">{state.error}</Alert>}
      <FormField label="Name" htmlFor="title" required>
        <input id="title" name="title" maxLength={120} required defaultValue={v?.title} placeholder="e.g. 7 days of prayer & fasting" className="input" />
      </FormField>
      <FormField label="What are we praying for?" htmlFor="description" optional>
        <textarea id="description" name="description" rows={3} maxLength={1000} defaultValue={v?.description} className="input" />
      </FormField>
      <div className="grid gap-4 sm:grid-cols-2">
        <FormField label="Starts" htmlFor="starts_at" required>
          <input id="starts_at" name="starts_at" type="datetime-local" required defaultValue={v?.starts_at ?? defaultStart} className="input" />
        </FormField>
        <FormField label="How long" htmlFor="hours">
          <select id="hours" name="hours" defaultValue={v?.hours ?? "24"} className="input">
            <option value="12">12 hours</option>
            <option value="24">24 hours</option>
            <option value="72">3 days</option>
            <option value="168">7 days</option>
            <option value="504">21 days</option>
            <option value="720">30 days</option>
          </select>
        </FormField>
        <FormField label="Each slot" htmlFor="slot_minutes">
          <select id="slot_minutes" name="slot_minutes" defaultValue={v?.slot_minutes ?? "60"} className="input">
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
        <PendingButton pendingLabel="Creating…">Create and invite the church</PendingButton>
        <button type="button" className="btn-ghost" onClick={() => setOpen(false)}>
          Cancel
        </button>
      </FormActions>
    </form>
  );
}
