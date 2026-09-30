"use client";

import { useFormState, useFormStatus } from "react-dom";
import { addMember } from "./actions";

export function MemberForm({
  departments,
  canGrantAdmin,
}: {
  departments: { id: string; name: string }[];
  canGrantAdmin: boolean;
}) {
  const [state, formAction] = useFormState(addMember, null);

  return (
    <form action={formAction} className="max-w-md space-y-4">
      <h1 className="text-2xl font-semibold mb-4">Add member</h1>

      {state?.error && (
        <p className="text-sm text-red-700 bg-red-50 border border-red-200 rounded-lg p-3">
          {state.error}
        </p>
      )}

      <input
        name="name"
        placeholder="Full name"
        required
        className="w-full border border-ink/20 rounded-lg px-4 py-3"
      />
      <input
        name="email"
        type="email"
        placeholder="Email"
        required
        className="w-full border border-ink/20 rounded-lg px-4 py-3"
      />
      <input
        name="phone"
        placeholder="Phone (optional)"
        className="w-full border border-ink/20 rounded-lg px-4 py-3"
      />

      <select name="role" className="w-full border border-ink/20 rounded-lg px-4 py-3">
        <option value="member">Member</option>
        <option value="department_leader">Department Leader</option>
        <option value="pastor">Pastor</option>
        {canGrantAdmin && <option value="church_admin">Church Admin</option>}
      </select>

      <select name="department_id" className="w-full border border-ink/20 rounded-lg px-4 py-3">
        <option value="">No department</option>
        {departments.map((d) => (
          <option key={d.id} value={d.id}>
            {d.name}
          </option>
        ))}
      </select>

      <p className="text-xs text-ink/40">
        An invite email will be sent so they can set their own password.
      </p>

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
      {pending ? "Sending invite..." : "Send invite"}
    </button>
  );
}
