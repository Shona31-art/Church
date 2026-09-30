"use client";

import { useFormState, useFormStatus } from "react-dom";
import { createBooking } from "./actions";

export function BookingForm({ pastors }: { pastors: { id: string; name: string }[] }) {
  const [state, formAction] = useFormState(createBooking, null);

  return (
    <form action={formAction} className="max-w-md space-y-4">
      <h1 className="text-2xl font-semibold mb-4">Request a booking</h1>

      {state?.error && (
        <p className="text-sm text-red-700 bg-red-50 border border-red-200 rounded-lg p-3">
          {state.error}
        </p>
      )}

      <select name="booking_type" required className="w-full border border-ink/20 rounded-lg px-4 py-3">
        <option value="">What kind of service?</option>
        <option value="wedding">Wedding</option>
        <option value="funeral">Funeral</option>
        <option value="thanksgiving">Thanksgiving</option>
        <option value="baptism">Baptism</option>
        <option value="counselling">Counselling</option>
        <option value="other">Other</option>
      </select>

      <select name="pastor_id" className="w-full border border-ink/20 rounded-lg px-4 py-3">
        <option value="">Any available pastor</option>
        {pastors.map((p) => (
          <option key={p.id} value={p.id}>
            {p.name}
          </option>
        ))}
      </select>

      <div>
        <label className="text-xs text-ink/40">Preferred date</label>
        <input
          type="date"
          name="preferred_date"
          required
          className="w-full border border-ink/20 rounded-lg px-4 py-3"
        />
      </div>
      <div>
        <label className="text-xs text-ink/40">Preferred time (optional)</label>
        <input type="time" name="preferred_time" className="w-full border border-ink/20 rounded-lg px-4 py-3" />
      </div>

      <input
        name="location"
        placeholder="Location (optional)"
        className="w-full border border-ink/20 rounded-lg px-4 py-3"
      />
      <textarea
        name="details"
        placeholder="Anything else the pastor should know..."
        rows={4}
        className="w-full border border-ink/20 rounded-lg px-4 py-3"
      />

      <SubmitButton />
    </form>
  );
}

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="bg-ember text-white px-6 py-3 rounded-lg font-medium disabled:opacity-50"
    >
      {pending ? "Submitting..." : "Submit request"}
    </button>
  );
}
