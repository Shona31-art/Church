"use client";

import { useFormState } from "react-dom";
import { updateTicketStatus } from "./actions";
import { PendingButton } from "@/components/ConfirmSubmitButton";
import { TICKET_STATUSES } from "@/lib/support";
import { Check } from "lucide-react";
import { FieldError } from "@/components/ui/Alert";

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
              {status === s && <Check aria-hidden className="h-3.5 w-3.5" />}
              {s.replace("_", " ")}
            </PendingButton>
          </form>
        ))}
      </div>
      <FieldError>{state?.error}</FieldError>
    </div>
  );
}
