"use client";

import Link from "next/link";
import { useFormState } from "react-dom";
import { saveEvent } from "./actions";
import { PendingButton } from "@/components/ConfirmSubmitButton";
import { Alert } from "@/components/ui/Alert";
import { FormActions, FormField, RequiredNote } from "@/components/ui/FormField";
import { EVENT_CATEGORIES, EVENT_CATEGORY_LABELS } from "@/lib/events";

export interface EventValues {
  id: string;
  updated_at: string;
  title: string;
  description: string | null;
  location: string | null;
  category: string;
  start_local: string;
  end_local: string;
  department_id: string | null;
}

export function EventForm({
  departments,
  canPostChurchWide,
  event,
  timezoneLabel,
}: {
  departments: { id: string; name: string }[];
  canPostChurchWide: boolean;
  event?: EventValues;
  timezoneLabel: string;
}) {
  const [state, formAction] = useFormState(saveEvent, null);
  const fe = state?.fieldErrors ?? {};
  const v = (name: string, fallback: string | null | undefined) => state?.values?.[name] ?? fallback ?? "";
  const category = (EVENT_CATEGORIES as readonly string[]).includes(event?.category ?? "") ? event!.category : "service";

  return (
    <form key={JSON.stringify(state?.values ?? {})} action={formAction} className="card-elevated rounded-2xl p-5 sm:p-6 space-y-5 max-w-2xl" noValidate>
      {event && (
        <>
          <input type="hidden" name="event_id" value={event.id} />
          <input type="hidden" name="updated_at" value={event.updated_at} />
        </>
      )}
      {state?.error && <Alert tone="error">{state.error}</Alert>}
      <RequiredNote />

      <FormField label="Event title" htmlFor="title" required error={fe.title}>
        <input id="title" name="title" required maxLength={150} defaultValue={v("title", event?.title)} className="input" aria-invalid={Boolean(fe.title)} />
      </FormField>

      <div className="grid gap-5 sm:grid-cols-2">
        <FormField label="Starts" htmlFor="start_time" required error={fe.start_time} hint={timezoneLabel}>
          <input id="start_time" name="start_time" type="datetime-local" required defaultValue={v("start_time", event?.start_local)} className="input" aria-invalid={Boolean(fe.start_time)} />
        </FormField>
        <FormField label="Ends" htmlFor="end_time" optional error={fe.end_time}>
          <input id="end_time" name="end_time" type="datetime-local" defaultValue={v("end_time", event?.end_local)} className="input" aria-invalid={Boolean(fe.end_time)} />
        </FormField>
      </div>

      <div className="grid gap-5 sm:grid-cols-2">
        <FormField label="Location" htmlFor="location" optional error={fe.location}>
          <input id="location" name="location" maxLength={200} placeholder="e.g. Main hall" defaultValue={v("location", event?.location)} className="input" />
        </FormField>
        <FormField label="Type" htmlFor="category" required error={fe.category}>
          <select id="category" name="category" defaultValue={v("category", category)} className="input">
            {EVENT_CATEGORIES.map((c) => (
              <option key={c} value={c}>
                {EVENT_CATEGORY_LABELS[c]}
              </option>
            ))}
          </select>
        </FormField>
      </div>

      <FormField label="Description" htmlFor="description" optional error={fe.description}>
        <textarea id="description" name="description" rows={4} maxLength={5000} defaultValue={v("description", event?.description)} className="input" />
      </FormField>

      {canPostChurchWide ? (
        <FormField label="Who is it for?" htmlFor="department_id">
          <select id="department_id" name="department_id" defaultValue={v("department_id", event?.department_id)} className="input">
            <option value="">Everyone in the church</option>
            {departments.map((d) => (
              <option key={d.id} value={d.id}>
                {d.name} department only
              </option>
            ))}
          </select>
        </FormField>
      ) : (
        <Alert tone="info">This event will be visible to your department only.</Alert>
      )}

      <FormActions>
        <PendingButton pendingLabel="Saving…">{event ? "Save changes" : "Create event"}</PendingButton>
        <Link href={event ? `/dashboard/calendar/${event.id}` : "/dashboard/calendar"} className="btn-secondary">
          Cancel
        </Link>
      </FormActions>
    </form>
  );
}
