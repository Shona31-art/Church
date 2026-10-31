"use client";

import Link from "next/link";
import { useFormState } from "react-dom";
import { deleteEvent, rsvp, setEventCancelled } from "../actions";
import { ConfirmSubmitButton, PendingButton } from "@/components/ConfirmSubmitButton";
import { Alert } from "@/components/ui/Alert";
import { RSVP_LABELS, type RsvpStatus } from "@/lib/events";
import { Check } from "lucide-react";

export function RsvpButtons({ eventId, mine }: { eventId: string; mine: RsvpStatus | null }) {
  const [state, action] = useFormState(rsvp, null);
  return (
    <form action={action} data-haptic="success">
      <input type="hidden" name="event_id" value={eventId} />
      <fieldset>
        <legend className="text-sm font-medium mb-2">{mine ? "Your response" : "Will you be there?"}</legend>
        <div className="flex flex-wrap gap-2">
          {(Object.keys(RSVP_LABELS) as RsvpStatus[]).map((s) => (
            <button
              key={s}
              type="submit"
              name="status"
              value={s}
              aria-pressed={mine === s}
              className={mine === s ? "btn-primary" : "btn-secondary"}
            >
              {mine === s && <Check aria-hidden className="h-4 w-4" />}
              {RSVP_LABELS[s]}
            </button>
          ))}
          {mine && (
            <button type="submit" name="status" value="none" className="btn-ghost">
              Clear my response
            </button>
          )}
        </div>
      </fieldset>
      {state?.error && <Alert tone="error" className="mt-3">{state.error}</Alert>}
    </form>
  );
}

export function OrganiserActions({ eventId, title, cancelled, rsvpCount }: { eventId: string; title: string; cancelled: boolean; rsvpCount: number }) {
  const [cancelState, cancelAction] = useFormState(setEventCancelled, null);
  const [deleteState, deleteAction] = useFormState(deleteEvent, null);
  return (
    <div className="space-y-3">
      {(cancelState?.error || deleteState?.error) && <Alert tone="error">{cancelState?.error ?? deleteState?.error}</Alert>}
      <div className="flex flex-wrap gap-2">
        <Link href={`/dashboard/calendar/${eventId}/edit`} className="btn-primary">
          Edit
        </Link>
        <form action={cancelAction}>
          <input type="hidden" name="event_id" value={eventId} />
          <input type="hidden" name="cancel" value={cancelled ? "false" : "true"} />
          {cancelled ? (
            <PendingButton className="btn-secondary" pendingLabel="Reinstating…">
              Reinstate event
            </PendingButton>
          ) : (
            <ConfirmSubmitButton
              title={`Cancel “${title}”?`}
              message="The event stays on the calendar marked as cancelled, so people who planned to come can see it's off. RSVPs are closed. You can reinstate it later."
              confirmLabel="Cancel event"
              pendingLabel="Cancelling…"
              className="btn-secondary"
            >
              Cancel event
            </ConfirmSubmitButton>
          )}
        </form>
        <form action={deleteAction}>
          <input type="hidden" name="event_id" value={eventId} />
          <ConfirmSubmitButton
            title={`Delete “${title}”?`}
            message={`This permanently removes the event${rsvpCount ? ` and ${rsvpCount} RSVP${rsvpCount === 1 ? "" : "s"}` : ""}. To let people know it's off, cancel it instead. This can't be undone.`}
            confirmLabel="Delete event"
            pendingLabel="Deleting…"
          >
            Delete
          </ConfirmSubmitButton>
        </form>
      </div>
    </div>
  );
}
