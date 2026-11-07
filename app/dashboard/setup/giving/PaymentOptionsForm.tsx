"use client";

import { useEffect } from "react";
import { useFormState } from "react-dom";
import { Link2, Smartphone } from "lucide-react";
import { savePaymentOptions } from "../actions";
import { PendingButton } from "@/components/ConfirmSubmitButton";
import { Alert } from "@/components/ui/Alert";
import { FormField } from "@/components/ui/FormField";
import { showToast } from "@/components/ui/Toaster";

export interface PaymentOptions {
  payshap_id: string | null;
  link_label: string | null;
  link_url: string | null;
}

/**
 * Church admin: cheaper ways for members to give — PayShap (an instant bank
 * payment, free or a few rand) and the church's own payment link (SnapScan,
 * Zapper, Yoco…). Leave a field empty to switch it off.
 */
export function PaymentOptionsForm({ options }: { options: PaymentOptions | null }) {
  const [state, action] = useFormState(savePaymentOptions, null);
  const fe = state?.fieldErrors ?? {};
  const v = state?.values;
  useEffect(() => {
    if (state?.ok) showToast("Saved. Every church admin has been told about the change.");
  }, [state]);

  return (
    <section className="card-elevated mt-6 rounded-2xl p-5 sm:p-6" aria-labelledby="options-heading">
      <h2 id="options-heading" className="font-semibold">
        Other ways to give
      </h2>
      <p className="mt-1 text-sm text-ink/60">Cheaper than cards. Members pay, then record the gift with their reference, and you confirm it when it arrives — just like bank transfers.</p>
      <form action={action} className="mt-5 space-y-5" noValidate>
        {state?.error && <Alert tone="error">{state.error}</Alert>}
        <FormField
          label={
            <span className="inline-flex items-center gap-1.5">
              <Smartphone aria-hidden className="h-4 w-4 text-gold" /> PayShap ID
            </span>
          }
          htmlFor="payshap_id"
          optional
          error={fe.payshap_id}
          hint="Usually the church's cellphone number linked to its bank account for PayShap (set it up in your banking app). Members pay it instantly from their own banking app — free or a few rand."
        >
          <input id="payshap_id" name="payshap_id" maxLength={60} defaultValue={v?.payshap_id ?? options?.payshap_id ?? ""} className="input" placeholder="e.g. 082 123 4567" autoComplete="off" />
        </FormField>

        <div className="grid gap-5 sm:grid-cols-[12rem_minmax(0,1fr)] [&>*]:min-w-0">
          <FormField
            label={
              <span className="inline-flex items-center gap-1.5">
                <Link2 aria-hidden className="h-4 w-4 text-gold" /> Link name
              </span>
            }
            htmlFor="link_label"
            optional
            error={fe.link_label}
          >
            <input id="link_label" name="link_label" maxLength={40} defaultValue={v?.link_label ?? options?.link_label ?? ""} className="input" placeholder="e.g. SnapScan" />
          </FormField>
          <FormField label="Your payment link" htmlFor="link_url" optional error={fe.link_url} hint="A link from SnapScan, Zapper, Yoco or similar that your church already has. That company's fees come off each gift.">
            <input id="link_url" name="link_url" type="url" inputMode="url" maxLength={500} defaultValue={v?.link_url ?? options?.link_url ?? ""} className="input" placeholder="https://…" />
          </FormField>
        </div>

        <PendingButton pendingLabel="Saving…">Save</PendingButton>
      </form>
    </section>
  );
}
