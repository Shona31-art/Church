"use client";

import Link from "next/link";
import { useFormState } from "react-dom";
import { saveChurchProfile } from "../actions";
import { PendingButton } from "@/components/ConfirmSubmitButton";
import { Alert } from "@/components/ui/Alert";
import { FormActions, FormField, RequiredNote } from "@/components/ui/FormField";

export function ProfileForm({ church }: { church: { name: string; email: string | null; phone: string | null; address: string | null; logo_url: string | null } }) {
  const [state, action] = useFormState(saveChurchProfile, null);
  const fe = state?.fieldErrors ?? {};
  const v = (name: string, fallback: string | null) => state?.values?.[name] ?? fallback ?? "";
  return (
    <form key={JSON.stringify(state?.values ?? {})} action={action} className="card-elevated rounded-2xl p-5 sm:p-6 space-y-5 max-w-xl" noValidate>
      {state?.error && <Alert tone="error">{state.error}</Alert>}
      <RequiredNote />
      <FormField label="Church name" htmlFor="name" required error={fe.name}>
        <input id="name" name="name" required maxLength={200} defaultValue={v("name", church.name)} className="input" aria-invalid={Boolean(fe.name)} />
      </FormField>
      <div className="grid gap-5 sm:grid-cols-2">
        <FormField label="Contact email" htmlFor="email" optional error={fe.email}>
          <input id="email" name="email" type="email" maxLength={254} defaultValue={v("email", church.email)} className="input" aria-invalid={Boolean(fe.email)} />
        </FormField>
        <FormField label="Phone" htmlFor="phone" optional error={fe.phone}>
          <input id="phone" name="phone" type="tel" maxLength={20} defaultValue={v("phone", church.phone)} className="input" aria-invalid={Boolean(fe.phone)} />
        </FormField>
      </div>
      <FormField label="Address" htmlFor="address" optional error={fe.address}>
        <textarea id="address" name="address" rows={2} maxLength={300} defaultValue={v("address", church.address)} className="input" />
      </FormField>
      <FormActions>
        <PendingButton>Save profile</PendingButton>
        <Link href="/dashboard/setup" className="btn-secondary">
          Cancel
        </Link>
      </FormActions>
    </form>
  );
}
