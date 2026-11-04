"use client";

import { usePathname, useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { Phone, PhoneOff, Video } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { startRinging } from "@/lib/call-sounds";
import { graceAndroid } from "@/lib/android";
import { Avatar } from "@/components/ui/Avatar";
import { callAction, CONNECTION_FAILED } from "@/lib/call-action";
import { endCall } from "@/app/dashboard/calls/actions";

/** How long an incoming call rings before it gives up (it stays in the bell). */
const RING_SECONDS = 45;

interface Incoming {
  notificationId: string;
  callId: string;
  link: string;
  title: string;
  voice: boolean;
}

const CALL_LINK = /^\/dashboard\/calls\/([0-9a-f-]{36})$/;

/**
 * Rings when someone calls you (supabase/video_calls.sql creates a
 * "video_call" notification for each person a call rings). Shown on every
 * dashboard page; stops when you answer, decline, the caller ends the call,
 * or after 45 seconds. Phones with the app closed get the pop-up instead (sw.js).
 */
export function IncomingCall({ userId }: { userId: string }) {
  const router = useRouter();
  const pathname = usePathname();
  const [incoming, setIncoming] = useState<Incoming | null>(null);
  const pathRef = useRef(pathname);
  pathRef.current = pathname;

  const offer = useCallback((row: { id: string; type: string; link: string | null; title: string; body?: string | null; created_at: string; read_at: string | null }) => {
    const match = row.link ? CALL_LINK.exec(row.link) : null;
    if (row.type !== "video_call" || !match || row.read_at) return;
    if (Date.now() - new Date(row.created_at).getTime() > RING_SECONDS * 1000) return;
    if (pathRef.current === row.link) return; // already in that call
    setIncoming({ notificationId: row.id, callId: match[1], link: row.link!, title: row.title, voice: Boolean(row.body?.startsWith("Voice")) });
  }, []);

  // New calls as they come in, plus a check when the app opens or comes back
  // to the front (a phone that slept can miss live updates).
  useEffect(() => {
    const supabase = createClient();
    const check = async () => {
      const since = new Date(Date.now() - RING_SECONDS * 1000).toISOString();
      const { data } = await supabase
        .from("notifications")
        .select("id, type, link, title, body, created_at, read_at")
        .eq("user_id", userId)
        .eq("type", "video_call")
        .is("read_at", null)
        .gt("created_at", since)
        .order("created_at", { ascending: false })
        .limit(1);
      if (data?.[0]) offer(data[0]);
    };
    const channel = supabase
      .channel(`incoming-calls:${userId}`)
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "notifications", filter: `user_id=eq.${userId}` }, ({ new: row }) => offer(row as any))
      .subscribe();
    check();
    const onVisible = () => document.visibilityState === "visible" && check();
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      supabase.removeChannel(channel);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [userId, offer]);

  if (!incoming) return null;
  return (
    <RingingCard
      key={incoming.notificationId}
      incoming={incoming}
      onAnswer={() => {
        markRead(incoming.notificationId);
        setIncoming(null);
        // ?go=1: tapping Accept counts as answering — straight into the call.
        router.push(`${incoming.link}?go=1`);
      }}
      onDecline={() => {
        markRead(incoming.notificationId);
        setIncoming(null);
        callAction(() => endCall(incoming.callId, "declined"), { error: CONNECTION_FAILED });
      }}
      onDismiss={(read) => {
        if (read) markRead(incoming.notificationId);
        setIncoming(null);
      }}
    />
  );
}

function markRead(id: string) {
  createClient()
    .rpc("mark_notifications_read", { target_ids: [id] })
    .then(({ error }) => error && console.error("[calls] marking the call notification read failed:", error.message));
}

