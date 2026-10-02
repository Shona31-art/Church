"use client";

import { useFormState } from "react-dom";
import { updateBookingStatus } from "./actions";
import { ConfirmSubmitButton, PendingButton } from "@/components/ConfirmSubmitButton";
import type { BookingStatus } from "@/lib/booking";

// Approve / decline / complete buttons for pastors. Each form carries the
// status the pastor is looking at (`from`) so the server can detect a
// decision someone else made in the meantime.
export function StatusActions({ bookingId, status }: { bookingId: string; status: BookingStatus }) {
  const [state, formAction] = useFormState(updateBookingStatus, null);

  const hidden = (to: BookingStatus) => (
    <>
      <input type="hidden" name="booking_id" value={bookingId} />
      <input type="hidden" name="from" value={status} />
      <input type="hidden" name="to" value={to} />
    </>
  );

  return (
    <div className="space-y-4">
      {state?.error && (
        <p role="alert" className="text-sm text-red-700 bg-red-50 border border-red-200 rounded-lg p-3">
          ⚠ {state.error}
        </p>
      )}

      {status === "pending" && (
        <>
          <form action={formAction}>
            {hidden("approved")}
            <PendingButton pendingLabel="Approving…" className="bg-ember text-white px-4 py-2 rounded-lg text-sm disabled:opacity-50">
              Approve
            </PendingButton>
          </form>

          <form action={formAction} className="space-y-2">
            {hidden("declined")}
            <label htmlFor="decline_reason" className="block text-sm font-medium">
              Reason for declining <span className="font-normal text-ink/40">(optional — the requester will see it)</span>
            </label>
            <input id="decline_reason" name="decline_reason" maxLength={500} className="w-full border border-ink/20 rounded-lg px-3 py-2 text-sm" />
            <ConfirmSubmitButton
              message="Decline this booking request? This can't be undone."
              pendingLabel="Declining…"
              className="border border-red-300 text-red-700 px-4 py-2 rounded-lg text-sm disabled:opacity-50"
            >
              Decline
            </ConfirmSubmitButton>
          </form>
        </>
      )}

      {status === "approved" && (
        <form action={formAction}>
          {hidden("completed")}
          <ConfirmSubmitButton
            message="Mark this booking as completed?"
            pendingLabel="Saving…"
            className="border border-ink/20 px-4 py-2 rounded-lg text-sm disabled:opacity-50"
          >
            Mark completed
          </ConfirmSubmitButton>
        </form>
      )}
    </div>
  );
}
