"use client";

import { useFormState } from "react-dom";
import { cancelMyBooking, updateBookingStatus } from "./actions";
import { ConfirmSubmitButton, PendingButton } from "@/components/ConfirmSubmitButton";
import { Alert } from "@/components/ui/Alert";
import { FormField } from "@/components/ui/FormField";
import type { BookingStatus } from "@/lib/booking";

// Approve / decline / complete / cancel buttons for pastors. Each form
// carries the status the pastor is looking at (`from`) so the server can
// detect a decision someone else made in the meantime.
export function StatusActions({ bookingId, status, requesterName }: { bookingId: string; status: BookingStatus; requesterName: string }) {
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
      {state?.error && <Alert tone="error">{state.error}</Alert>}

      {status === "pending" && (
        <>
          <form action={formAction}>
            {hidden("approved")}
            <PendingButton pendingLabel="Approving…">Approve request</PendingButton>
          </form>

          <form action={formAction} className="space-y-3 border-t border-line pt-4">
            {hidden("declined")}
            <FormField label="Reason for declining" htmlFor="decline_reason" optional hint={`${requesterName} will see this.`}>
              <textarea id="decline_reason" name="decline_reason" rows={2} maxLength={500} className="input" />
            </FormField>
            <ConfirmSubmitButton
              title="Decline this request?"
              message={`${requesterName} will see that it was declined, with your reason if you gave one. A declined request can't be re-opened — they would need to submit a new one.`}
              confirmLabel="Decline request"
              pendingLabel="Declining…"
            >
              Decline
            </ConfirmSubmitButton>
          </form>
        </>
      )}

      {status === "approved" && (
        <div className="flex flex-wrap gap-2">
          <form action={formAction}>
            {hidden("completed")}
            <ConfirmSubmitButton
              title="Mark this booking as completed?"
              message="Use this once the service has taken place. Completed bookings can't be changed."
              confirmLabel="Mark completed"
              pendingLabel="Saving…"
              className="btn-primary"
              tone="primary"
            >
              Mark completed
            </ConfirmSubmitButton>
          </form>
          <form action={formAction}>
            {hidden("cancelled")}
            <ConfirmSubmitButton
              title="Cancel this approved booking?"
              message={`${requesterName} will see that the booking was cancelled. Contact them directly to explain and, if needed, arrange a new date.`}
              confirmLabel="Cancel booking"
              pendingLabel="Cancelling…"
            >
              Cancel booking
            </ConfirmSubmitButton>
          </form>
        </div>
      )}
    </div>
  );
}

export function CancelMyRequest({ bookingId }: { bookingId: string }) {
  const [state, formAction] = useFormState(cancelMyBooking, null);
  return (
    <form action={formAction} className="space-y-2">
      <input type="hidden" name="booking_id" value={bookingId} />
      {state?.error && <Alert tone="error">{state.error}</Alert>}
      <ConfirmSubmitButton
        title="Cancel your request?"
        message="The pastors will see that you've withdrawn it. If you still need a pastor, you can submit a new request any time."
        confirmLabel="Cancel my request"
        pendingLabel="Cancelling…"
      >
        Cancel my request
      </ConfirmSubmitButton>
    </form>
  );
}
