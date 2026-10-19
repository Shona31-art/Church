"use client";

import { useState } from "react";
import Link from "next/link";
import { useFormState } from "react-dom";
import { ShieldCheck } from "lucide-react";
import { saveGivingDetails } from "../actions";
import { ConfirmSubmitButton, PendingButton } from "@/components/ConfirmSubmitButton";
import { Alert } from "@/components/ui/Alert";
import { FormActions, FormField, RequiredNote } from "@/components/ui/FormField";
import { ACCOUNT_TYPES, ACCOUNT_TYPE_LABELS, eftReference } from "@/lib/giving";

interface Details {
  account_name: string;
  bank_name: string;
  account_number: string;
  branch_code: string;
  account_type: string;
  reference_prefix: string;
  updated_at: string;
}

// Suggestions only — admins can type any bank.
const BANKS = ["Absa", "African Bank", "Capitec", "Discovery Bank", "FNB", "Investec", "Nedbank", "Standard Bank", "TymeBank"];

export function GivingDetailsForm({
  details,
  suggestedPrefix,
  sampleUserId,
  lastChange,
}: {
  details: Details | null;
  suggestedPrefix: string;
  /** The admin's own id, to show what a member's reference will look like. */
  sampleUserId: string;
  lastChange: string | null;
}) {
  const [state, action] = useFormState(saveGivingDetails, null);
  const fe = state?.fieldErrors ?? {};
  const v = (name: keyof Details, fallback = "") => state?.values?.[name] ?? details?.[name] ?? fallback;
  const [prefix, setPrefix] = useState(v("reference_prefix", suggestedPrefix));
  const cleanPrefix = prefix.trim().toUpperCase();

  return (
    <form key={JSON.stringify(state?.values ?? {})} action={action} className="card-elevated max-w-xl space-y-5 rounded-2xl p-5 sm:p-6" noValidate>
      {state?.error && <Alert tone="error">{state.error}</Alert>}
      <Alert tone="info">
        Members will be asked to pay into this account. Whenever these details change, every church admin gets a notification — so a change
        nobody expected is spotted quickly.
      </Alert>
      {lastChange && <p className="text-xs text-ink/60">{lastChange}</p>}
      <RequiredNote />

      <input type="hidden" name="expected_updated_at" value={details?.updated_at ?? ""} />

      <FormField label="Account holder" htmlFor="account_name" required error={fe.account_name} hint="As it appears on your bank statement.">
        <input id="account_name" name="account_name" required maxLength={100} autoComplete="off" defaultValue={v("account_name")} className="input" aria-invalid={Boolean(fe.account_name)} />
      </FormField>

      <div className="grid gap-5 sm:grid-cols-2">
        <FormField label="Bank" htmlFor="bank_name" required error={fe.bank_name}>
          <input id="bank_name" name="bank_name" list="sa-banks" required maxLength={60} autoComplete="off" defaultValue={v("bank_name")} className="input" aria-invalid={Boolean(fe.bank_name)} />
          <datalist id="sa-banks">
            {BANKS.map((b) => (
              <option key={b} value={b} />
            ))}
          </datalist>
        </FormField>
        <FormField label="Account type" htmlFor="account_type" required error={fe.account_type}>
          <select id="account_type" name="account_type" required defaultValue={v("account_type", "cheque")} className="input" aria-invalid={Boolean(fe.account_type)}>
            {ACCOUNT_TYPES.map((t) => (
              <option key={t} value={t}>
                {ACCOUNT_TYPE_LABELS[t]}
              </option>
            ))}
          </select>
        </FormField>
      </div>

      <div className="grid gap-5 sm:grid-cols-2">
        <FormField label="Account number" htmlFor="account_number" required error={fe.account_number}>
          <input
            id="account_number"
            name="account_number"
            inputMode="numeric"
            autoComplete="off"
            required
            maxLength={20}
            defaultValue={v("account_number")}
            className="input tabular"
            aria-invalid={Boolean(fe.account_number)}
          />
        </FormField>
        <FormField label="Branch code" htmlFor="branch_code" required error={fe.branch_code} hint="Most banks use one universal code — check your statement.">
          <input
            id="branch_code"
            name="branch_code"
            inputMode="numeric"
            autoComplete="off"
            required
            maxLength={7}
            defaultValue={v("branch_code")}
            className="input tabular"
            aria-invalid={Boolean(fe.branch_code)}
          />
        </FormField>
      </div>

      <FormField
        label="Reference prefix"
        htmlFor="reference_prefix"
        required
        error={fe.reference_prefix}
        hint={
          /^[A-Z0-9]{2,8}$/.test(cleanPrefix) ? (
            <>
              Each member gets their own reference, e.g. <span className="tabular font-semibold text-ink">{eftReference(cleanPrefix, sampleUserId)}</span>, so you
              can see who paid.
            </>
          ) : (
            "2 to 8 letters or numbers, no spaces."
          )
        }
      >
        <input
          id="reference_prefix"
          name="reference_prefix"
          required
          maxLength={8}
          autoComplete="off"
          value={prefix}
          onChange={(e) => setPrefix(e.target.value)}
          className="input tabular uppercase"
          aria-invalid={Boolean(fe.reference_prefix)}
        />
      </FormField>

      <FormActions>
        {details ? (
          // Changing where members send money: say so before it happens.
          <ConfirmSubmitButton
            title="Change the bank details?"
            message="Members will be asked to pay into the new account from now on, and every church admin will be notified of this change."
            confirmLabel="Save new details"
            className="btn-primary"
            tone="primary"
            pendingLabel="Saving…"
          >
            <ShieldCheck aria-hidden className="h-4 w-4" /> Save bank details
          </ConfirmSubmitButton>
        ) : (
          <PendingButton pendingLabel="Saving…">
            <ShieldCheck aria-hidden className="h-4 w-4" /> Save bank details
          </PendingButton>
        )}
        <Link href="/dashboard/setup" className="btn-secondary">
          Cancel
        </Link>
      </FormActions>
    </form>
  );
}
