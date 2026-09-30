"use client";

import { useFormState, useFormStatus } from "react-dom";
import { createEvent } from "./actions";

export function EventForm({
  departments,
  canPostChurchWide,
}: {
  departments: { id: string; name: string }[];
  canPostChurchWide: boolean;
}) {
  const [state, formAction] = useFormState(createEvent, null);

  return (
    <form action={formAction} className="max-w-lg space-y-4">
      <h1 className="text-2xl font-semibold mb-4">New event</h1>

      {state?.error && (
        <p className="text-sm text-red-700 bg-red-50 border border-red-200 rounded-lg p-3">
          {state.error}
        </p>
      )}

      <input
        name="title"
        placeholder="Event title"
        required
        className="w-full border border-ink/20 rounded-lg px-4 py-3"
      />
      <textarea
        name="description"
        placeholder="Description (optional)"
        rows={3}
        className="w-full border border-ink/20 rounded-lg px-4 py-3"
      />
      <input
        name="location"
        placeholder="Location (optional)"
        className="w-full border border-ink/20 rounded-lg px-4 py-3"
      />
      <select name="category" className="w-full border border-ink/20 rounded-lg px-4 py-3">
        <option value="service">Service</option>
        <option value="meeting">Meeting</option>
        <option value="wedding">Wedding</option>
        <option value="funeral">Funeral</option>
        <option value="youth">Youth</option>
        <option value="other">Other</option>
      </select>

      <div>
        <label className="text-xs text-ink/40">Starts</label>
        <input
          type="datetime-local"
          name="start_time"
          required
          className="w-full border border-ink/20 rounded-lg px-4 py-3"
        />
      </div>
      <div>
        <label className="text-xs text-ink/40">Ends (optional)</label>
        <input type="datetime-local" name="end_time" className="w-full border border-ink/20 rounded-lg px-4 py-3" />
      </div>

      {canPostChurchWide ? (
        <select name="department_id" className="w-full border border-ink/20 rounded-lg px-4 py-3">
          <option value="">Church-wide</option>
          {departments.map((d) => (
            <option key={d.id} value={d.id}>
              {d.name} only
            </option>
          ))}
        </select>
      ) : (
        <p className="text-sm text-ink/50">This event will be visible to your department only.</p>
      )}

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
      {pending ? "Creating..." : "Create event"}
    </button>
  );
}
