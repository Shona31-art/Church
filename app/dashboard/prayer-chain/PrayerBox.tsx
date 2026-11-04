"use client";

import { useEffect, useState } from "react";
import { useFormState } from "react-dom";
import { MessageSquareText } from "lucide-react";
import { savePrayerAudio, savePrayerText } from "./actions";
import { PendingButton } from "@/components/ConfirmSubmitButton";
import { Alert } from "@/components/ui/Alert";
import { createClient } from "@/lib/supabase/client";
import { VoiceRecorder } from "@/app/dashboard/chat/[id]/VoiceRecorder";

/** Your prayer for your slot: type it, or record it (the church can read or listen on this page). */
export function PrayerBox({ chainId, slotStart, churchId, userId, initialText, hasAudio }: { chainId: string; slotStart: string; churchId: string; userId: string; initialText: string | null; hasAudio: boolean }) {
  const [open, setOpen] = useState(false);
  const [state, action] = useFormState(savePrayerText, null);
  const [audioError, setAudioError] = useState<string | null>(null);
  const [recording, setRecording] = useState(false);
  useEffect(() => {
    if (state?.ok) setOpen(false);
  }, [state]);

  if (!open)
    return (
      <button type="button" className="btn-ghost btn-sm" onClick={() => setOpen(true)}>
        <MessageSquareText aria-hidden className="h-4 w-4" /> {initialText || hasAudio ? "Edit my prayer" : "Add my prayer"}
      </button>
    );

  return (
    <div className="mt-2 w-full space-y-3 rounded-xl border border-line bg-surface p-3">
      {!recording && (
        <form action={action} className="space-y-2">
          <input type="hidden" name="chain_id" value={chainId} />
          <input type="hidden" name="slot_start" value={slotStart} />
          {state?.error && <Alert tone="error">{state.error}</Alert>}
          <label htmlFor={`prayer-${slotStart}`} className="text-sm font-semibold">
            Type your prayer
          </label>
          <textarea id={`prayer-${slotStart}`} name="prayer_text" rows={4} maxLength={2000} defaultValue={initialText ?? ""} className="input" placeholder="Father, we pray for…" />
          <div className="flex flex-wrap gap-2">
            <PendingButton className="btn-primary btn-sm" pendingLabel="Saving…">Save prayer</PendingButton>
            <button type="button" className="btn-ghost btn-sm" onClick={() => setOpen(false)}>
              Close
            </button>
          </div>
        </form>
      )}
      <div className="space-y-1">
        {!recording && <p className="text-sm font-semibold">…or record it</p>}
        {audioError && <Alert tone="error">{audioError}</Alert>}
        <VoiceRecorder
          onActiveChange={setRecording}
          onSend={async (note) => {
            setAudioError(null);
            const path = `${churchId}/${chainId}/${userId}/${crypto.randomUUID()}.${note.extension}`;
            const { error } = await createClient().storage.from("prayer-audio").upload(path, note.blob, { contentType: note.blob.type || undefined });
            if (error) return /bucket/i.test(error.message) ? "Recorded prayers need database update #62." : "The recording didn't upload — check your connection and try again.";
            const problem = await savePrayerAudio({ chainId, slotStart, path, durationMs: Math.round(note.durationMs) });
            if (problem) return problem;
            setOpen(false);
            return null;
          }}
        />
      </div>
    </div>
  );
}
