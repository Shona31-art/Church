"use client";

import { useFormState } from "react-dom";
import { requestEmailChange } from "./actions";
import { PendingButton } from "@/components/ConfirmSubmitButton";
import { Alert } from "@/components/ui/Alert";
import { FormActions, FormField } from "@/components/ui/FormField";
import { PasswordInput } from "@/components/ui/PasswordInput";

/**
 * Change the sign-in email. Needs the current password; nothing changes until
 * the emailed link(s) are confirmed (docs/plans/email-change.md).
 */
export function EmailChangeForm({ currentEmail, pendingEmail }: { currentEmail: string; pendingEmail: string | null }) {
  const [state, action] = useFormState(requestEmailChange, null);
  const fe = state?.fieldErrors ?? {};

  return (
    <div className="space-y-5">
      <p className="text-sm">
        You sign in with <span className="font-semibold">{currentEmail}</span>.
      </p>

      {pendingEmail && (
        <Alert tone="info" title={`Waiting for confirmation: ${pendingEmail}`}>
          We sent confirmation links — usually to both your current and your new address. Your sign-in changes once you&apos;ve opened them. If you
          didn&apos;t mean to change it, ignore the emails: the links expire and nothing changes. Asking for a different address below replaces this request.
        </Alert>
      )}

      <form key={state?.ok ? "sent" : "form"} action={action} className="space-y-5" noValidate>
        {state?.error && <Alert tone="error">{state.error}</Alert>}
        <div className="grid gap-5 sm:grid-cols-2">
          <FormField label="New email" htmlFor="new_email" required error={fe.new_email}>
            <input
              id="new_email"
              name="new_email"
              type="email"
              autoComplete="email"
              required
              maxLength={254}
              defaultValue={state?.values?.new_email ?? ""}
              className="input"
              aria-invalid={Boolean(fe.new_email)}
            />
          </FormField>
          <FormField label="Current password" htmlFor="current_password" required error={fe.current_password} hint="To confirm it's you.">
            <PasswordInput
              id="current_password"
              name="current_password"
              autoComplete="current-password"
              required
              className="input"
              aria-invalid={Boolean(fe.current_password)}
            />
          </FormField>
        </div>
        <FormActions>
          <PendingButton pendingLabel="Sending confirmation…">Change email</PendingButton>
        </FormActions>
      </form>
    </div>
  );
}
