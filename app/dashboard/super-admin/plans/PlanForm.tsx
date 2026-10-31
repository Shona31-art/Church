"use client";

import { useEffect } from "react";
import { useFormState } from "react-dom";
import { savePlan } from "./actions";
import { PendingButton } from "@/components/ConfirmSubmitButton";
import { Alert } from "@/components/ui/Alert";
import { FormField } from "@/components/ui/FormField";
import { showToast } from "@/components/ui/Toaster";
import { MODULE_KEYS, MODULE_LABELS } from "@/lib/subscription";

export interface PlanRow {
  key: string;
  name: string;
  monthly_price: number | string;
  yearly_price?: number | string | null;
  member_limit: number | null;
  trial_days: number | null;
  description: string | null;
  modules: string[];
  churches: number;
}

const price = (v: number | string | null | undefined) => (v === null || v === undefined || v === "" ? "" : String(Number(v)));

/** One plan, editable: prices, member limit, description and features. */
export function PlanForm({ plan, yearlySupported }: { plan: PlanRow; yearlySupported: boolean }) {
  const [state, action] = useFormState(savePlan, null);
  const trial = plan.key === "free_trial";
  useEffect(() => {
    if (state?.ok) showToast(`${plan.name} saved.`, "success");
  }, [state, plan.name]);

  return (
    <form action={action} className="card-elevated space-y-4 rounded-2xl p-5 sm:p-6">
      <input type="hidden" name="key" value={plan.key} />
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="text-lg font-semibold">{plan.name}</h2>
        <span className="text-xs text-ink/60">
          {plan.churches} {plan.churches === 1 ? "church" : "churches"} on this plan
        </span>
      </div>
      {state?.error && <Alert tone="error">{state.error}</Alert>}
      {state?.ok && state.note && <Alert tone="warning">{state.note}</Alert>}

      <div className="grid gap-4 sm:grid-cols-2">
        <FormField label="Name" htmlFor={`name-${plan.key}`} required>
          <input id={`name-${plan.key}`} name="name" defaultValue={plan.name} maxLength={40} required className="input" />
        </FormField>
        <FormField label="Members" htmlFor={`limit-${plan.key}`} hint="Leave empty for unlimited.">
          <input id={`limit-${plan.key}`} name="member_limit" inputMode="numeric" defaultValue={plan.member_limit ?? ""} placeholder="Unlimited" className="input" />
        </FormField>
        {trial ? (
          <>
            <input type="hidden" name="monthly_price" value="0" />
            <FormField label="Trial length (days)" htmlFor={`trial-${plan.key}`}>
              <input id={`trial-${plan.key}`} name="trial_days" inputMode="numeric" defaultValue={plan.trial_days ?? 30} className="input" />
            </FormField>
          </>
        ) : (
          <>
            <FormField label="Monthly price (R)" htmlFor={`monthly-${plan.key}`} required>
              <input id={`monthly-${plan.key}`} name="monthly_price" inputMode="decimal" defaultValue={price(plan.monthly_price)} required className="input" />
            </FormField>
            {yearlySupported && (
              <FormField label="Yearly price (R)" htmlFor={`yearly-${plan.key}`} hint={`10× monthly = 2 months free (R${Math.round(Number(plan.monthly_price) * 10)}).`}>
                <input id={`yearly-${plan.key}`} name="yearly_price" inputMode="decimal" defaultValue={price(plan.yearly_price)} placeholder="No yearly option" className="input" />
              </FormField>
            )}
          </>
        )}
      </div>
      <FormField label="Short description" htmlFor={`desc-${plan.key}`} optional>
        <input id={`desc-${plan.key}`} name="description" defaultValue={plan.description ?? ""} maxLength={200} className="input" />
      </FormField>

      <details className="rounded-xl border border-line p-4">
        <summary className="cursor-pointer font-medium">
          Features <span className="font-normal text-ink/60">({plan.modules.length} included)</span>
        </summary>
        <div className="mt-3 grid gap-2 sm:grid-cols-2">
          {MODULE_KEYS.map((m) => (
            <label key={m} className="flex items-center gap-2 text-sm">
              <input type="checkbox" name="modules" value={m} defaultChecked={plan.modules.includes(m)} className="h-4 w-4" />
              {MODULE_LABELS[m]}
            </label>
          ))}
        </div>
      </details>

      <div className="flex flex-wrap items-center gap-3">
        <PendingButton pendingLabel="Saving…">Save {plan.name}</PendingButton>
        {!trial && <p className="text-xs text-ink/60">New prices apply to new subscriptions; churches already paying keep their price until they re-subscribe.</p>}
      </div>
    </form>
  );
}
