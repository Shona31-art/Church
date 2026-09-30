"use client";

import { useFormState } from "react-dom";
import { updateMember, deleteMemberPermanently, deactivateMember } from "./actions";
import { ConfirmSubmitButton, PendingButton } from "@/components/ConfirmSubmitButton";

interface Member {
  id: string;
  role: string;
  status: string;
  department_id: string | null;
}

export function MemberEditForm({
  member,
  birthDate,
  departments,
  viewerRole,
  isSelf,
}: {
  member: Member;
  birthDate: string;
  departments: { id: string; name: string }[];
  viewerRole: string;
  isSelf: boolean;
}) {
  const [state, formAction] = useFormState(updateMember, null);
  const lockRole = isSelf || (member.role === "church_admin" && viewerRole !== "church_admin");

  return (
    <form action={formAction} className="space-y-4">
      <input type="hidden" name="member_id" value={member.id} />
      {state?.error && <p role="alert" className="text-sm text-red-700 bg-red-50 border border-red-200 rounded-lg p-3">⚠ {state.error}</p>}
      {state?.ok && <p role="status" className="text-sm text-green-800 bg-green-50 border border-green-200 rounded-lg p-3">✓ Changes saved.</p>}

      <div>
        <label htmlFor="role" className="block text-sm font-medium mb-1">Role</label>
        {lockRole && <input type="hidden" name="role" value={member.role} />}
        <select id="role" name={lockRole ? undefined : "role"} defaultValue={member.role} disabled={lockRole} className="w-full border border-ink/20 rounded-lg px-4 py-3 disabled:bg-ink/5">
          <option value="member">Member</option>
          <option value="department_leader">Department Leader</option>
          <option value="pastor">Pastor</option>
          {(viewerRole === "church_admin" || member.role === "church_admin") && <option value="church_admin">Church Admin</option>}
        </select>
        {isSelf && <p className="text-xs text-ink/40 mt-1">You can&apos;t change your own role.</p>}
      </div>

      <div>
        <label htmlFor="department_id" className="block text-sm font-medium mb-1">Department</label>
        {lockRole && !isSelf && <input type="hidden" name="department_id" value={member.department_id ?? ""} />}
        <select
          id="department_id"
          name={lockRole && !isSelf ? undefined : "department_id"}
          defaultValue={member.department_id ?? ""}
          disabled={lockRole && !isSelf}
          className="w-full border border-ink/20 rounded-lg px-4 py-3 disabled:bg-ink/5"
        >
          <option value="">No department</option>
          {departments.map((d) => (
            <option key={d.id} value={d.id}>{d.name}</option>
          ))}
        </select>
      </div>

      <div>
        <label htmlFor="status" className="block text-sm font-medium mb-1">Status</label>
        {lockRole && <input type="hidden" name="status" value={member.status} />}
        <select id="status" name={lockRole ? undefined : "status"} defaultValue={member.status} disabled={lockRole} className="w-full border border-ink/20 rounded-lg px-4 py-3 disabled:bg-ink/5">
          <option value="active">Active</option>
          <option value="invited">Invited</option>
          <option value="disabled">Disabled</option>
        </select>
      </div>

      <div>
        <label htmlFor="birth_date" className="block text-sm font-medium mb-1">
          Birthday <span className="text-ink/40 font-normal">(optional — shown only to pastors & admins for reach-outs)</span>
        </label>
        <input id="birth_date" name="birth_date" type="date" defaultValue={birthDate} className="w-full border border-ink/20 rounded-lg px-4 py-3" />
      </div>

      <PendingButton className="bg-ember text-white px-6 py-3 rounded-lg font-medium disabled:opacity-50">Save changes</PendingButton>
    </form>
  );
}

export function DangerZone({
  memberId,
  memberName,
  canDeactivate,
  canDelete,
}: {
  memberId: string;
  memberName: string;
  canDeactivate: boolean;
  canDelete: boolean;
}) {
  const [state, deleteAction] = useFormState(deleteMemberPermanently, null);

  return (
    <div className="border-t border-ink/10 pt-6 space-y-6">
      <h2 className="text-sm font-semibold uppercase tracking-wide text-ink/50">Account actions</h2>

      {canDeactivate && (
        <form action={deactivateMember}>
          <input type="hidden" name="member_id" value={memberId} />
          <ConfirmSubmitButton message={`Deactivate ${memberName}? They'll lose access, but their records are kept and you can reactivate them later.`} className="text-amber-800 text-sm hover:underline">
            Deactivate (keeps records, removes access)
          </ConfirmSubmitButton>
        </form>
      )}

      {canDelete && (
        <form action={deleteAction} className="rounded-xl border border-red-200 bg-red-50/40 p-4 space-y-3">
          <input type="hidden" name="member_id" value={memberId} />
          <p className="text-sm font-semibold text-red-800">Permanently delete (POPIA erasure)</p>
          <p className="text-xs text-ink/60">
            Removes the login, profile, prayers, messages, bookings and care notes for {memberName}. Giving records are kept for financial
            retention but de-identified. This cannot be undone — consider exporting their data first.
          </p>
          <label htmlFor="confirm_name" className="block text-xs font-medium">Type DELETE to confirm</label>
          <input id="confirm_name" name="confirm_name" autoComplete="off" className="border border-red-300 rounded-lg px-3 py-2 text-sm w-40" />
          {state?.error && <p role="alert" className="text-xs text-red-700">⚠ {state.error}</p>}
          <div>
            <PendingButton className="text-sm bg-red-700 text-white rounded-lg px-4 py-2 disabled:opacity-50" pendingLabel="Deleting…">
              Delete permanently
            </PendingButton>
          </div>
        </form>
      )}
    </div>
  );
}
