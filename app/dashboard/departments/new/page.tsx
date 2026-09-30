"use client";

import { useFormState, useFormStatus } from "react-dom";
import { createDepartment } from "./actions";

export default function NewDepartmentPage() {
  const [state, formAction] = useFormState(createDepartment, null);

  return (
    <form action={formAction} className="max-w-sm space-y-4">
      <h1 className="text-2xl font-semibold mb-4">New department</h1>
      {state?.error && (
        <p className="text-sm text-red-700 bg-red-50 border border-red-200 rounded-lg p-3">
          {state.error}
        </p>
      )}
      <input
        name="name"
        placeholder="e.g. Worship, Youth, Media, Ushers"
        required
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
      {pending ? "Creating..." : "Create department"}
    </button>
  );
}
