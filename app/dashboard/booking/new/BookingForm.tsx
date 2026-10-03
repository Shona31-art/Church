"use client";

import Link from "next/link";
import { useFormState } from "react-dom";
import { createBooking } from "./actions";
import { BOOKING_TYPES, BOOKING_TYPE_LABELS } from "@/lib/booking";
import { PendingButton } from "@/components/ConfirmSubmitButton";
import { Alert } from "@/components/ui/Alert";
import { FormActions, FormField, RequiredNote } from "@/components/ui/FormField";

export function BookingForm({ pastors, today, blockedDates }: { pastors: { id: string; name: string }[]; today: string; blockedDates: { pastor: string; date: string }[] }) {
  const [state, formAction] = useFormState(createBooking, null);

  return (
    <form action={formAction} className="card-elevated rounded-2xl p-5 sm:p-6 space-y-5 max-w-xl">
      {state?.error && <Alert tone="error">{state.error}</Alert>}
      <RequiredNote />

      <FormField label="What do you need?" htmlFor="booking_type" required>
        <select id="booking_type" name="booking_type" required defaultValue="" className="input">
          <option value="" disabled>
            Choose one…
          </option>
          {BOOKING_TYPES.map((t) => (
            <option key={t} value={t}>
              {BOOKING_TYPE_LABELS[t]}
            </option>
          ))}
        </select>
      </FormField>

      <FormField label="Pastor" htmlFor="pastor_id">
        <select id="pastor_id" name="pastor_id" className="input">
          <option value="">Any available pastor</option>
          {pastors.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}
            </option>
          ))}
        </select>
      </FormField>

      <div className="grid gap-5 sm:grid-cols-2">
        <FormField label="Preferred date" htmlFor="preferred_date" required>
          <input id="preferred_date" type="date" name="preferred_date" min={today} required className="input" />
        </FormField>
        <FormField label="Preferred time" htmlFor="preferred_time" optional>
          <input id="preferred_time" type="time" name="preferred_time" className="input" />
        </FormField>
      </div>

      {blockedDates.length > 0 && (
        <details className="text-sm">
          <summary className="cursor-pointer text-ink/70">Dates pastors are away ({blockedDates.length})</summary>
          <ul className="mt-2 space-y-1 text-ink/70">
            {blockedDates.map((b, i) => (
              <li key={i}>
                {b.pastor}: {b.date}
              </li>
            ))}
          </ul>
        </details>
      )}

      <FormField label="Location" htmlFor="location" optional>
        <input id="location" name="location" maxLength={200} className="input" />
      </FormField>

      <FormField label="Anything else the pastor should know?" htmlFor="details" optional>
        <textarea id="details" name="details" rows={4} maxLength={4000} className="input" />
      </FormField>

      <p className="text-xs text-ink/60">Your request goes to the pastors as &ldquo;waiting for a pastor&rdquo;. You&apos;ll see their answer on the request page.</p>

      <FormActions>
        <PendingButton pendingLabel="Submitting…">Submit request</PendingButton>
        <Link href="/dashboard/booking" className="btn-secondary">
          Cancel
        </Link>
      </FormActions>
    </form>
  );
}
