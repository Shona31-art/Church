"use client";

import { useState } from "react";
import { useFormState } from "react-dom";
import { Award } from "lucide-react";
import { createCertificate } from "./actions";
import { PendingButton } from "@/components/ConfirmSubmitButton";
import { Alert } from "@/components/ui/Alert";
import { FormActions, FormField } from "@/components/ui/FormField";
import { CERTIFICATE_INFO, CERTIFICATE_KINDS, type CertificateKind } from "@/lib/certificates";

export function CertificateForm({ people, today, officiant }: { people: { id: string; name: string }[]; today: string; officiant: string }) {
  const [open, setOpen] = useState(false);
  const [state, action] = useFormState(createCertificate, null);
  const [kind, setKind] = useState<CertificateKind>("baptism");
  const [name, setName] = useState("");
  const fe = state?.fieldErrors ?? {};
  const v = state?.values;
  if (!open)
    return (
      <button type="button" className="btn-primary" onClick={() => setOpen(true)}>
        <Award aria-hidden className="h-4 w-4" /> New certificate
      </button>
    );
  return (
    <form action={action} className="card-elevated space-y-4 rounded-2xl p-5" noValidate>
      {state?.error && <Alert tone="error">{state.error}</Alert>}
      <FormField label="Certificate" htmlFor="kind">
        <select id="kind" name="kind" value={kind} onChange={(e) => setKind(e.target.value as CertificateKind)} className="input">
          {CERTIFICATE_KINDS.map((k) => (
            <option key={k} value={k}>
              {CERTIFICATE_INFO[k].label}
            </option>
          ))}
        </select>
      </FormField>
      <div className="grid gap-4 sm:grid-cols-2">
        <FormField label="Member" htmlFor="member_id" optional hint="They can then see and print it themselves.">
          <select
            id="member_id"
            name="member_id"
            className="input"
            defaultValue={v?.member_id ?? ""}
            onChange={(e) => {
              const p = people.find((x) => x.id === e.target.value);
              if (p && !name) setName(p.name);
            }}
          >
            <option value="">Not in the app / a child</option>
            {people.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
        </FormField>
        <FormField label="Name on the certificate" htmlFor="recipient_name" required error={fe.recipient_name}>
          <input id="recipient_name" name="recipient_name" required maxLength={120} value={name || v?.recipient_name || ""} onChange={(e) => setName(e.target.value)} className="input" placeholder="Full name" />
        </FormField>
        {kind === "course" && (
          <FormField label="Course" htmlFor="course_name" required error={fe.course_name}>
            <input id="course_name" name="course_name" maxLength={120} defaultValue={v?.course_name} className="input" placeholder="e.g. Foundations of Faith" />
          </FormField>
        )}
        {kind === "dedication" && (
          <FormField label="Parents" htmlFor="parents" optional>
            <input id="parents" name="parents" maxLength={160} defaultValue={v?.parents} className="input" placeholder="e.g. Thabo and Lerato Mokoena" />
          </FormField>
        )}
        <FormField label="Date" htmlFor="issued_on" required error={fe.issued_on}>
          <input id="issued_on" name="issued_on" type="date" required defaultValue={v?.issued_on ?? today} className="input" />
        </FormField>
        <FormField label="Signed by" htmlFor="officiant" optional>
          <input id="officiant" name="officiant" maxLength={120} defaultValue={v?.officiant ?? officiant} className="input" />
        </FormField>
        <FormField label="Place" htmlFor="place" optional>
          <input id="place" name="place" maxLength={120} defaultValue={v?.place} className="input" placeholder="e.g. Durban" />
        </FormField>
      </div>
      <FormField label="Scripture" htmlFor="scripture" optional hint="Leave blank for the usual verse.">
        <input id="scripture" name="scripture" maxLength={300} defaultValue={v?.scripture} className="input" placeholder={CERTIFICATE_INFO[kind].scripture} />
      </FormField>
      <FormActions>
        <PendingButton pendingLabel="Creating…">Create certificate</PendingButton>
        <button type="button" className="btn-ghost" onClick={() => setOpen(false)}>
          Cancel
        </button>
      </FormActions>
    </form>
  );
}
