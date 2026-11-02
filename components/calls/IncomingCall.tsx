"use client";

import { usePathname, useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { Phone, PhoneOff, Video } from "lucide-react";
import { createClient } from "@/lib/supabase/client";

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
        router.push(incoming.link);
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

function RingingCard({ incoming, onAnswer, onDismiss }: { incoming: Incoming; onAnswer: () => void; onDismiss: (read: boolean) => void }) {
  const [ended, setEnded] = useState(false);
  const answerRef = useRef<HTMLButtonElement>(null);
  // The parent re-renders with new handlers; keep the ring timer steady.
  const dismissRef = useRef(onDismiss);
  dismissRef.current = onDismiss;

  // Ring and vibrate until answered, declined, ended, or timed out.
  useEffect(() => {
    if (ended) return;
    const stopRing = startRinging();
    const timeout = setTimeout(() => dismissRef.current(false), RING_SECONDS * 1000);
    answerRef.current?.focus();
    return () => {
      stopRing();
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

  return (
    <div
      role="alertdialog"
      aria-modal="false"
      aria-labelledby="incoming-call-title"
      className="fixed inset-x-3 top-3 z-[100] mx-auto max-w-sm rounded-2xl border border-line bg-surface p-4 shadow-pop motion-safe:animate-modal-in sm:inset-x-auto sm:right-4"
    >
      <div className="flex items-center gap-3">
        <span aria-hidden className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-success-tint text-success ${ended ? "" : "motion-safe:animate-pulse"}`}>
          {incoming.voice ? <Phone className="h-5 w-5" /> : <Video className="h-5 w-5" />}
        </span>
        <div className="min-w-0">
          <p id="incoming-call-title" className="truncate font-semibold">
            {incoming.title}
          </p>
          <p className="text-sm text-ink/60">{ended ? "The call has ended." : incoming.voice ? "Voice call" : "Video call"}</p>
        </div>
      </div>
      {!ended && (
        <div className="mt-4 grid grid-cols-2 gap-2">
          <button type="button" className="btn-secondary" onClick={() => onDismiss(true)}>
            <PhoneOff aria-hidden className="h-4 w-4" /> Not now
          </button>
          <button ref={answerRef} type="button" className="btn-primary" onClick={onAnswer}>
            <Phone aria-hidden className="h-4 w-4" /> Join
          </button>
        </div>
      )}
    </div>
  );
}

/**
 * A phone-style ring made in the browser (no sound file): two soft tones for
 * about a second and a half, then a pause, repeating; plus vibration where the
 * phone supports it. Browsers only allow sound after the person has tapped
 * something on the page — if it's blocked, the card and vibration still show.
 */
function startRinging(): () => void {
  let ctx: AudioContext | null = null;
  try {
    const AudioCtx = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    ctx = AudioCtx ? new AudioCtx() : null;
    ctx?.resume().catch(() => undefined);
  } catch {
    ctx = null;
  }

  const ringOnce = () => {
    navigator.vibrate?.([700, 300, 700]);
    if (!ctx || ctx.state === "closed") return;
    const start = ctx.currentTime + 0.05;
    const gain = ctx.createGain();
    gain.connect(ctx.destination);
    gain.gain.setValueAtTime(0, start);
    // Two bursts of ~0.6 s, the way a phone rings.
    for (const offset of [0, 0.8]) {
      gain.gain.linearRampToValueAtTime(0.18, start + offset + 0.03);
      gain.gain.setValueAtTime(0.18, start + offset + 0.55);
      gain.gain.linearRampToValueAtTime(0, start + offset + 0.6);
    }
    for (const freq of [440, 480]) {
      const osc = ctx.createOscillator();
      osc.type = "sine";
      osc.frequency.value = freq;
      osc.connect(gain);
      osc.start(start);
      osc.stop(start + 1.45);
    }
  };

  ringOnce();
  const timer = setInterval(ringOnce, 3000);
  return () => {
    clearInterval(timer);
    navigator.vibrate?.(0);
    ctx?.close().catch(() => undefined);
  };
}
