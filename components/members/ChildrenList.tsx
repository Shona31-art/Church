"use client";

import { useEffect, useId, useState } from "react";
import { useFormState } from "react-dom";
import { Baby, Plus } from "lucide-react";
import { removeChild, saveChild } from "@/app/dashboard/account/children-actions";
import { ConfirmSubmitButton, PendingButton } from "@/components/ConfirmSubmitButton";
import { Alert } from "@/components/ui/Alert";
import { FormField } from "@/components/ui/FormField";
import { BirthdayField } from "@/components/ui/BirthdayField";
import { PersonPicker } from "@/components/ui/PersonPicker";
import { PersonPhoto } from "@/components/members/PersonPhoto";

export interface ChildRow {
  id: string;
  name: string;
  birthDate: string | null;
  /** Day and month only, e.g. "14 March" — never the year or age. */
  birthdayLabel: string | null;
  /** Who the child is filed under (the member who added them, or a parent). */
  ownerId?: string;
  mother?: ParentRef;
  father?: ParentRef;
  /** record_members.sql: their photo (for the birthday poster) and whether the church celebrates their birthday. */
  photoUrl?: string | null;
  announce?: boolean;
}

/** A parent: a member (id + name) or just a name for someone not in the app. */
export type ParentRef = { id: string | null; name: string } | null;
export type Person = { id: string; name: string };

/**
 * A member's children: list, add, edit and remove. Used on My account (the
 * parent) and on a member's profile (pastors and church admins).
 */
export function ChildrenList({ parentId, items, self, people = [] }: { parentId: string; items: ChildRow[]; self: boolean; people?: Person[] }) {
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
                <ChildForm parentId={c.ownerId ?? parentId} child={c} self={self} people={people} onDone={close} />
              </li>
            ) : (
              <li key={c.id} className="flex flex-wrap items-center justify-between gap-3 py-2.5">
                <div className="flex min-w-0 items-center gap-3">
                  {c.photoUrl !== undefined ? <PersonPhoto kind="child" id={c.id} name={c.name} photoUrl={c.photoUrl ?? null} size="md" compact /> : <Baby aria-hidden className="h-4 w-4 shrink-0 text-gold" />}
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium">{c.name}</p>
                    <p className="text-xs text-ink/60">{c.birthdayLabel ? `Birthday ${c.birthdayLabel}` : "No birthday added"}</p>
                    <ParentsLine child={c} />
                  </div>
                </div>
                <div className="flex shrink-0 gap-2">
                  <button type="button" className="btn-ghost btn-sm" onClick={() => setEditing(c.id)}>
                    Edit
                  </button>
                  <form action={removeChild}>
                    <input type="hidden" name="parent_id" value={c.ownerId ?? parentId} />
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
        <ChildForm parentId={parentId} self={self} people={people} onDone={close} />
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

/** "Mother: Thandi Moyo · Father: David Moyo" */
export function ParentsLine({ child }: { child: ChildRow }) {
  const parts = [child.mother && `Mother: ${child.mother.name}`, child.father && `Father: ${child.father.name}`].filter(Boolean);
  return parts.length ? <p className="text-xs text-ink/60">{parts.join(" · ")}</p> : null;
}

/** A parent: pick a member, or type the name of someone who isn't in the app. */
function ParentField({ role, id, people, current, error }: { role: "mother" | "father"; id: string; people: Person[]; current: ParentRef | undefined; error?: string }) {
  const initial = current?.id ?? (current?.name ? "__name" : "");
  const [choice, setChoice] = useState(initial);
  const label = role === "mother" ? "Mother" : "Father";
  return (
    <FormField label={label} htmlFor={`${id}-${role}`} optional error={error}>
      <PersonPicker
        id={`${id}-${role}`}
        title={`Who is the ${role}?`}
        value={choice}
        onChange={(v) => setChoice(v)}
        placeholder="Not set"
        invalid={Boolean(error)}
        options={[{ value: "", label: "Not set" }, { value: "__name", label: "Someone not in the app (type the name)" }, ...people.map((p) => ({ value: p.id, label: p.name }))]}
      />
      <input type="hidden" name={`${role}_id`} value={choice && choice !== "__name" ? choice : ""} />
      {choice === "__name" && (
        <input name={`${role}_name`} className="input mt-2" maxLength={80} placeholder={`${label}'s name`} defaultValue={current && !current.id ? current.name : ""} aria-label={`${label}'s name`} />
      )}
    </FormField>
  );
}

export function ChildForm({ parentId, child, self, people = [], onDone }: { parentId: string; child?: ChildRow; self: boolean; people?: Person[]; onDone: () => void }) {
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
      <FormField label="Child's name" htmlFor={`${id}-name`} required error={fe.name}>
        <input id={`${id}-name`} name="name" required maxLength={80} autoFocus defaultValue={v?.name ?? child?.name ?? ""} className="input" aria-invalid={Boolean(fe.name)} />
      </FormField>
      <BirthdayField
        name="birth_date"
        defaultValue={v?.birth_date ?? child?.birthDate ?? ""}
        error={fe.birth_date}
        hint={self ? "Only your family and your pastors see it — day and month only, never the age." : "Day and month only are shown, never the age."}
      />
      <label className="flex items-start gap-2 text-sm">
        <input type="checkbox" name="announce" defaultChecked={v ? v.announce === "on" : child?.announce !== false} className="mt-0.5 h-4 w-4" />
        <span>Celebrate their birthday with the church (a notification and a birthday poster in the General chat)</span>
      </label>
      {!child && <p className="text-xs text-ink/60">You can add their photo once they’re saved — tap the camera next to their name.</p>}
      {people.length > 0 && (
        <div className="grid gap-4 sm:grid-cols-2 [&>*]:min-w-0">
          <ParentField role="mother" id={id} people={people} current={child?.mother} error={fe.mother_id} />
          <ParentField role="father" id={id} people={people} current={child?.father} error={fe.father_id} />
        </div>
      )}
      <div className="flex flex-wrap gap-2">
        <PendingButton>{child ? "Save" : "Add child"}</PendingButton>
        <button type="button" className="btn-ghost" onClick={onDone}>
          Cancel
        </button>
      </div>
    </form>
  );
}
