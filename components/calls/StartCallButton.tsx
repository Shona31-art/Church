"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { Phone, Video } from "lucide-react";
import { callAction, CONNECTION_FAILED } from "@/lib/call-action";
import { startBookingCall, startChatCall } from "@/app/dashboard/calls/actions";

/**
 * "Voice call" and "Video call" (or one "Join call" while a call is running)
 * for a chat or an approved appointment. Starts or joins the call, then opens
 * the call page. A voice call is the same call with cameras starting off.
 */
export function StartCallButton({ place, activeCallId: initialActive, className = "" }: { place: { channelId: string } | { bookingId: string }; activeCallId: string | null; className?: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState<"voice" | "video" | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [activeCallId, setActiveCallId] = useState(initialActive);
  const [column, value] = "channelId" in place ? ["channel_id", place.channelId] : ["booking_id", place.bookingId];

  // Live: someone starts or ends a call here → the button changes without a refresh.
  useEffect(() => {
    setActiveCallId(initialActive);
    const supabase = createClient();
    const channel = supabase
      .channel(`video-calls:${column}:${value}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "video_calls", filter: `${column}=eq.${value}` }, ({ new: row }) => {
        const call = row as { id?: string; ended_at?: string | null; expires_at?: string };
        if (!call?.id) return;
        const open = !call.ended_at && (!call.expires_at || new Date(call.expires_at).getTime() > Date.now());
        setActiveCallId((current) => (open ? call.id! : current === call.id ? null : current));
      })
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [column, value, initialActive]);

  async function go(kind: "voice" | "video") {
    setBusy(kind);
    setError(null);
    const audioOnly = kind === "voice";
    const r = await callAction(() => ("channelId" in place ? startChatCall(place.channelId, audioOnly) : startBookingCall(place.bookingId, audioOnly)), { error: CONNECTION_FAILED });
    if ("error" in r) {
      setBusy(null);
      return setError(r.error);
    }
    router.push(`/dashboard/calls/${r.callId}`);
  }

  return (
    <span className={`inline-flex flex-col items-start gap-1 ${className}`}>
      {activeCallId ? (
        <button type="button" onClick={() => go("video")} disabled={busy !== null} className="btn-primary">
          <Video aria-hidden className="h-4 w-4 motion-safe:animate-pulse" />
          {busy ? "Connecting…" : "Join call"}
        </button>
      ) : (
        <span className="flex flex-wrap gap-2">
          <button type="button" onClick={() => go("voice")} disabled={busy !== null} className="btn-secondary" aria-label="Start a voice call">
            <Phone aria-hidden className="h-4 w-4" />
            {busy === "voice" ? "Connecting…" : "Voice call"}
          </button>
          <button type="button" onClick={() => go("video")} disabled={busy !== null} className="btn-secondary" aria-label="Start a video call">
            <Video aria-hidden className="h-4 w-4" />
            {busy === "video" ? "Connecting…" : "Video call"}
          </button>
        </span>
      )}
      {error && (
        <span role="alert" className="text-xs text-danger">
          {error}
        </span>
      )}
    </span>
  );
}
