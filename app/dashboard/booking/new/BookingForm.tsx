"use client";

import Link from "next/link";
import { useFormState } from "react-dom";
import { createBooking } from "./actions";
import { BOOKING_TYPES } from "@/lib/booking";
import { PendingButton } from "@/components/ConfirmSubmitButton";

const field = "w-full border border-ink/20 rounded-lg px-4 py-3";

export function BookingForm({ pastors, today }: { pastors: { id: string; name: string }[]; today: string }) {
  const [state, formAction] = useFormState(createBooking, null);

  return (
    <form action={formAction} className="max-w-md space-y-4">
      <Link href="/dashboard/booking" className="text-sm text-ink/50 hover:text-ink">← Booking requests</Link>
      <h1 className="text-2xl font-semibold">Request a booking</h1>

      {state?.error && (
        <p role="alert" className="text-sm text-red-700 bg-red-50 border border-red-200 rounded-lg p-3">
          ⚠ {state.error}
        </p>
      )}

      <div>
        <label htmlFor="booking_type" className="block text-sm font-medium mb-1">Type of service</label>
        <select id="booking_type" name="booking_type" required className={`${field} capitalize`}>
          <option value="">Choose one…</option>
          {BOOKING_TYPES.map((t) => (
            <option key={t} value={t}>{t}</option>
          ))}
        </select>
      </div>

      <div>
        <label htmlFor="pastor_id" className="block text-sm font-medium mb-1">Pastor</label>
        <select id="pastor_id" name="pastor_id" className={field}>
          <option value="">Any available pastor</option>
          {pastors.map((p) => (
            <option key={p.id} value={p.id}>{p.name}</option>
          ))}
        </select>
      </div>

      <div>
        <label htmlFor="preferred_date" className="block text-sm font-medium mb-1">Preferred date</label>
        <input id="preferred_date" type="date" name="preferred_date" min={today} required className={field} />
      </div>

      <div>
        <label htmlFor="preferred_time" className="block text-sm font-medium mb-1">
          Preferred time <span className="font-normal text-ink/40">(optional)</span>
        </label>
        <input id="preferred_time" type="time" name="preferred_time" className={field} />
      </div>

      <div>
        <label htmlFor="location" className="block text-sm font-medium mb-1">
          Location <span className="font-normal text-ink/40">(optional)</span>
        </label>
        <input id="location" name="location" maxLength={200} className={field} />
      </div>

      <div>
        <label htmlFor="details" className="block text-sm font-medium mb-1">
          Anything else the pastor should know? <span className="font-normal text-ink/40">(optional)</span>
        </label>
        <textarea id="details" name="details" rows={4} maxLength={4000} className={field} />
      </div>

      <p className="text-xs text-ink/40">
        Your request goes to the pastors as “pending”. You'll see their answer on the request page.
      </p>

      <PendingButton pendingLabel="Submitting…" className="bg-ember text-white px-6 py-3 rounded-lg font-medium disabled:opacity-50">
        Submit request
      </PendingButton>
    </form>
  );
}
