"use client";

import { useState } from "react";
import { useFormState } from "react-dom";
import { KeyRound } from "lucide-react";
import { giveAppAccess } from "../actions";
import { PendingButton } from "@/components/ConfirmSubmitButton";
import { Alert } from "@/components/ui/Alert";
import { FormField } from "@/components/ui/FormField";
import { PasswordField } from "../MemberForm";

/** A record-only member starts using Grace: give them an email and a first password. */
export function GiveAccessForm({ memberId, memberName }: { memberId: string; memberName: string }) {
  const [open, setOpen] = useState(false);
  const [state, action] = useFormState(giveAppAccess, null);
  if (state?.ok) return <Alert tone="success">{memberName} can sign in now. Share their email and password with them.</Alert>;
  if (!open)
    return (
      <button type="button" className="btn-primary" onClick={() => setOpen(true)}>
        <KeyRound aria-hidden className="h-4 w-4" /> Give app access
      </button>
    );
  return (
    <form action={action} className="space-y-4 rounded-xl border border-line p-4" noValidate>
      <input type="hidden" name="member_id" value={memberId} />
      {state?.error && <Alert tone="error">{state.error}</Alert>}
      <FormField label="Their email" htmlFor="ga-email" required error={state?.fieldErrors?.email} hint="What they'll sign in with. No email is sent.">
        <input id="ga-email" name="email" type="email" maxLength={254} autoComplete="off" defaultValue={state?.values?.email} className="input" />
      </FormField>
      <PasswordField error={state?.fieldErrors?.password} label="First password" />
      <div className="flex flex-wrap gap-2">
        <PendingButton pendingLabel="Setting up…">Give app access</PendingButton>
        <button type="button" className="btn-ghost" onClick={() => setOpen(false)}>
          Cancel
        </button>
      </div>
    </form>
  );
}
