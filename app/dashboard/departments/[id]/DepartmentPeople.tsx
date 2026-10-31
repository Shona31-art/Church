"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useFormState } from "react-dom";
import { Search, UserPlus } from "lucide-react";
import { addPeopleToDepartment, removeFromDepartment, setDepartmentLeader } from "../actions";
import { ConfirmSubmitButton, PendingButton } from "@/components/ConfirmSubmitButton";
import { Alert } from "@/components/ui/Alert";
import { Avatar } from "@/components/ui/Avatar";
import { showToast } from "@/components/ui/Toaster";

export interface DeptPerson {
  id: string;
  name: string;
  role: string;
  roleLabel: string;
  photoUrl: string | null;
  /** Name of the department they're in now (for people outside this one). */
  currentDepartment: string | null;
}

/** Who's in the department, with Add people / Make leader / Remove right here. */
export function DepartmentPeople({
  departmentId,
  departmentName,
  members,
  others,
  meId,
  canManage,
}: {
  departmentId: string;
  departmentName: string;
  members: DeptPerson[];
  /** Everyone else in the church who could be added. */
  others: DeptPerson[];
  meId: string;
  canManage: boolean;
}) {
  return (
    <div className="space-y-4">
      {canManage && <AddPeople departmentId={departmentId} departmentName={departmentName} others={others} />}
      {members.length ? (
        <ul className="divide-y divide-line">
          {members.map((m) => (
            <li key={m.id} className="flex flex-wrap items-center gap-3 py-3">
              <Avatar name={m.name} src={m.photoUrl} size="sm" />
              <div className="min-w-0 flex-1">
                <Link href={`/dashboard/members/${m.id}`} className="block truncate text-sm font-medium hover:underline">
                  {m.name}
                </Link>
                <span className="text-xs text-ink/60">{m.role === "department_leader" ? "Leader" : m.roleLabel}</span>
              </div>
              {canManage && (
                <div className="flex shrink-0 items-center gap-1">
                  {m.id !== meId && (m.role === "member" || m.role === "department_leader") && (
                    <form action={setDepartmentLeader}>
                      <input type="hidden" name="department_id" value={departmentId} />
                      <input type="hidden" name="member_id" value={m.id} />
                      <input type="hidden" name="lead" value={m.role === "department_leader" ? "0" : "1"} />
                      <PendingButton className="btn-ghost btn-sm" pendingLabel="…">
                        {m.role === "department_leader" ? "Remove as leader" : "Make leader"}
                      </PendingButton>
                    </form>
                  )}
                  <form action={removeFromDepartment}>
                    <input type="hidden" name="department_id" value={departmentId} />
                    <input type="hidden" name="member_id" value={m.id} />
                    <ConfirmSubmitButton
                      title={m.id === meId ? `Leave ${departmentName}?` : `Remove ${m.name} from ${departmentName}?`}
                      message={
                        m.role === "department_leader"
                          ? "They'll stop seeing this department's announcements and chat, and they'll no longer be its leader. Their account stays as it is."
                          : "They'll stop seeing this department's announcements and chat. Their account stays as it is, and you can add them back any time."
                      }
                      confirmLabel="Remove"
                      pendingLabel="Removing…"
                      className="btn-ghost btn-sm text-danger"
                    >
                      {m.id === meId ? "Leave" : "Remove"}
                    </ConfirmSubmitButton>
                  </form>
                </div>
              )}
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-sm text-ink/60">Nobody is in this department yet.{canManage ? " Use “Add people” to add them." : ""}</p>
      )}
    </div>
  );
}

function AddPeople({ departmentId, departmentName, others }: { departmentId: string; departmentName: string; others: DeptPerson[] }) {
  const [state, action] = useFormState(addPeopleToDepartment, null);
  const [query, setQuery] = useState("");
  const [picked, setPicked] = useState<Set<string>>(new Set());
  const dialogRef = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    if (!state?.ok) return;
    dialogRef.current?.close();
    setPicked(new Set());
    setQuery("");
    if (state.skipped?.length) showToast(`Couldn't add ${state.skipped.join(", ")}. Only a church admin can move another church admin.`, "error");
  }, [state]);

  const shown = useMemo(() => {
    const q = query.trim().toLowerCase();
    return q ? others.filter((p) => p.name.toLowerCase().includes(q)) : others;
  }, [others, query]);

  function toggle(id: string) {
    setPicked((set) => {
      const next = new Set(set);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  const moving = others.filter((p) => picked.has(p.id) && p.currentDepartment);

  return (
    <>
      <button type="button" className="btn-primary btn-sm" onClick={() => dialogRef.current?.showModal()} aria-haspopup="dialog">
        <UserPlus aria-hidden className="h-4 w-4" /> Add people
      </button>
      <dialog
        ref={dialogRef}
        aria-labelledby="add-people-title"
        className="m-auto w-[calc(100%-2rem)] max-w-md rounded-2xl border border-line p-0 text-ink shadow-pop backdrop:bg-ink/45 motion-safe:animate-modal-in"
      >
        <form action={action} className="flex max-h-[85vh] flex-col">
          <input type="hidden" name="department_id" value={departmentId} />
          <div className="space-y-3 border-b border-line p-5">
            <h2 id="add-people-title" className="text-lg font-semibold">
              Add people to {departmentName}
            </h2>
            <div className="relative">
              <Search aria-hidden className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink/50" />
              <label htmlFor="add-people-search" className="sr-only">
                Search by name
              </label>
              <input id="add-people-search" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search by name" className="input pl-9" />
            </div>
            {state?.error && <Alert tone="error">{state.error}</Alert>}
          </div>

          <ul className="min-h-0 flex-1 overflow-y-auto px-2 py-2">
            {shown.map((p) => (
              <li key={p.id}>
                <label className="flex cursor-pointer items-center gap-3 rounded-xl px-3 py-2 hover:bg-ink/[0.04]">
                  <input type="checkbox" name="member_id" value={p.id} checked={picked.has(p.id)} onChange={() => toggle(p.id)} className="h-4 w-4" />
                  <Avatar name={p.name} src={p.photoUrl} size="xs" />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-medium">{p.name}</span>
                    <span className="block truncate text-xs text-ink/60">
                      {p.roleLabel}
                      {p.currentDepartment ? ` · in ${p.currentDepartment}` : ""}
                    </span>
                  </span>
                </label>
              </li>
            ))}
            {!shown.length && <li className="px-3 py-6 text-center text-sm text-ink/60">{others.length ? "Nobody matches that name." : "Everyone in your church is already in this department."}</li>}
          </ul>

          <div className="space-y-2 border-t border-line p-4">
            {moving.length > 0 && (
              <p className="text-xs text-ink/60">
                Each person is in one department, so {moving.map((p) => p.name).join(", ")} will move here from {moving.length === 1 ? moving[0].currentDepartment : "their current department"}.
              </p>
            )}
            <div className="flex justify-end gap-2">
              <button type="button" className="btn-secondary" onClick={() => dialogRef.current?.close()}>
                Cancel
              </button>
              <PendingButton pendingLabel="Adding…" disabled={!picked.size}>
                {picked.size ? `Add ${picked.size}` : "Add"}
              </PendingButton>
            </div>
          </div>
        </form>
      </dialog>
    </>
  );
}
