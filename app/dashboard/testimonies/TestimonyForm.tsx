"use client";

import { useEffect, useState } from "react";
import { useFormState } from "react-dom";
import { Sparkle } from "lucide-react";
import { shareTestimony } from "./actions";
import { PendingButton } from "@/components/ConfirmSubmitButton";
import { Alert } from "@/components/ui/Alert";
import { FormActions, FormField } from "@/components/ui/FormField";

export function TestimonyForm() {
  const [open, setOpen] = useState(false);
  const [state, action] = useFormState(shareTestimony, null);
  useEffect(() => {
    if (state?.ok) setOpen(false);
  }, [state]);
  if (!open)
    return (
      <button type="button" className="btn-primary" onClick={() => setOpen(true)}>
        <Sparkle aria-hidden className="h-4 w-4" /> Share a testimony
      </button>
    );
  const v = state?.values;
  return (
    <form action={action} className="card-elevated space-y-4 rounded-2xl p-5" noValidate>
      {state?.error && <Alert tone="error">{state.error}</Alert>}
      <FormField label="Title" htmlFor="t-title" optional error={state?.fieldErrors?.title}>
        <input id="t-title" name="title" maxLength={120} defaultValue={v?.title} className="input" placeholder="e.g. Healed after years of pain" />
      </FormField>
      <FormField label="What has God done?" htmlFor="t-body" required error={state?.fieldErrors?.body} hint="A pastor reads it first, then it goes on the wall for the church.">
        <textarea id="t-body" name="body" rows={6} maxLength={3000} required defaultValue={v?.body} className="input" autoFocus />
      </FormField>
      <label className="flex items-center gap-2 text-sm">
        <input type="checkbox" name="show_name" defaultChecked={v ? v.show_name === "on" : true} className="h-4 w-4" />
        Show my name with it (untick to share as “A church member”)
      </label>
      <FormActions>
        <PendingButton pendingLabel="Sending…">Send for approval</PendingButton>
        <button type="button" className="btn-ghost" onClick={() => setOpen(false)}>
          Cancel
        </button>
      </FormActions>
    </form>
  );
}
