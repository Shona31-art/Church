"use client";

import { useFormState } from "react-dom";
import { updateTicketStatus } from "./actions";
import { PendingButton } from "@/components/ConfirmSubmitButton";
import { TICKET_STATUSES } from "@/lib/support";

export function StatusButtons({ ticketId, status }: { ticketId: string; status: string }) {
  const [state, formAction] = useFormState(updateTicketStatus, null);

  return (
    <div>
      <p className="text-sm font-medium mb-2">Set status</p>
      <div className="flex flex-wrap gap-2">
        {TICKET_STATUSES.map((s) => (
          <form key={s} action={formAction}>
            <input type="hidden" name="ticket_id" value={ticketId} />
            <input type="hidden" name="status" value={s} />
            <PendingButton
              pendingLabel="Saving…"
              className={`${status === s ? "btn-primary" : "btn-secondary"} btn-sm capitalize`}
            >
              {status === s ? `✓ ${s.replace("_", " ")}` : s.replace("_", " ")}
            </PendingButton>
          </form>
        ))}
      </div>
      {state?.error && <p role="alert" className="text-sm text-danger mt-2">⚠ {state.error}</p>}
    </div>
  );
}
