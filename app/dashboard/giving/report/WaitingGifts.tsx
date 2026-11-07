"use client";

import { useFormState } from "react-dom";
import { CircleCheck, CircleX } from "lucide-react";
import { confirmTransfer } from "../actions";
import { ConfirmSubmitButton } from "@/components/ConfirmSubmitButton";
import { FieldError } from "@/components/ui/Alert";

export interface WaitingGift {
  id: string;
  donor: string;
  reference: string;
  /** How they paid: Bank transfer, PayShap, or the church's link. */
  how?: string;
  amountLabel: string;
  /** Rand, e.g. "250.00", to pre-fill "amount that arrived". */
  amountRand: string;
  fund: string;
  paidOn: string;
  updatedAt: string;
}

/**
 * Church admin: bank transfers members say they made. Check each against the
 * bank statement, then mark it received (correcting the amount if a different
 * amount arrived) or not received. Both ask first.
 */
export function WaitingGifts({ gifts }: { gifts: WaitingGift[] }) {
  return (
    <ul className="divide-y divide-line">
      {gifts.map((g) => (
        <WaitingRow key={g.id} gift={g} />
      ))}
    </ul>
  );
}

function WaitingRow({ gift }: { gift: WaitingGift }) {
  const [receivedState, receivedAction] = useFormState(confirmTransfer, null);
  const [notState, notAction] = useFormState(confirmTransfer, null);
  const amountId = `amount-${gift.id}`;

  return (
    <li className="py-4">
      <div className="flex flex-wrap items-start justify-between gap-x-4 gap-y-1">
        <div className="min-w-0">
          <p className="font-semibold">{gift.donor}</p>
          <p className="text-xs text-ink/60">
            {gift.how ? `${gift.how} · ` : ""}Reference <span className="tabular font-semibold text-ink">{gift.reference}</span> · {gift.fund} · paid {gift.paidOn}
          </p>
        </div>
        <p className="tabular text-lg font-semibold">{gift.amountLabel}</p>
      </div>

      <div className="mt-3 flex flex-wrap items-end gap-2">
        <form action={receivedAction} className="flex flex-wrap items-end gap-2">
          <input type="hidden" name="gift_id" value={gift.id} />
          <input type="hidden" name="outcome" value="received" />
          <input type="hidden" name="expected_updated_at" value={gift.updatedAt} />
          <div>
            <label htmlFor={amountId} className="mb-1 block text-xs font-medium text-ink/70">
              Amount that arrived (R)
            </label>
            <input
              id={amountId}
              name="amount"
              inputMode="decimal"
              defaultValue={gift.amountRand}
              className="input tabular w-32 py-2"
              aria-invalid={Boolean(receivedState?.fieldErrors?.amount)}
            />
          </div>
          <ConfirmSubmitButton
            title="Mark this gift as received?"
            message={`Only if ${gift.reference} appears on your bank statement. It will count in the giving report and in ${gift.donor}'s history.`}
            confirmLabel="Mark received"
            className="btn-primary btn-sm"
            tone="primary"
            pendingLabel="Saving…"
          >
            <CircleCheck aria-hidden className="h-3.5 w-3.5" /> Mark received
          </ConfirmSubmitButton>
        </form>

        <form action={notAction}>
          <input type="hidden" name="gift_id" value={gift.id} />
          <input type="hidden" name="outcome" value="not_received" />
          <input type="hidden" name="expected_updated_at" value={gift.updatedAt} />
          <ConfirmSubmitButton
            title="Mark as not received?"
            message={`${gift.donor} will see "Not received" in their history. Use this if no payment with reference ${gift.reference} arrived.`}
            confirmLabel="Not received"
            className="btn-ghost btn-sm text-danger hover:text-danger"
            pendingLabel="Saving…"
          >
            <CircleX aria-hidden className="h-3.5 w-3.5" /> Not received
          </ConfirmSubmitButton>
        </form>
      </div>
      <FieldError>{receivedState?.error ?? notState?.error}</FieldError>
    </li>
  );
}
