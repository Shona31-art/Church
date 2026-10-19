"use client";

import { useState } from "react";
import { useFormState } from "react-dom";
import { updateChatPrivacy } from "./actions";
import { unblockMember } from "../chat/actions";
import { DM_PRIVACY_OPTIONS, type DmPrivacy } from "@/lib/chat";
import { Alert } from "@/components/ui/Alert";
import { PendingButton } from "@/components/ConfirmSubmitButton";
import { Avatar } from "@/components/ui/Avatar";
import { showToast } from "@/components/ui/Toaster";
import { callAction, CONNECTION_FAILED } from "@/lib/call-action";

/** Who can start a DM with me, read receipts, and the people I've blocked. */
export function ChatPrivacyForm({
  dmPrivacy,
  shareReadReceipts,
  blocked,
}: {
  dmPrivacy: DmPrivacy;
  shareReadReceipts: boolean;
  blocked: { id: string; name: string; photoUrl: string | null }[];
}) {
  const [state, action] = useFormState(updateChatPrivacy, null);
  const [blockedList, setBlockedList] = useState(blocked);

  async function unblock(person: { id: string; name: string }) {
    const result = await callAction(() => unblockMember(person.id), { error: CONNECTION_FAILED });
    if (result.error) return showToast(result.error, "error");
    setBlockedList((list) => list.filter((p) => p.id !== person.id));
    showToast(`${person.name} is unblocked.`);
  }

  return (
    <div className="space-y-6">
      <form action={action} className="space-y-5" noValidate>
        {state?.error && <Alert tone="error">{state.error}</Alert>}
        <fieldset>
          <legend className="label">Who can start a private message with me</legend>
          <div className="mt-2 space-y-2">
            {(Object.keys(DM_PRIVACY_OPTIONS) as DmPrivacy[]).map((value) => (
              <label key={value} className="flex items-start gap-3 text-sm">
                <input type="radio" name="dm_privacy" value={value} defaultChecked={dmPrivacy === value} className="mt-0.5 accent-[rgb(var(--ember))]" />
                <span>{DM_PRIVACY_OPTIONS[value]}</span>
              </label>
            ))}
          </div>
          <p className="hint">Conversations you already have stay open. To stop someone completely, block them from your chat with them.</p>
        </fieldset>

        <label className="flex items-start gap-3 text-sm">
          <input type="checkbox" name="share_read_receipts" defaultChecked={shareReadReceipts} className="mt-0.5 accent-[rgb(var(--ember))]" />
          <span>
            <span className="font-medium">Read receipts</span>
            <span className="block text-xs text-ink/60">
              Show people when you&apos;ve read their messages (✓✓). If you turn this off, you won&apos;t see theirs either.
            </span>
          </span>
        </label>

        <PendingButton className="btn-secondary">Save chat privacy</PendingButton>
      </form>

      <div>
        <h3 className="label">Blocked people</h3>
        {blockedList.length === 0 ? (
          <p className="text-sm text-ink/60">You haven&apos;t blocked anyone.</p>
        ) : (
          <ul className="divide-y divide-line rounded-xl border border-line">
            {blockedList.map((p) => (
              <li key={p.id} className="flex items-center gap-3 px-3 py-2">
                <Avatar name={p.name} src={p.photoUrl} />
                <span className="flex-1 text-sm font-medium">{p.name}</span>
                <button type="button" className="btn-secondary btn-sm" onClick={() => unblock(p)}>
                  Unblock<span className="sr-only"> {p.name}</span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
