"use client";

import { useFormState } from "react-dom";
import { liftChatRestriction, restrictMemberChat } from "../actions";
import { RESTRICTION_DURATIONS, RESTRICTION_KINDS, type RestrictionKind } from "@/lib/chat";
import { formatDateTime } from "@/lib/format";
import { Alert } from "@/components/ui/Alert";
import { FormField } from "@/components/ui/FormField";
import { ConfirmSubmitButton, PendingButton } from "@/components/ConfirmSubmitButton";
import { StatusBadge } from "@/components/ui/StatusBadge";

export interface ActiveRestriction {
  id: string;
  kind: RestrictionKind;
  until: string | null;
  reason: string;
  createdByName: string;
  createdAt: string;
}

/** Pastor/admin controls for a member's chat access (logged; the member sees the reason). */
export function ChatRestrictions({ memberId, memberName, active }: { memberId: string; memberName: string; active: ActiveRestriction[] }) {
  const [state, action] = useFormState(restrictMemberChat, null);
  const fe = state?.fieldErrors ?? {};

  return (
    <div className="space-y-5">
      {active.length === 0 ? (
        <p className="text-sm text-ink/60">No restrictions — {memberName} can use chat normally.</p>
      ) : (
        <ul className="space-y-2">
          {active.map((r) => (
            <li key={r.id} className="flex flex-wrap items-start justify-between gap-3 rounded-xl border border-warning-line bg-warning-tint/50 p-3">
              <div className="min-w-0 text-sm">
                <StatusBadge tone="warning">{RESTRICTION_KINDS[r.kind]}</StatusBadge>
                <p className="mt-1.5">{r.reason}</p>
                <p className="mt-1 text-xs text-ink/60">
                  {r.until ? `Until ${formatDateTime(r.until)}` : "Until lifted"} · set by {r.createdByName}, {formatDateTime(r.createdAt)}
                </p>
              </div>
              <LiftButton restrictionId={r.id} memberId={memberId} />
            </li>
          ))}
        </ul>
      )}

      <form action={action} className="space-y-4 rounded-xl border border-line p-4" noValidate>
        <p className="text-sm font-semibold">Add a restriction</p>
        {state?.error && <Alert tone="error">{state.error}</Alert>}
        <input type="hidden" name="member_id" value={memberId} />
        <div className="grid gap-4 sm:grid-cols-2">
          <FormField label="Restriction" htmlFor="kind" required>
            <select id="kind" name="kind" className="input" defaultValue="group_mute">
              {(Object.keys(RESTRICTION_KINDS) as RestrictionKind[]).map((k) => (
                <option key={k} value={k}>
                  {RESTRICTION_KINDS[k]}
                </option>
              ))}
            </select>
          </FormField>
          <FormField label="For" htmlFor="duration" required>
            <select id="duration" name="duration" className="input" defaultValue="7d">
              {RESTRICTION_DURATIONS.map((d) => (
                <option key={d.value} value={d.value}>
                  {d.label}
                </option>
              ))}
            </select>
          </FormField>
        </div>
        <FormField label="Reason" htmlFor="reason" required error={fe.reason} hint={`${memberName} will see this reason. Private messages are never affected by a group-chat restriction.`}>
          <textarea id="reason" name="reason" rows={2} maxLength={500} className="input" aria-invalid={Boolean(fe.reason)} defaultValue={state?.values?.reason} />
        </FormField>
        <PendingButton className="btn-secondary" pendingLabel="Saving…">
          Restrict
        </PendingButton>
      </form>
    </div>
  );
}

function LiftButton({ restrictionId, memberId }: { restrictionId: string; memberId: string }) {
  const [state, action] = useFormState(liftChatRestriction, null);
  return (
    <form action={action}>
      <input type="hidden" name="restriction_id" value={restrictionId} />
      <input type="hidden" name="member_id" value={memberId} />
      <ConfirmSubmitButton title="Lift this restriction?" message="It ends now. This is recorded in the activity log." confirmLabel="Lift restriction" tone="primary" className="btn-secondary btn-sm" pendingLabel="Lifting…">
        Lift
      </ConfirmSubmitButton>
      {state?.error && <p className="mt-1 text-xs text-danger">{state.error}</p>}
    </form>
  );
}
