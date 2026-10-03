"use client";

import Link from "next/link";
import { useFormState } from "react-dom";
import { createMember, updateMember } from "./actions";
import { PendingButton } from "@/components/ConfirmSubmitButton";
import { Alert } from "@/components/ui/Alert";
import { FormActions, FormField, RequiredNote } from "@/components/ui/FormField";
import { ROLE_LABELS, type ChurchRole } from "@/lib/permissions";

interface Department {
  id: string;
  name: string;
}

export interface MemberFormValues {
  id: string;
  updated_at: string;
  name: string;
  email: string;
  phone: string | null;
  role: ChurchRole;
  department_id: string | null;
  birth_date: string;
}

/**
 * Add-member and edit-member form. On a failed save the server returns what
 * was typed, so nothing is lost; field errors appear under each input.
 */
export function MemberForm({
  mode,
  departments,
  roles,
  roleLocked,
  member,
}: {
  mode: "create" | "edit";
  departments: Department[];
  /** Roles this person may assign. */
  roles: ChurchRole[];
  /** Explains why role/department can't be changed (e.g. editing yourself). */
  roleLocked?: string;
  member?: MemberFormValues;
}) {
  const [state, formAction] = useFormState(mode === "create" ? createMember : updateMember, null);
  const v = state?.values;
  const fe = state?.fieldErrors ?? {};
  const value = (name: string, fallback: string | null | undefined) => v?.[name] ?? fallback ?? "";
  const cancelHref = member ? `/dashboard/members/${member.id}` : "/dashboard/members";

  return (
    // Re-keyed on the returned values so a failed save re-renders the inputs
    // with exactly what was typed (React may reset forms after an action).
    <form key={JSON.stringify(v ?? {})} action={formAction} className="card-elevated rounded-2xl p-5 sm:p-6 space-y-5 max-w-xl" noValidate>
      {member && (
        <>
          <input type="hidden" name="member_id" value={member.id} />
          <input type="hidden" name="updated_at" value={member.updated_at} />
        </>
      )}

      {state?.error && <Alert tone="error">{state.error}</Alert>}
      <RequiredNote />

      <FormField label="Full name" htmlFor="name" required error={fe.name}>
        <input id="name" name="name" required maxLength={120} autoComplete="off" defaultValue={value("name", member?.name)} className="input" aria-invalid={Boolean(fe.name)} />
      </FormField>

      {mode === "create" ? (
        <FormField label="Email" htmlFor="email" required error={fe.email} hint="We'll email an invite so they can choose their own password.">
          <input id="email" name="email" type="email" required maxLength={254} autoComplete="off" defaultValue={value("email", "")} className="input" aria-invalid={Boolean(fe.email)} />
        </FormField>
      ) : (
        <FormField label="Email" htmlFor="email" hint="Email is their sign-in, so only they can change it.">
          <input id="email" value={member?.email} disabled className="input" />
        </FormField>
      )}

      <FormField label="Phone" htmlFor="phone" optional error={fe.phone}>
        <input id="phone" name="phone" type="tel" maxLength={20} autoComplete="off" placeholder="082 123 4567" defaultValue={value("phone", member?.phone)} className="input" aria-invalid={Boolean(fe.phone)} />
      </FormField>

      <div className="grid gap-5 sm:grid-cols-2">
        <FormField label="Role" htmlFor="role" required error={fe.role} hint={roleLocked}>
          {roleLocked && <input type="hidden" name="role" value={member?.role} />}
          <select
            id="role"
            name={roleLocked ? undefined : "role"}
            defaultValue={value("role", member?.role ?? "member")}
            disabled={Boolean(roleLocked)}
            className="input"
            aria-invalid={Boolean(fe.role)}
          >
            {(roleLocked && member ? [member.role] : roles).map((r) => (
              <option key={r} value={r}>
                {ROLE_LABELS[r]}
              </option>
            ))}
          </select>
        </FormField>

        <FormField label="Department" htmlFor="department_id" error={fe.department_id} hint={departments.length ? undefined : "Create departments first to assign people to them."}>
          {roleLocked && <input type="hidden" name="department_id" value={member?.department_id ?? ""} />}
          <select
            id="department_id"
            name={roleLocked ? undefined : "department_id"}
            defaultValue={value("department_id", member?.department_id)}
            disabled={Boolean(roleLocked)}
            className="input"
            aria-invalid={Boolean(fe.department_id)}
          >
            <option value="">No department</option>
            {departments.map((d) => (
              <option key={d.id} value={d.id}>
                {d.name}
              </option>
            ))}
          </select>
        </FormField>
      </div>

      {mode === "edit" && (
        <FormField label="Birthday" htmlFor="birth_date" optional error={fe.birth_date} hint="Only pastors and admins see this, for birthday reach-outs.">
          <input id="birth_date" name="birth_date" type="date" defaultValue={value("birth_date", member?.birth_date)} className="input sm:w-auto" aria-invalid={Boolean(fe.birth_date)} />
        </FormField>
      )}

      <FormActions>
        <PendingButton pendingLabel={mode === "create" ? "Sending invite…" : "Saving…"}>
          {mode === "create" ? "Add member & send invite" : "Save changes"}
        </PendingButton>
        <Link href={cancelHref} className="btn-secondary">
          Cancel
        </Link>
      </FormActions>
    </form>
  );
}
