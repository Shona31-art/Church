"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { Baby, Cake, Plus } from "lucide-react";
import { removeChild } from "@/app/dashboard/account/children-actions";
import { ConfirmSubmitButton } from "@/components/ConfirmSubmitButton";
import { ChildForm, type ChildRow, type ParentRef, type Person } from "@/components/members/ChildrenList";

const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

/** Search, filter by birthday month, add, edit and remove children. */
export function ChildrenDirectory({ items, people, canEdit }: { items: ChildRow[]; people: Person[]; canEdit: boolean }) {
  const [query, setQuery] = useState("");
  const [month, setMonth] = useState("");
  const [editing, setEditing] = useState<string | "new" | null>(null);
  const close = () => setEditing(null);

  const q = query.trim().toLowerCase();
  const shown = useMemo(
    () =>
      items.filter((c) => {
        if (month && Number(c.birthDate?.slice(5, 7)) !== Number(month)) return false;
        if (!q) return true;
        return [c.name, c.mother?.name, c.father?.name].some((n) => n?.toLowerCase().includes(q));
      }),
    [items, q, month],
  );

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-2 sm:flex-row">
        <input type="search" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search a child or parent…" aria-label="Search children and parents" className="input flex-1" />
        <select value={month} onChange={(e) => setMonth(e.target.value)} aria-label="Birthday month" className="input sm:w-56">
          <option value="">All birthday months</option>
          {MONTHS.map((m, i) => (
            <option key={m} value={String(i + 1)}>
              Birthdays in {m}
            </option>
          ))}
        </select>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm text-ink/60">
          {shown.length === items.length ? `${items.length} ${items.length === 1 ? "child" : "children"}` : `Showing ${shown.length} of ${items.length}`}
        </p>
        {canEdit && editing !== "new" && (
          <button type="button" className="btn-primary" onClick={() => setEditing("new")}>
            <Plus aria-hidden className="h-4 w-4" /> Add a child
          </button>
        )}
      </div>

      {editing === "new" && <ChildForm parentId="" self={false} people={people} onDone={close} />}

      {!items.length && editing !== "new" && (
        <div className="card-elevated rounded-2xl p-8 text-center">
          <Baby aria-hidden className="mx-auto h-10 w-10 text-gold" />
          <p className="mt-3 font-display text-xl font-semibold">No children listed yet</p>
          <p className="mt-1 text-sm text-ink/60">Add them here, or parents can add their own from My account.</p>
        </div>
      )}

      <ul className="grid gap-3 sm:grid-cols-2">
        {shown.map((c) =>
          editing === c.id ? (
            <li key={c.id} className="sm:col-span-2">
              <ChildForm parentId={c.ownerId ?? ""} child={c} self={false} people={people} onDone={close} />
            </li>
          ) : (
            <li key={c.id} className="card-elevated flex flex-col gap-3 rounded-2xl p-4">
              <div className="flex items-start gap-3">
                <span aria-hidden className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-gold/15 font-display text-lg font-semibold text-gold">
                  {c.name.trim()[0]?.toUpperCase()}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate font-semibold">{c.name}</p>
                  <p className="flex items-center gap-1 text-sm text-ink/70">
                    <Cake aria-hidden className="h-3.5 w-3.5 text-gold" /> {c.birthdayLabel ?? "No birthday added"}
                  </p>
                </div>
              </div>
              <dl className="grid grid-cols-[4.5rem_1fr] gap-x-2 gap-y-1 text-sm">
                <dt className="text-ink/60">Mother</dt>
                <dd className="min-w-0 truncate"><ParentLink parent={c.mother} /></dd>
                <dt className="text-ink/60">Father</dt>
                <dd className="min-w-0 truncate"><ParentLink parent={c.father} /></dd>
              </dl>
              {canEdit && (
                <div className="flex gap-2 border-t border-line pt-3">
                  <button type="button" className="btn-ghost btn-sm" onClick={() => setEditing(c.id)}>
                    Edit
                  </button>
                  <form action={removeChild}>
                    <input type="hidden" name="parent_id" value={c.ownerId ?? ""} />
                    <input type="hidden" name="child_id" value={c.id} />
                    <ConfirmSubmitButton className="btn-danger-outline btn-sm" title={`Remove ${c.name}?`} message={`${c.name} and their birthday will be removed.`} confirmLabel="Remove" pendingLabel="Removing…">
                      Remove
                    </ConfirmSubmitButton>
                  </form>
                </div>
              )}
            </li>
          ),
        )}
      </ul>
    </div>
  );
}

function ParentLink({ parent }: { parent: ParentRef | undefined }) {
  if (!parent) return <span className="text-ink/40">Not added</span>;
  return parent.id ? (
    <Link href={`/dashboard/members/${parent.id}`} className="link">
      {parent.name}
    </Link>
  ) : (
    <span>{parent.name}</span>
  );
}
