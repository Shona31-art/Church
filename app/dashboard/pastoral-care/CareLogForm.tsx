"use client";

import { useState } from "react";
import Link from "next/link";
import { useFormState } from "react-dom";
import { saveCareLog } from "./actions";
import { LOG_TYPES, LOG_TYPE_LABELS } from "@/lib/pastoral-care";
import { PendingButton } from "@/components/ConfirmSubmitButton";
import { Alert } from "@/components/ui/Alert";
import { FormActions, FormField, RequiredNote } from "@/components/ui/FormField";
import { PersonPicker } from "@/components/ui/PersonPicker";

export interface CareLogValues {
  id: string;
  updated_at: string;
  member_id: string | null;
  member_name: string;
  log_type: string;
  notes: string;
  location: string | null;
  follow_up_date: string | null;
}

export function CareLogForm({
  members,
  defaultMemberId,
  defaultType,
  log,
}: {
  members: { id: string; name: string }[];
  defaultMemberId?: string;
  defaultType?: string;
  log?: CareLogValues;
}) {
  const [state, formAction] = useFormState(saveCareLog, null);
  const fe = state?.fieldErrors ?? {};
  const v = (name: string, fallback: string | null | undefined) => state?.values?.[name] ?? fallback ?? "";
  const [memberId, setMemberId] = useState(v("member_id", log ? log.member_id : defaultMemberId));

  return (
    <form key={JSON.stringify(state?.values ?? {})} action={formAction} className="card-elevated rounded-2xl p-5 sm:p-6 space-y-5 max-w-2xl" noValidate>
      {log && (
        <>
          <input type="hidden" name="log_id" value={log.id} />
          <input type="hidden" name="updated_at" value={log.updated_at} />
        </>
      )}
      {state?.error && <Alert tone="error">{state.error}</Alert>}
      <RequiredNote />

      <FormField label="Who" htmlFor="member_id" error={fe.member_id}>
        <PersonPicker
          id="member_id"
          name="member_id"
          title="Who is this about?"
          value={memberId}
          onChange={(v) => setMemberId(v)}
          options={[{ value: "", label: "Someone not in the app (type their name below)" }, ...members.map((m) => ({ value: m.id, label: m.name }))]}
        />
      </FormField>

      {!memberId && (
        <FormField label="Person's name" htmlFor="member_name" required error={fe.member_name}>
          <input id="member_name" name="member_name" maxLength={120} required defaultValue={v("member_name", log?.member_id ? "" : log?.member_name)} className="input" aria-invalid={Boolean(fe.member_name)} />
        </FormField>
      )}

      <FormField label="Type of care" htmlFor="log_type" required error={fe.log_type}>
        <select id="log_type" name="log_type" defaultValue={v("log_type", log?.log_type ?? defaultType ?? "counseling")} className="input">
          {LOG_TYPES.map((t) => (
            <option key={t} value={t}>
              {LOG_TYPE_LABELS[t]}
            </option>
          ))}
        </select>
      </FormField>

      <FormField label="Notes" htmlFor="notes" required error={fe.notes} hint="Record only what's needed for ongoing care. Visible to pastors and church admins only.">
        <textarea id="notes" name="notes" required rows={6} maxLength={10000} defaultValue={v("notes", log?.notes)} className="input" aria-invalid={Boolean(fe.notes)} />
      </FormField>

      <div className="grid gap-5 sm:grid-cols-2">
        <FormField label="Location" htmlFor="location" optional>
          <input id="location" name="location" maxLength={200} defaultValue={v("location", log?.location)} className="input" />
        </FormField>
        <FormField label="Follow up by" htmlFor="follow_up_date" optional error={fe.follow_up_date}>
          <input id="follow_up_date" name="follow_up_date" type="date" defaultValue={v("follow_up_date", log?.follow_up_date)} className="input" />
        </FormField>
      </div>

      <FormActions>
        <PendingButton>{log ? "Save changes" : "Save record"}</PendingButton>
        <Link href="/dashboard/pastoral-care" className="btn-secondary">
          Cancel
        </Link>
      </FormActions>
    </form>
  );
}
