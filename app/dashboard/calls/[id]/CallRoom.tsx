"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { PhoneOff } from "lucide-react";
import { callAction, CONNECTION_FAILED } from "@/lib/call-action";
import { useConfirm } from "@/components/ui/ConfirmDialog";
import { endCall } from "../actions";

/**
 * The call itself: Daily's ready-made call screen (camera check, mute,
 * camera on/off, screen share, chat) in a frame, plus our own way out.
 */
export function CallRoom({ callId, src, back, canEndForAll, audioOnly = false }: { callId: string; src: string; back: { href: string; label: string }; canEndForAll: boolean; audioOnly?: boolean }) {
  const router = useRouter();
  const [ending, setEnding] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirm, confirmDialog] = useConfirm();

  async function endForAll() {
    if (!(await confirm({ title: "End the call for everyone?", message: "Anyone still in the call will be removed.", confirmLabel: "End call", tone: "danger" }))) return;
    setEnding(true);
    const r = await callAction(() => endCall(callId), { error: CONNECTION_FAILED });
    setEnding(false);
    if (r.error) return setError(r.error);
    router.push(back.href);
    router.refresh();
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <button type="button" className="btn-secondary" onClick={() => router.push(back.href)}>
          ‹ Leave the call
        </button>
        {canEndForAll && (
          <button type="button" className="btn-danger-outline" onClick={endForAll} disabled={ending}>
            <PhoneOff aria-hidden className="h-4 w-4" /> {ending ? "Ending…" : "End for everyone"}
          </button>
        )}
      </div>
      {error && (
        <p role="alert" className="text-sm text-danger">
          {error}
        </p>
      )}
      <div className="overflow-hidden rounded-2xl border border-line bg-ink" style={{ height: "min(78vh, 52rem)" }}>
        <iframe
          src={src}
          title={audioOnly ? "Voice call" : "Video call"}
          className="h-full w-full"
          allow="camera; microphone; fullscreen; display-capture; autoplay; speaker-selection; clipboard-write"
          allowFullScreen
        />
      </div>
      <p className="text-xs text-ink/60">
        {audioOnly ? "A voice call: cameras start off (you can turn yours on). Your browser will ask to use your microphone — choose Allow." : "Your browser will ask to use your camera and microphone — choose Allow."} Calls end on their own after three hours. Calls aren&apos;t recorded.
      </p>
      {confirmDialog}
    </div>
  );
}
