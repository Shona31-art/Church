"use client";

import { useEffect, useRef } from "react";
import { useFormState } from "react-dom";
import { deleteMemberPermanently, resendInvite, setMemberStatus } from "../actions";
import { ConfirmSubmitButton, PendingButton } from "@/components/ConfirmSubmitButton";
import { Alert } from "@/components/ui/Alert";
import { FormField } from "@/components/ui/FormField";
import { showToast } from "@/components/ui/Toaster";
import type { AccountStatus } from "@/lib/permissions";

/**
 * Account actions on a member profile, from least to most destructive:
 * resend invite → export data → deactivate/reactivate → permanent deletion.
 */
export function MemberAccountActions({
  memberId,
  memberName,
  status,
  canChangeAccess,
  canDelete,
  canExport,
}: {
  memberId: string;
  memberName: string;
  status: AccountStatus;
  canChangeAccess: boolean;
  canDelete: boolean;
  canExport: boolean;
}) {
  const [statusState, statusAction] = useFormState(setMemberStatus, null);
  const [inviteState, inviteAction] = useFormState(resendInvite, null);

  useEffect(() => {
    if (inviteState?.ok) showToast(`A new invite email is on its way to ${memberName}.`);
  }, [inviteState, memberName]);

  return (
    <div className="mt-4 space-y-3">
      {statusState?.error && <Alert tone="error">{statusState.error}</Alert>}
      {inviteState?.error && <Alert tone="error">{inviteState.error}</Alert>}

      <div className="flex flex-wrap gap-2">
        {status === "invited" && canChangeAccess && (
          <form action={inviteAction}>
            <input type="hidden" name="member_id" value={memberId} />
            <PendingButton className="btn-secondary" pendingLabel="Sending…">
              Resend invite
            </PendingButton>
          </form>
        )}

        {canExport && (
          // Plain link: this is a file download from an API route.
          <a href={`/api/members/${memberId}/export`} className="btn-secondary">
            Export their data (POPIA)
          </a>
        )}

        {canChangeAccess && status !== "disabled" && (
          <form action={statusAction}>
            <input type="hidden" name="member_id" value={memberId} />
            <input type="hidden" name="to" value="disabled" />
            <ConfirmSubmitButton
              title={`Deactivate ${memberName}?`}
              message="They'll be signed out and won't be able to sign in. Their profile, prayers, giving history and care records are all kept, and you can reactivate them at any time."
              confirmLabel="Deactivate"
              pendingLabel="Deactivating…"
            >
              Deactivate
            </ConfirmSubmitButton>
          </form>
        )}

        {canChangeAccess && status === "disabled" && (
          <form action={statusAction}>
            <input type="hidden" name="member_id" value={memberId} />
            <input type="hidden" name="to" value="active" />
            <ConfirmSubmitButton
              title={`Reactivate ${memberName}?`}
              message="They'll be able to sign in again with their existing email and password."
              confirmLabel="Reactivate"
              pendingLabel="Reactivating…"
              tone="primary"
              className="btn-secondary"
            >
              Reactivate
            </ConfirmSubmitButton>
          </form>
        )}
      </div>

      {canDelete && <DeleteMember memberId={memberId} memberName={memberName} />}
    </div>
  );
}

function DeleteMember({ memberId, memberName }: { memberId: string; memberName: string }) {
  const [state, action] = useFormState(deleteMemberPermanently, null);
  const dialogRef = useRef<HTMLDialogElement>(null);

  return (
    <div className="border-t border-line pt-3">
      <button type="button" className="btn-ghost btn-sm text-danger" onClick={() => dialogRef.current?.showModal()} aria-haspopup="dialog">
        Delete permanently…
      </button>
      <dialog
        ref={dialogRef}
        aria-labelledby="delete-member-title"
        className="w-[calc(100%-2rem)] max-w-md rounded-2xl p-0 text-ink shadow-xl backdrop:bg-ink/40"
      >
        <form action={action} className="p-6 space-y-4">
          <input type="hidden" name="member_id" value={memberId} />
          <h2 id="delete-member-title" className="text-lg font-semibold">
            Permanently delete {memberName}?
          </h2>
          <div className="text-sm text-ink/70 space-y-2">
            <p>
              This is a POPIA erasure. It removes their login, profile, prayers, messages, bookings and pastoral care
              notes. Giving records are kept for financial reporting but no longer linked to them.
            </p>
            <p className="font-semibold text-danger">This can&apos;t be undone. Export their data first if they asked for a copy.</p>
            <p>If they&apos;ve simply left the church, deactivate them instead.</p>
          </div>
          {state?.error && !state.fieldErrors && <Alert tone="error">{state.error}</Alert>}
          <FormField label="Type DELETE to confirm" htmlFor="confirm_text" error={state?.fieldErrors?.confirm_text}>
            <input id="confirm_text" name="confirm_text" autoComplete="off" className="input" aria-invalid={Boolean(state?.fieldErrors?.confirm_text)} />
          </FormField>
          <div className="flex flex-wrap justify-end gap-2">
            <button type="button" autoFocus className="btn-secondary" onClick={() => dialogRef.current?.close()}>
              Cancel
            </button>
            <PendingButton className="btn-danger" pendingLabel="Deleting…">
              Delete permanently
            </PendingButton>
          </div>
        </form>
      </dialog>
    </div>
  );
}
