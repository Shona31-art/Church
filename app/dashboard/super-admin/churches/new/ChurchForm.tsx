"use client";

import { useFormState, useFormStatus } from "react-dom";
import { addChurch } from "./actions";

export function ChurchForm() {
  const [state, formAction] = useFormState(addChurch, null);

  return (
    <form action={formAction} className="max-w-md space-y-4">
      <h1 className="text-2xl font-semibold">Add church</h1>
      <p className="text-sm text-ink/60">
        A 30-day free trial and an active church admin login will be created.
      </p>

      {state?.error && (
        <p role="alert" className="text-sm text-red-700 bg-red-50 border border-red-200 rounded-lg p-3">
          {state.error}
        </p>
      )}

      <input
        name="church_name"
        placeholder="Church name"
        autoComplete="organization"
        required
        maxLength={200}
        className="w-full border border-ink/20 rounded-lg px-4 py-3"
      />
      <input
        name="admin_name"
        placeholder="First admin's full name"
        autoComplete="name"
        required
        maxLength={200}
        className="w-full border border-ink/20 rounded-lg px-4 py-3"
      />
      <input
        name="email"
        type="email"
        placeholder="First admin's email"
        autoComplete="email"
        required
        maxLength={320}
        className="w-full border border-ink/20 rounded-lg px-4 py-3"
      />
      <input
        name="phone"
        type="tel"
        placeholder="Phone (optional)"
        autoComplete="tel"
        maxLength={50}
        className="w-full border border-ink/20 rounded-lg px-4 py-3"
      />
      <input
        name="password"
        type="password"
        placeholder="Admin's initial password"
        autoComplete="new-password"
        required
        minLength={6}
        className="w-full border border-ink/20 rounded-lg px-4 py-3"
      />
      <input
        name="confirm_password"
        type="password"
        placeholder="Confirm initial password"
        autoComplete="new-password"
        required
        minLength={6}
        className="w-full border border-ink/20 rounded-lg px-4 py-3"
      />

      <SubmitButton />
    </form>
  );
}

function SubmitButton() {
  const { pending } = useFormStatus();

  return (
    <button
      type="submit"
      disabled={pending}
      className="bg-ember text-white px-6 py-3 rounded-lg font-medium disabled:opacity-50"
    >
      {pending ? "Creating church..." : "Create church and admin login"}
    </button>
  );
}
