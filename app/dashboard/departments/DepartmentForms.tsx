"use client";

import Link from "next/link";
import { useFormState } from "react-dom";
import { createDepartment, deleteDepartment, renameDepartment } from "./actions";
import { ConfirmSubmitButton, PendingButton } from "@/components/ConfirmSubmitButton";
import { Alert } from "@/components/ui/Alert";
import { FormActions, FormField } from "@/components/ui/FormField";

export function NewDepartmentForm() {
  const [state, action] = useFormState(createDepartment, null);
  return (
    <form key={JSON.stringify(state?.values ?? {})} action={action} className="card-elevated rounded-2xl p-5 sm:p-6 space-y-5 max-w-md" noValidate>
      {state?.error && !state.fieldErrors && <Alert tone="error">{state.error}</Alert>}
      <FormField label="Department name" htmlFor="name" required error={state?.fieldErrors?.name} hint="A chat channel with the same name is created automatically.">
        <input id="name" name="name" required maxLength={60} placeholder="e.g. Worship, Youth, Media, Ushers" defaultValue={state?.values?.name} className="input" aria-invalid={Boolean(state?.fieldErrors?.name)} />
      </FormField>
      <FormActions>
        <PendingButton pendingLabel="Creating…">Create department</PendingButton>
        <Link href="/dashboard/departments" className="btn-secondary">
          Cancel
        </Link>
      </FormActions>
    </form>
  );
}

export function RenameDepartmentForm({ id, name }: { id: string; name: string }) {
  const [state, action] = useFormState(renameDepartment, null);
  return (
    <form action={action} className="space-y-3" noValidate>
      <input type="hidden" name="department_id" value={id} />
      {state?.error && !state.fieldErrors && <Alert tone="error">{state.error}</Alert>}
      <FormField label="Name" htmlFor="name" required error={state?.fieldErrors?.name}>
        <div className="flex flex-wrap gap-2">
          <input id="name" name="name" required maxLength={60} defaultValue={name} className="input flex-1 min-w-[12rem]" aria-invalid={Boolean(state?.fieldErrors?.name)} />
          <PendingButton className="btn-secondary">Rename</PendingButton>
        </div>
      </FormField>
    </form>
  );
}

export function DeleteDepartmentButton({
  id,
  name,
  memberCount,
  announcementCount,
  eventCount,
}: {
  id: string;
  name: string;
  memberCount: number;
  announcementCount: number;
  eventCount: number;
}) {
  const [state, action] = useFormState(deleteDepartment, null);
  return (
    <form action={action}>
      <input type="hidden" name="department_id" value={id} />
      {state?.error && <Alert tone="error" className="mb-3">{state.error}</Alert>}
      <ConfirmSubmitButton
        title={`Delete the ${name} department?`}
        confirmLabel="Delete department"
        pendingLabel="Deleting…"
        message={
          <>
            <p>This permanently deletes:</p>
            <ul className="list-disc pl-5 mt-1 space-y-0.5">
              <li>
                its {announcementCount} department-only announcement{announcementCount === 1 ? "" : "s"} and {eventCount} event
                {eventCount === 1 ? "" : "s"}
              </li>
              <li>its chat channel and message history</li>
            </ul>
            <p className="mt-2">
              Its {memberCount} member{memberCount === 1 ? " stays" : "s stay"} in the church with no department. This can&apos;t be undone.
            </p>
          </>
        }
      >
        Delete department
      </ConfirmSubmitButton>
    </form>
  );
}
