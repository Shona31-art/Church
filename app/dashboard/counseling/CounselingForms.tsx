"use client";

import { useEffect, useRef } from "react";
import { useFormState } from "react-dom";
import { acknowledgeEscalation, saveCounselingSettings, sendCounselingMessage, setShareWithPastor } from "./actions";
import { ConfirmSubmitButton, PendingButton } from "@/components/ConfirmSubmitButton";
import { Alert } from "@/components/ui/Alert";
import { FormField } from "@/components/ui/FormField";

export function MessageComposer({ conversationId }: { conversationId: string }) {
  const [state, action] = useFormState(sendCounselingMessage, null);
  const ref = useRef<HTMLFormElement>(null);
  useEffect(() => {
    if (state?.ok) ref.current?.reset();
  }, [state]);
  return (
    <form ref={ref} action={action} className="space-y-2">
      <input type="hidden" name="conversation_id" value={conversationId} />
      {state?.error && <Alert tone="error">{state.error}</Alert>}
      <label htmlFor="content" className="sr-only">
        Your message
      </label>
      <div className="flex gap-2 items-end">
        <textarea id="content" name="content" required rows={2} maxLength={4000} placeholder="Share what's on your mind…" defaultValue={state?.values?.content} className="input flex-1" />
        <PendingButton pendingLabel="Sending…">Send</PendingButton>
      </div>
    </form>
  );
}

export function ShareToggle({ conversationId, shared }: { conversationId: string; shared: boolean }) {
  const [state, action] = useFormState(setShareWithPastor, null);
  return (
    <form action={action}>
      <input type="hidden" name="conversation_id" value={conversationId} />
      <input type="hidden" name="share" value={shared ? "false" : "true"} />
      {shared ? (
        <PendingButton className="btn-secondary btn-sm">Stop sharing with pastors</PendingButton>
      ) : (
        <ConfirmSubmitButton
          title="Share this conversation with your pastors?"
          message="Your church's pastors and church admins will be able to read this whole conversation, so they can follow up with you. You can stop sharing at any time."
          confirmLabel="Share with pastors"
          tone="primary"
          className="btn-secondary btn-sm"
        >
          Share with a pastor
        </ConfirmSubmitButton>
      )}
      {state?.error && <p role="alert" className="text-xs text-danger mt-1">{state.error}</p>}
    </form>
  );
}

export function AcknowledgeForm({ conversationId }: { conversationId: string }) {
  const [state, action] = useFormState(acknowledgeEscalation, null);
  return (
    <form action={action} className="space-y-3">
      <input type="hidden" name="conversation_id" value={conversationId} />
      <FormField label="Private follow-up notes" htmlFor="outcome_notes" optional hint="Seen only by pastors and admins — never by the member.">
        <textarea id="outcome_notes" name="outcome_notes" rows={3} maxLength={2000} className="input" />
      </FormField>
      {state?.error && <Alert tone="error">{state.error}</Alert>}
      <PendingButton pendingLabel="Saving…">I&apos;ve followed up</PendingButton>
    </form>
  );
}

export function SettingsForm({
  enabled,
  stance,
  escalationPastorId,
  pastors,
}: {
  enabled: boolean;
  stance: string;
  escalationPastorId: string;
  pastors: { id: string; name: string }[];
}) {
  const [state, action] = useFormState(saveCounselingSettings, null);
  return (
    <form action={action} className="card-elevated rounded-2xl p-5 sm:p-6 space-y-5 max-w-2xl">
      {state?.error && <Alert tone="error">{state.error}</Alert>}
      <label className="flex items-start gap-2 text-sm">
        <input type="checkbox" name="enabled" defaultChecked={enabled} className="mt-1 h-4 w-4" />
        <span>
          Turn on AI counseling for members
          <span className="block text-xs text-ink/60">Members get a private, scripture-based chat. Crisis language is never answered by AI — it shows helplines and alerts a pastor.</span>
        </span>
      </label>
      <FormField label="Theological guidance" htmlFor="theological_stance" optional hint="Shapes the tone of AI replies, e.g. “Reformed Baptist; emphasise grace”.">
        <textarea id="theological_stance" name="theological_stance" rows={3} maxLength={1000} defaultValue={stance} className="input" />
      </FormField>
      <FormField label="Who should be alerted if a crisis is detected?" htmlFor="escalation_pastor_id">
        <select id="escalation_pastor_id" name="escalation_pastor_id" defaultValue={escalationPastorId} className="input">
          <option value="">Every pastor and church admin</option>
          {pastors.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}
            </option>
          ))}
        </select>
      </FormField>
      <PendingButton>Save settings</PendingButton>
    </form>
  );
}
