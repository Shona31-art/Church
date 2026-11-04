"use client";

import { useEffect, useRef } from "react";
import { BirthdayField } from "@/components/ui/BirthdayField";
import { useFormState } from "react-dom";
import { changeMyPassword, updateMyProfile } from "./actions";
import { PendingButton } from "@/components/ConfirmSubmitButton";
import { Alert } from "@/components/ui/Alert";
import { FormField } from "@/components/ui/FormField";
import { PasswordInput } from "@/components/ui/PasswordInput";

export function ProfileForm({ name, phone, birthDate, email }: { name: string; phone: string | null; birthDate: string; email: string }) {
  const [state, action] = useFormState(updateMyProfile, null);
  const fe = state?.fieldErrors ?? {};
  return (
    <form action={action} className="space-y-5" noValidate>
      {state?.error && <Alert tone="error">{state.error}</Alert>}
      <FormField label="Full name" htmlFor="name" required error={fe.name}>
        <input id="name" name="name" required maxLength={120} defaultValue={name} autoComplete="name" className="input" aria-invalid={Boolean(fe.name)} />
      </FormField>
      <FormField label="Email" htmlFor="email" hint="Your sign-in email. Change it under Email address below.">
        <input id="email" value={email} disabled className="input" />
      </FormField>
      <div className="grid gap-5 sm:grid-cols-2">
        <FormField label="Phone" htmlFor="phone" optional error={fe.phone}>
          <input id="phone" name="phone" type="tel" maxLength={20} defaultValue={phone ?? ""} autoComplete="tel" className="input" aria-invalid={Boolean(fe.phone)} />
        </FormField>
        <BirthdayField name="birth_date" defaultValue={birthDate} error={fe.birth_date} hint="Only your pastors see it, so they can wish you well — just the day and month, never your age. The year is optional." />
      </div>
      <PendingButton>Save my details</PendingButton>
    </form>
  );
}

export function PasswordForm() {
  const [state, action] = useFormState(changeMyPassword, null);
  const ref = useRef<HTMLFormElement>(null);
  useEffect(() => {
    if (state?.ok) ref.current?.reset();
  }, [state]);
  return (
    <form ref={ref} action={action} className="space-y-4" noValidate>
      {state?.error && <Alert tone="error">{state.error}</Alert>}
      <div className="grid gap-5 sm:grid-cols-2">
        <FormField label="New password" htmlFor="password" hint="At least 8 characters, letters and numbers.">
          <PasswordInput id="password" name="password" autoComplete="new-password" required className="input" />
        </FormField>
        <FormField label="Confirm new password" htmlFor="confirm_password">
          <PasswordInput id="confirm_password" name="confirm_password" autoComplete="new-password" required className="input" />
        </FormField>
      </div>
      <PendingButton className="btn-secondary" pendingLabel="Changing…">
        Change password
      </PendingButton>
    </form>
  );
}
