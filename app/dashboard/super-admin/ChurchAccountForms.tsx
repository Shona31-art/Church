"use client";

import { useEffect, useState } from "react";
import { useFormState } from "react-dom";
import { Banknote, Mail, Trash2 } from "lucide-react";
import { deleteChurch, emailChurchLeaders, recordManualPayment } from "./church-actions";
import { PendingButton } from "@/components/ConfirmSubmitButton";
import { Alert } from "@/components/ui/Alert";
import { FormField } from "@/components/ui/FormField";

type Prices = Record<string, { monthly: number; yearly: number | null }>;

/** Record an EFT/cash payment: the plan turns on, paid up for a month or a year, with a receipt. */
export function RecordPaymentForm({ churchId, currentPlan, prices }: { churchId: string; currentPlan: string; prices: Prices }) {
  const [open, setOpen] = useState(false);
  const [state, action] = useFormState(recordManualPayment, null);
  const [plan, setPlan] = useState(["basic", "premium", "enterprise"].includes(currentPlan) ? currentPlan : "basic");
  const [interval, setInterval] = useState<"monthly" | "yearly">("monthly");
  const suggested = interval === "yearly" ? prices[plan]?.yearly ?? (prices[plan]?.monthly ?? 0) * 10 : prices[plan]?.monthly ?? 0;
  const [amount, setAmount] = useState(String(suggested));
  useEffect(() => setAmount(String(suggested)), [suggested]);
  useEffect(() => {
    if (state?.ok) setOpen(false);
  }, [state]);
  if (!open)
    return (
      <button type="button" className="btn-primary w-full justify-center" onClick={() => setOpen(true)}>
        <Banknote aria-hidden className="h-4 w-4" /> Record a payment
      </button>
    );
  return (
    <form action={action} className="w-full space-y-3 rounded-xl border border-line p-4">
      <input type="hidden" name="church_id" value={churchId} />
      {state?.error && <Alert tone="error">{state.error}</Alert>}
      <div className="grid gap-3 sm:grid-cols-2">
        <FormField label="Plan" htmlFor="pay-plan">
          <select id="pay-plan" name="plan_key" value={plan} onChange={(e) => setPlan(e.target.value)} className="input">
            <option value="basic">Grace</option>
            <option value="premium">Grace Plus</option>
            <option value="enterprise">Unlimited (by arrangement)</option>
          </select>
        </FormField>
        <FormField label="Paid for" htmlFor="pay-interval">
          <select id="pay-interval" name="interval" value={interval} onChange={(e) => setInterval(e.target.value as "monthly" | "yearly")} className="input">
            <option value="monthly">1 month</option>
            <option value="yearly">1 year</option>
          </select>
        </FormField>
        <FormField label="Amount received (R)" htmlFor="pay-amount">
          <input id="pay-amount" name="amount" type="number" min="1" step="0.01" value={amount} onChange={(e) => setAmount(e.target.value)} className="input" />
        </FormField>
        <FormField label="Reference" htmlFor="pay-note" optional>
          <input id="pay-note" name="note" maxLength={80} className="input" placeholder="e.g. EFT KAMI Nov" />
        </FormField>
      </div>
      <div className="flex flex-wrap gap-2">
        <PendingButton pendingLabel="Saving…">Record payment & switch on</PendingButton>
        <button type="button" className="btn-ghost" onClick={() => setOpen(false)}>
          Cancel
        </button>
      </div>
      <p className="text-xs text-ink/60">The plan is switched on and paid up for the period; they get an invoice and a thank-you email.</p>
    </form>
  );
}

export function EmailLeadersForm({ churchId, churchName }: { churchId: string; churchName: string }) {
  const [open, setOpen] = useState(false);
  const [state, action] = useFormState(emailChurchLeaders, null);
  useEffect(() => {
    if (state?.ok) setOpen(false);
  }, [state]);
  if (!open)
    return (
      <button type="button" className="btn-secondary w-full justify-center" onClick={() => setOpen(true)}>
        <Mail aria-hidden className="h-4 w-4" /> Email their leaders
      </button>
    );
  return (
    <form action={action} className="w-full space-y-3 rounded-xl border border-line p-4 sm:col-span-2">
      <input type="hidden" name="church_id" value={churchId} />
      {state?.error && <Alert tone="error">{state.error}</Alert>}
      <FormField label="Subject" htmlFor="em-subject">
        <input id="em-subject" name="subject" maxLength={150} className="input" defaultValue={`Grace — ${churchName}`} />
      </FormField>
      <FormField label="Message" htmlFor="em-message" hint="Goes to the church's pastors and admins.">
        <textarea id="em-message" name="message" rows={5} maxLength={5000} className="input" />
      </FormField>
      <div className="flex flex-wrap gap-2">
        <PendingButton pendingLabel="Sending…">Send email</PendingButton>
        <button type="button" className="btn-ghost" onClick={() => setOpen(false)}>
          Cancel
        </button>
      </div>
    </form>
  );
}

export function DeleteChurchForm({ churchId, churchName, people }: { churchId: string; churchName: string; people: number }) {
  const [state, action] = useFormState(deleteChurch, null);
  const [typed, setTyped] = useState("");
  return (
    <form action={action} className="space-y-3">
      <input type="hidden" name="church_id" value={churchId} />
      {state?.error && <Alert tone="error">{state.error}</Alert>}
      <p className="text-sm">
        Deletes <strong>{churchName}</strong> for good: {people} {people === 1 ? "login" : "logins"}, every message, prayer, giving record, sermon and file. This can&apos;t be undone. To keep their data, suspend instead.
      </p>
      <FormField label={`Type “${churchName}” to confirm`} htmlFor="confirm_name">
        <input id="confirm_name" name="confirm_name" value={typed} onChange={(e) => setTyped(e.target.value)} className="input" autoComplete="off" />
      </FormField>
      <PendingButton className="btn-danger" pendingLabel="Deleting everything…" disabled={typed.trim() !== churchName.trim()}>
        <Trash2 aria-hidden className="h-4 w-4" /> Delete church and all its data
      </PendingButton>
    </form>
  );
}
