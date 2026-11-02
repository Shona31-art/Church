"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { Phone, Video } from "lucide-react";
import { callAction, CONNECTION_FAILED } from "@/lib/call-action";
import { showToast } from "@/components/ui/Toaster";
import { UNANSWERED_MS, isLiveCall } from "@/lib/video-call-rules";
import { startBookingCall, startChatCall } from "@/app/dashboard/calls/actions";

/**
 * Voice call and Video call buttons (or "Join" while a call is running) for a
 * chat or an approved appointment. Starts or joins the call and goes straight
 * into the call screen. `compact`: round icons for a chat's top bar, like
 * WhatsApp. Two-person calls nobody answered stop showing "Join" after a minute.
 */
export function StartCallButton({
  place,
  activeCallId: initialActive,
  startedAt: initialStartedAt = null,
  oneToOne = false,
  compact = false,
  className = "",
}: {
  place: { channelId: string } | { bookingId: string };
  activeCallId: string | null;
  /** For an unanswered two-person call: when it started (it lapses after a minute). */
  startedAt?: string | null;
  oneToOne?: boolean;
  compact?: boolean;
  className?: string;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState<"voice" | "video" | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [active, setActive] = useState<{ id: string; startedAt: string | null } | null>(initialActive ? { id: initialActive, startedAt: initialStartedAt } : null);
  const [column, value] = "channelId" in place ? ["channel_id", place.channelId] : ["booking_id", place.bookingId];

  // Live: someone starts, answers or ends a call here → the buttons change without a refresh.
  useEffect(() => {
    setActive(initialActive ? { id: initialActive, startedAt: initialStartedAt } : null);
    const supabase = createClient();
    const channel = supabase
      .channel(`video-calls:${column}:${value}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "video_calls", filter: `${column}=eq.${value}` }, ({ new: row }) => {
        const call = row as { id?: string; ended_at: string | null; expires_at: string; started_at?: string; connected_at?: string | null };
        if (!call?.id) return;
        const live = isLiveCall(call, oneToOne);
        setActive((current) => (live ? { id: call.id!, startedAt: oneToOne && !call.connected_at ? call.started_at ?? null : null } : current?.id === call.id ? null : current));
      })
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [column, value, initialActive, initialStartedAt, oneToOne]);

  // An unanswered two-person call lapses after a minute.
  useEffect(() => {
    if (!active?.startedAt) return;
    const left = new Date(active.startedAt).getTime() + UNANSWERED_MS - Date.now();
    const t = setTimeout(() => setActive(null), Math.max(0, left));
    return () => clearTimeout(t);
  }, [active]);

  async function go(kind: "voice" | "video") {
    setBusy(kind);
    setError(null);
    const audioOnly = kind === "voice";
    const r = await callAction(() => ("channelId" in place ? startChatCall(place.channelId, audioOnly) : startBookingCall(place.bookingId, audioOnly)), { error: CONNECTION_FAILED });
    if ("error" in r) {
      setBusy(null);
      if (compact) showToast(r.error, "error");
      return setError(r.error);
    }
    // ?go=1: this tap counts as starting/answering — straight into the call.
    router.push(`/dashboard/calls/${r.callId}?go=1`);
  }

  if (compact) {
    return (
      <span className={`flex items-center gap-1.5 ${className}`}>
        {active ? (
          <button type="button" onClick={() => go("video")} disabled={busy !== null} className="flex h-11 items-center gap-1.5 rounded-full bg-green-600 px-4 text-sm font-semibold text-white motion-safe:animate-pulse">
            <Phone aria-hidden className="h-4 w-4" /> {busy ? "…" : "Join"}
          </button>
        ) : (
          <>
            <button type="button" onClick={() => go("voice")} disabled={busy !== null} className="btn-secondary btn-icon h-11 w-11 rounded-full" aria-label="Voice call" title="Voice call">
              <Phone aria-hidden className={`h-4 w-4 ${busy === "voice" ? "animate-pulse" : ""}`} />
            </button>
            <button type="button" onClick={() => go("video")} disabled={busy !== null} className="btn-secondary btn-icon h-11 w-11 rounded-full" aria-label="Video call" title="Video call">
              <Video aria-hidden className={`h-4 w-4 ${busy === "video" ? "animate-pulse" : ""}`} />
            </button>
          </>
        )}
      </span>
    );
  }

  return (
    <span className={`inline-flex flex-col items-start gap-1 ${className}`}>
      {active ? (
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
