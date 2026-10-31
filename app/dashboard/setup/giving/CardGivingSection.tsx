"use client";

import { useFormState } from "react-dom";
import { CreditCard } from "lucide-react";
import { disableCardGiving, enableCardGiving } from "../actions";
import { ConfirmSubmitButton } from "@/components/ConfirmSubmitButton";
import { Alert } from "@/components/ui/Alert";
import { StatusBadge } from "@/components/ui/StatusBadge";

export type CardGivingState =
  | { kind: "unavailable" } // platform's Paystack key not set
  | { kind: "no_details" }
  | { kind: "bank_not_listed" }
  | { kind: "off"; detailsUpdatedAt: string; bankLabel: string }
  | { kind: "paused"; detailsUpdatedAt: string; bankLabel: string } // bank details changed since it was on
  | { kind: "on"; bankLabel: string };

/**
 * Church admin: card giving through Paystack. Card gifts settle to the
 * church's own bank account (the details above); Paystack's fee comes out of
 * each gift unless the member chooses to add it. Grace-bound Ventures takes nothing.
 */
export function CardGivingSection({ state }: { state: CardGivingState }) {
  const [enableState, enableAction] = useFormState(enableCardGiving, null);
  const [disableState, disableAction] = useFormState(disableCardGiving, null);

  return (
    <section aria-labelledby="card-giving-title" className="card-elevated mt-6 max-w-xl space-y-4 rounded-2xl p-5 sm:p-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex items-start gap-3">
          <span aria-hidden className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-line bg-parchment text-gold">
            <CreditCard className="h-5 w-5" strokeWidth={1.75} />
          </span>
          <div>
            <h2 id="card-giving-title" className="text-xl font-semibold">
              Card giving
            </h2>
            <p className="mt-0.5 text-sm text-ink/60">Let members give by card through Paystack, paid into the account above.</p>
          </div>
        </div>
        {state.kind === "on" && <StatusBadge tone="success">On</StatusBadge>}
        {state.kind === "paused" && <StatusBadge tone="warning">Paused</StatusBadge>}
        {state.kind === "off" && <StatusBadge>Off</StatusBadge>}
      </div>

      {enableState?.error && <Alert tone="error">{enableState.error}</Alert>}
      {disableState?.error && <Alert tone="error">{disableState.error}</Alert>}

      {state.kind === "unavailable" && (
        <Alert tone="info">Card giving isn&apos;t available yet — the platform&apos;s Paystack account hasn&apos;t been connected. Bank transfers work in the meantime.</Alert>
      )}
      {state.kind === "no_details" && <p className="text-sm text-ink/70">Save your bank details above first. Card gifts are paid into that account.</p>}
      {state.kind === "bank_not_listed" && (
        <Alert tone="warning">
          Card giving needs a bank from the list (with its universal branch code). Edit the bank details above and choose your bank, then come back here.
        </Alert>
      )}

      {state.kind === "on" && (
        <>
          <p className="text-sm text-ink/80">Members can give by card. Gifts are paid into {state.bankLabel}, usually two working days later.</p>
          <form action={disableAction}>
            <ConfirmSubmitButton
              title="Turn off card giving?"
              message="Members won't be able to give by card until you turn it back on. Bank transfers keep working, and nothing already given is affected."
              confirmLabel="Turn off"
              className="btn-secondary btn-sm"
              pendingLabel="Turning off…"
            >
              Turn off card giving
            </ConfirmSubmitButton>
          </form>
        </>
      )}

      {(state.kind === "off" || state.kind === "paused") && (
        <>
          {state.kind === "paused" && (
            <Alert tone="warning">Card giving was paused because the bank details changed. Turn it on again to send card gifts to the new account.</Alert>
          )}
          <ul className="list-disc space-y-1 pl-5 text-sm text-ink/70">
            <li>Card gifts are paid into {state.bankLabel}, usually two working days later.</li>
            <li>Paystack&apos;s card fee comes out of each gift, unless the member chooses to add it so you receive the full amount.</li>
            <li>Grace-bound Ventures takes nothing from gifts. Refunds are done in Paystack if ever needed.</li>
          </ul>
          <form action={enableAction}>
            <input type="hidden" name="expected_details_updated_at" value={state.detailsUpdatedAt} />
            <ConfirmSubmitButton
              title={state.kind === "paused" ? "Turn card giving back on?" : "Turn on card giving?"}
              message={`Card gifts will be paid into ${state.bankLabel}. Paystack checks these bank details when you confirm.`}
              confirmLabel="Turn on"
              className="btn-primary"
              tone="primary"
              pendingLabel="Connecting to Paystack…"
            >
              <CreditCard aria-hidden className="h-4 w-4" /> {state.kind === "paused" ? "Turn card giving back on" : "Turn on card giving"}
            </ConfirmSubmitButton>
          </form>
        </>
      )}
    </section>
  );
}
