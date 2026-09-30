"use client";

import { useState } from "react";
import Link from "next/link";
import { useFormState } from "react-dom";
import { createCareLog } from "../actions";
import { LOG_TYPES, LOG_TYPE_LABELS } from "@/lib/pastoral-care";
import { PendingButton } from "@/components/ConfirmSubmitButton";

export function CareLogForm({
  members,
  defaultMemberId,
  defaultType,
}: {
  members: { id: string; name: string }[];
  defaultMemberId?: string;
  defaultType?: string;
}) {
  const [state, formAction] = useFormState(createCareLog, null);
  const [memberId, setMemberId] = useState(defaultMemberId ?? "");

  return (
    <form action={formAction} className="max-w-lg space-y-4">
      <Link href="/dashboard/pastoral-care" className="text-sm text-ink/50 hover:text-ink">← Care log</Link>
      <h1 className="text-2xl font-semibold">Record pastoral care</h1>

      {state?.error && (
        <p role="alert" className="text-sm text-red-700 bg-red-50 border border-red-200 rounded-lg p-3">⚠ {state.error}</p>
      )}

      <div>
        <label htmlFor="member_id" className="block text-sm font-medium mb-1">Member</label>
        <select
          id="member_id"
          name="member_id"
          value={memberId}
          onChange={(e) => setMemberId(e.target.value)}
          className="w-full border border-ink/20 rounded-lg px-4 py-3"
        >
          <option value="">Someone not in the app (type their name below)</option>
          {members.map((m) => (
            <option key={m.id} value={m.id}>{m.name}</option>
          ))}
        </select>
      </div>

      {!memberId && (
        <div>
          <label htmlFor="member_name" className="block text-sm font-medium mb-1">Person&apos;s name</label>
          <input id="member_name" name="member_name" maxLength={120} required className="w-full border border-ink/20 rounded-lg px-4 py-3" />
        </div>
      )}

      <div>
        <label htmlFor="log_type" className="block text-sm font-medium mb-1">Type of care</label>
        <select id="log_type" name="log_type" defaultValue={defaultType ?? "counseling"} className="w-full border border-ink/20 rounded-lg px-4 py-3">
          {LOG_TYPES.map((t) => (
            <option key={t} value={t}>{LOG_TYPE_LABELS[t]}</option>
          ))}
        </select>
      </div>

      <div>
        <label htmlFor="notes" className="block text-sm font-medium mb-1">Notes</label>
        <textarea id="notes" name="notes" required rows={6} maxLength={10000} className="w-full border border-ink/20 rounded-lg px-4 py-3" />
        <p className="text-xs text-ink/40 mt-1">Record only what's needed for ongoing care. Visible to pastors and church admins only.</p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label htmlFor="location" className="block text-sm font-medium mb-1">Location <span className="text-ink/40 font-normal">(optional)</span></label>
          <input id="location" name="location" maxLength={200} className="w-full border border-ink/20 rounded-lg px-4 py-3" />
        </div>
        <div>
          <label htmlFor="follow_up_date" className="block text-sm font-medium mb-1">Follow up by <span className="text-ink/40 font-normal">(optional)</span></label>
          <input id="follow_up_date" name="follow_up_date" type="date" className="w-full border border-ink/20 rounded-lg px-4 py-3" />
        </div>
      </div>

      <PendingButton className="bg-ember text-white px-6 py-3 rounded-lg font-medium disabled:opacity-50">Save record</PendingButton>
    </form>
  );
}
