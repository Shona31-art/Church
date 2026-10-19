"use client";

import Link from "next/link";
import { useFormState } from "react-dom";
import { registerChurch } from "./actions";
import { PendingButton } from "@/components/ConfirmSubmitButton";
import { Alert } from "@/components/ui/Alert";
import { FormField, RequiredNote } from "@/components/ui/FormField";
import { AuthShell, AuthHeading } from "@/components/brand/AuthShell";

export default function RegisterPage() {
  const [state, action] = useFormState(registerChurch, null);
  const fe = state?.fieldErrors ?? {};
  const v = state?.values ?? {};

  if (state?.ok) {
    return (
      <AuthShell>
        <div className="w-full max-w-[400px]" role="status">
          <AuthHeading eyebrow="Almost there" title="Check your email">
            Your church is set up. We&apos;ve sent a confirmation link{v.email ? ` to ${v.email}` : ""} — open it, then sign in to get started.
          </AuthHeading>
          <Link href="/login" className="btn-primary mt-6 w-full">
            Go to sign in
          </Link>
        </div>
      </AuthShell>
    );
  }

  return (
    <AuthShell>
      <form key={JSON.stringify(v)} action={action} className="w-full max-w-[440px] space-y-5" noValidate>
        <AuthHeading eyebrow="For church leaders" title="Start your free trial">
          30 days, every core feature, no card required.
        </AuthHeading>

        {state?.error && <Alert tone="error">{state.error}</Alert>}
        <RequiredNote />

        <FormField label="Church name" htmlFor="church_name" required error={fe.church_name}>
          <input id="church_name" name="church_name" autoComplete="organization" required maxLength={200} defaultValue={v.church_name} className="input" aria-invalid={Boolean(fe.church_name)} />
        </FormField>
        <FormField label="Your name" htmlFor="admin_name" required error={fe.admin_name} hint="You'll be the church admin.">
          <input id="admin_name" name="admin_name" autoComplete="name" required maxLength={120} defaultValue={v.admin_name} className="input" aria-invalid={Boolean(fe.admin_name)} />
        </FormField>
        <FormField label="Email" htmlFor="email" required error={fe.email}>
          <input id="email" name="email" type="email" autoComplete="email" required maxLength={254} defaultValue={v.email} className="input" aria-invalid={Boolean(fe.email)} />
        </FormField>
        <FormField label="Phone" htmlFor="phone" optional error={fe.phone}>
          <input id="phone" name="phone" type="tel" autoComplete="tel" maxLength={20} defaultValue={v.phone} className="input" aria-invalid={Boolean(fe.phone)} />
        </FormField>
        <FormField label="Password" htmlFor="password" required error={fe.password} hint="At least 8 characters, with letters and numbers.">
          <input id="password" name="password" type="password" autoComplete="new-password" required minLength={8} className="input" aria-invalid={Boolean(fe.password)} />
        </FormField>
        <FormField label="Confirm password" htmlFor="confirm_password" required error={fe.confirm_password}>
          <input id="confirm_password" name="confirm_password" type="password" autoComplete="new-password" required className="input" aria-invalid={Boolean(fe.confirm_password)} />
        </FormField>

        {/* Honeypot: hidden from people and screen readers; bots fill it in. */}
        <div aria-hidden="true" className="hidden">
          <label htmlFor="website">Website</label>
          <input id="website" name="website" tabIndex={-1} autoComplete="off" />
        </div>

        <PendingButton className="btn-primary w-full" pendingLabel="Creating your church…">
          Create church account
        </PendingButton>

        <p className="border-t border-line pt-5 text-center text-sm text-ink/60">
          Already have an account?{" "}
          <Link href="/login" className="link">
            Sign in
          </Link>
        </p>
      </form>
    </AuthShell>
  );
}