function RingingCard({ incoming, onAnswer, onDecline, onDismiss }: { incoming: Incoming; onAnswer: () => void; onDecline: () => void; onDismiss: (read: boolean) => void }) {
  const [ended, setEnded] = useState(false);
  const answerRef = useRef<HTMLButtonElement>(null);
  // The parent re-renders with new handlers; keep the ring timer steady.
  const dismissRef = useRef(onDismiss);
  dismissRef.current = onDismiss;

  // Ring and vibrate until answered, declined, ended, or timed out.
  // In the Android app with Grace in the background, the phone itself rings
  // (full screen), so the page stays quiet until Grace is back on screen.
  useEffect(() => {
    if (ended) return;
    let stopRing: (() => void) | null = null;
    const update = () => {
      const quiet = graceAndroid() !== null && document.visibilityState === "hidden";
      if (quiet && stopRing) {
        stopRing();
        stopRing = null;
      } else if (!quiet && !stopRing) stopRing = startRinging();
    };
    update();
    document.addEventListener("visibilitychange", update);
    const timeout = setTimeout(() => dismissRef.current(false), RING_SECONDS * 1000);
    answerRef.current?.focus();
    return () => {
      document.removeEventListener("visibilitychange", update);
      stopRing?.();
      clearTimeout(timeout);
    };
  }, [ended]);

  // The caller hung up (or the call ended): stop ringing and say so briefly.
  useEffect(() => {
    const supabase = createClient();
    const channel = supabase
      .channel(`call-status:${incoming.callId}`)
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "video_calls", filter: `id=eq.${incoming.callId}` }, ({ new: row }) => {
        if ((row as { ended_at: string | null }).ended_at) setEnded(true);
      })
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [incoming.callId]);

  useEffect(() => {
    if (!ended) return;
    const t = setTimeout(() => dismissRef.current(true), 4000);
    return () => clearTimeout(t);
  }, [ended]);

  const caller = incoming.title.replace(/ is calling you$/, "");
  // Full screen, like WhatsApp: who's calling, and big Decline / Accept buttons.
  return (
    <div role="alertdialog" aria-modal="true" aria-labelledby="incoming-call-title" className="fixed inset-0 z-[100] flex flex-col items-center justify-between bg-gradient-to-b from-[#2a0f33] via-[#3b1546] to-[#0d3a40] px-6 py-[max(3rem,env(safe-area-inset-top))] text-white motion-safe:animate-modal-in">
      <div className="text-center">
        <p className="text-sm text-white/70">{ended ? "Call ended" : incoming.voice ? "Incoming voice call" : "Incoming video call"}</p>
        <h2 id="incoming-call-title" className="mt-2 text-3xl font-semibold">
          {caller}
        </h2>
      </div>
      <span className={ended ? "" : "motion-safe:animate-pulse"}>
        <span className="block scale-[2.4]">
          <Avatar name={caller} size="lg" />
        </span>
      </span>
      {!ended ? (
        <div className="flex w-full max-w-xs items-center justify-between pb-[env(safe-area-inset-bottom)]">
          <span className="flex flex-col items-center gap-2">
            <button type="button" onClick={onDecline} aria-label="Decline" className="flex h-16 w-16 items-center justify-center rounded-full bg-red-600 active:scale-95">
              <PhoneOff aria-hidden className="h-7 w-7" />
            </button>
            <span aria-hidden className="text-xs text-white/80">Decline</span>
          </span>
          <span className="flex flex-col items-center gap-2">
            <button ref={answerRef} type="button" onClick={onAnswer} aria-label="Accept" className="flex h-16 w-16 items-center justify-center rounded-full bg-green-600 active:scale-95 motion-safe:animate-bounce">
              {incoming.voice ? <Phone aria-hidden className="h-7 w-7" /> : <Video aria-hidden className="h-7 w-7" />}
            </button>
            <span aria-hidden className="text-xs text-white/80">Accept</span>
          </span>
        </div>
      ) : (
        <button type="button" className="rounded-full bg-white/15 px-6 py-3 text-sm font-semibold" onClick={() => onDismiss(true)}>
          Close
        </button>
      )}
    </div>
  );
}
