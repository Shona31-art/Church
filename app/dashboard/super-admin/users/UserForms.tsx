"use client";

import { useFormState, useFormStatus } from "react-dom";
import { createPlatformUser, setPlatformUserPassword } from "./actions";

type ChurchOption = { id: string; name: string };
type DepartmentOption = { id: string; name: string; church_id: string };

const inputClass = "w-full border border-ink/20 rounded-lg px-4 py-3";

export function CreateUserForm({
  churches,
  departments,
}: {
  churches: ChurchOption[];
  departments: DepartmentOption[];
}) {
  const [state, formAction] = useFormState(createPlatformUser, null);

  return (
    <form action={formAction} className="max-w-xl space-y-4 rounded-xl border border-ink/10 bg-white/60 p-5">
      <h2 className="text-lg font-semibold">Create a church user</h2>
      <p className="text-sm text-ink/60">
        The account is activated immediately. Share the initial password with the user securely.
      </p>
      {state?.error && <p role="alert" className="text-sm text-red-700">{state.error}</p>}
      {state?.success && <p role="status" className="text-sm text-green-700">{state.success}</p>}

      <input name="name" placeholder="Full name" autoComplete="name" required maxLength={200} className={inputClass} />
      <input name="email" type="email" placeholder="Email" autoComplete="email" required maxLength={320} className={inputClass} />
      <input name="phone" type="tel" placeholder="Phone (optional)" autoComplete="tel" maxLength={50} className={inputClass} />

      <select name="church_id" required defaultValue="" className={inputClass}>
        <option value="" disabled>Select church</option>
        {churches.map((church) => <option key={church.id} value={church.id}>{church.name}</option>)}
      </select>

      <select name="role" required defaultValue="member" className={inputClass}>
        <option value="member">Member</option>
        <option value="department_leader">Department Leader</option>
        <option value="pastor">Pastor</option>
        <option value="church_admin">Church Admin</option>
      </select>

      <select name="department_id" defaultValue="" className={inputClass}>
        <option value="">No department</option>
        {departments.map((department) => {
          const church = churches.find((item) => item.id === department.church_id);
          return (
            <option key={department.id} value={department.id}>
              {church?.name ?? "Unknown church"} — {department.name}
            </option>
          );
        })}
      </select>

      <input
        name="password"
        type="password"
        placeholder="Initial password (at least 6 characters)"
        autoComplete="new-password"
        required
        minLength={6}
        className={inputClass}
      />
      <input
        name="confirm_password"
        type="password"
        placeholder="Confirm initial password"
        autoComplete="new-password"
        required
        minLength={6}
        className={inputClass}
      />
      <SubmitButton pendingText="Creating user..." idleText="Create user" />
    </form>
  );
}

export function SetUserPasswordForm({ userId }: { userId: string }) {
  const [state, formAction] = useFormState(setPlatformUserPassword, null);

  return (
    <details className="min-w-64">
      <summary className="cursor-pointer text-ember">Change password</summary>
      <form action={formAction} className="mt-2 space-y-2">
        <input type="hidden" name="user_id" value={userId} />
        {state?.error && <p role="alert" className="text-xs text-red-700">{state.error}</p>}
        {state?.success && <p role="status" className="text-xs text-green-700">{state.success}</p>}
        <input
          name="password"
          type="password"
          placeholder="Set a new password"
          autoComplete="new-password"
          required
          minLength={6}
          aria-label="New password"
          className="w-full border border-ink/20 rounded px-2 py-1.5 text-xs"
        />
        <input
          name="confirm_password"
          type="password"
          placeholder="Confirm password"
          autoComplete="new-password"
          required
          minLength={6}
          aria-label="Confirm new password"
          className="w-full border border-ink/20 rounded px-2 py-1.5 text-xs"
        />
        <SubmitButton pendingText="Updating..." idleText="Set password" />
      </form>
    </details>
  );
}

function SubmitButton({ pendingText, idleText }: { pendingText: string; idleText: string }) {
  const { pending } = useFormStatus();

  return (
    <button
      type="submit"
      disabled={pending}
      className="bg-ember text-white px-4 py-2 rounded-lg text-sm font-medium disabled:opacity-50"
    >
      {pending ? pendingText : idleText}
    </button>
  );
}
