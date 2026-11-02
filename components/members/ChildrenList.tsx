"use client";

import { useEffect, useId, useState } from "react";
import { useFormState } from "react-dom";
import { Baby, Plus } from "lucide-react";
import { removeChild, saveChild } from "@/app/dashboard/account/children-actions";
import { ConfirmSubmitButton, PendingButton } from "@/components/ConfirmSubmitButton";
import { Alert } from "@/components/ui/Alert";
import { FormField } from "@/components/ui/FormField";

export interface ChildRow {
  id: string;
  name: string;
  birthDate: string | null;
  /** Pre-formatted on the server, e.g. "14 Mar 2018". */
  birthdayLabel: string | null;
  age: number | null;
}

/**
 * A member's children: list, add, edit and remove. Used on My account (the
 * parent) and on a member's profile (pastors and church admins).
 */
export function ChildrenList({ parentId, items, self }: { parentId: string; items: ChildRow[]; self: boolean }) {
  const [editing, setEditing] = useState<string | "new" | null>(null);
  const close = () => setEditing(null);

  return (
    <div className="space-y-4">
      {items.length === 0 && editing !== "new" && (
        <p className="text-sm text-ink/60">{self ? "No children added yet." : "No children listed."}</p>
      )}

      {items.length > 0 && (
        <ul className="divide-y divide-line">
          {items.map((c) =>
            editing === c.id ? (
              <li key={c.id} className="py-3">
                <ChildForm parentId={parentId} child={c} self={self} onDone={close} />
              </li>
            ) : (
              <li key={c.id} className="flex flex-wrap items-center justify-between gap-3 py-2.5">
                <div className="flex min-w-0 items-center gap-3">
                  <Baby aria-hidden className="h-4 w-4 shrink-0 text-gold" />
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium">{c.name}</p>
                    <p className="text-xs text-ink/60">
                      {c.birthdayLabel ? (
                        <>
                          Born {c.birthdayLabel}
                          {c.age !== null && <> · {c.age === 0 ? "under 1" : `${c.age} ${c.age === 1 ? "year" : "years"} old`}</>}
                        </>
                      ) : (
                        "No birthday added"
                      )}
                    </p>
                  </div>
                </div>
                <div className="flex shrink-0 gap-2">
                  <button type="button" className="btn-ghost btn-sm" onClick={() => setEditing(c.id)}>
                    Edit
                  </button>
                  <form action={removeChild}>
                    <input type="hidden" name="parent_id" value={parentId} />
                    <input type="hidden" name="child_id" value={c.id} />
                    <ConfirmSubmitButton
                      className="btn-danger-outline btn-sm"
                      title={`Remove ${c.name}?`}
                      message={`${c.name} and their birthday will be removed from ${self ? "your" : "this member's"} profile.`}
                      confirmLabel="Remove"
                      pendingLabel="Removing…"
                    >
                      Remove
                    </ConfirmSubmitButton>
                  </form>
                </div>
              </li>
            )
          )}
        </ul>
      )}

      {editing === "new" ? (
        <ChildForm parentId={parentId} self={self} onDone={close} />
      ) : (
        items.length < 20 && (
          <button type="button" className="btn-secondary" onClick={() => setEditing("new")}>
            <Plus aria-hidden className="h-4 w-4" />
            Add a child
          </button>
        )
      )}
    </div>
  );
}

function ChildForm({ parentId, child, self, onDone }: { parentId: string; child?: ChildRow; self: boolean; onDone: () => void }) {
  const [state, action] = useFormState(saveChild, null);
  const id = useId();
  const fe = state?.fieldErrors ?? {};
  const v = state?.values;

  useEffect(() => {
    if (state?.ok) onDone();
  }, [state, onDone]);

  return (
    <form action={action} className="space-y-4 rounded-xl border border-line p-4" noValidate>
      {state?.error && <Alert tone="error">{state.error}</Alert>}
      <input type="hidden" name="parent_id" value={parentId} />
      <input type="hidden" name="child_id" value={child?.id ?? ""} />
      <div className="grid gap-4 sm:grid-cols-2">
        <FormField label="Child's name" htmlFor={`${id}-name`} required error={fe.name}>
          <input
            id={`${id}-name`}
            name="name"
            required
            maxLength={80}
            autoFocus
            defaultValue={v?.name ?? child?.name ?? ""}
            className="input"
            aria-invalid={Boolean(fe.name)}
          />
        </FormField>
        <FormField
          label="Birthday"
          htmlFor={`${id}-birth`}
          optional
          error={fe.birth_date}
          hint={self ? "Only you and your pastors see this." : undefined}
        >
          <input
            id={`${id}-birth`}
            name="birth_date"
            type="date"
            max={new Date().toISOString().slice(0, 10)}
            defaultValue={v?.birth_date ?? child?.birthDate ?? ""}
            className="input"
            aria-invalid={Boolean(fe.birth_date)}
          />
        </FormField>
      </div>
      <div className="flex flex-wrap gap-2">
        <PendingButton>{child ? "Save" : "Add child"}</PendingButton>
        <button type="button" className="btn-ghost" onClick={onDone}>
          Cancel
        </button>
      </div>
    </form>
  );
}
