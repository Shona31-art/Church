"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Lock, Mic, MicOff, Phone, PhoneOff, SwitchCamera, Video, VideoOff } from "lucide-react";
import type { RealtimeChannel } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/client";
import { callAction, CONNECTION_FAILED } from "@/lib/call-action";
import { useConfirm } from "@/components/ui/ConfirmDialog";
import { showToast } from "@/components/ui/Toaster";
import { Avatar } from "@/components/ui/Avatar";
import { shouldInitiate } from "@/lib/video-call-rules";
import { startRingback } from "@/lib/call-sounds";
import { endCall, markCallConnected, ringAgain, type EndReason } from "../actions";

/**
 * A built-in voice or video call that behaves like WhatsApp.
 *
 * How it works: everyone in the call joins a private Supabase Realtime
 * channel for it ("call:<id>" — only the call's participants may join,
 * calls_v2.sql). There each phone announces itself (presence) and exchanges
 * the short WebRTC set-up messages ("offer", "answer", network candidates)
 * with every other phone. Sound and video then go directly between the
 * phones, encrypted by WebRTC; nothing is recorded or stored.
 *
 * Two-person calls (private chat, appointment): the caller sees "Calling…"
 * with a ringing tone; no answer in 45 seconds ends it ("No answer"); the
 * other person can decline; either hanging up ends it for both. Group calls:
 * people come and go; the starter or a pastor can end it for everyone.
 */

const NO_ANSWER_MS = 45_000;

type Signal =
  | { type: "description"; from: string; to: string; description: RTCSessionDescriptionInit }
  | { type: "candidate"; from: string; to: string; candidate: RTCIceCandidateInit };

interface PresenceMeta {
  userId: string;
  name: string;
  muted?: boolean;
  cameraOff?: boolean;
}

interface Remote {
  peerId: string;
  userId: string;
  name: string;
  stream: MediaStream | null;
  muted: boolean;
  cameraOff: boolean;
  state: RTCPeerConnectionState | "new";
}

type Phase = { kind: "lobby" } | { kind: "joining" } | { kind: "in-call" } | { kind: "full" } | { kind: "ended"; reason: string } | { kind: "error"; message: string };

const END_TEXT: Record<EndReason, string> = { ended: "Call ended", declined: "Call declined", no_answer: "No answer" };

export function CallRoom({
  callId,
  me,
  capacity,
  iceServers,
  back,
  canEndForAll,
  audioOnly = false,
  expiresAt,
  oneToOne = false,
  isCaller = false,
  other = null,
  title = "Call",
  autoJoin = false,
}: {
  callId: string;
  me: { id: string; name: string };
  capacity: number;
  iceServers: RTCIceServer[];
  back: { href: string; label: string };
  canEndForAll: boolean;
  audioOnly?: boolean;
  expiresAt: string;
  /** A private chat or an appointment: two people, WhatsApp rules. */
  oneToOne?: boolean;
  /** I started this call. */
  isCaller?: boolean;
  /** In a two-person call: who's on the other end. */
  other?: { name: string; photoUrl: string | null } | null;
  title?: string;
  /** Came here by tapping Call / Accept: go straight in (no extra tap). */
  autoJoin?: boolean;
}) {
  const router = useRouter();
  const [supabase] = useState(() => createClient());
  const peerId = useMemo(() => (typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID() : String(Math.random()).slice(2)), []);
  const [phase, setPhase] = useState<Phase>({ kind: autoJoin ? "joining" : "lobby" });
  const [remotes, setRemotes] = useState<Record<string, Remote>>({});
  const [muted, setMuted] = useState(false);
  const [cameraOff, setCameraOff] = useState(false);
  const [facing, setFacing] = useState<"user" | "environment">("user");
  const [connectedAt, setConnectedAt] = useState<number | null>(null);
  const [, tick] = useState(0);
  const [confirm, confirmDialog] = useConfirm();

  const localRef = useRef<MediaStream | null>(null);
  const localVideoRef = useRef<HTMLVideoElement>(null);
  const channelRef = useRef<RealtimeChannel | null>(null);
  const peersRef = useRef(new Map<string, RTCPeerConnection>());
  const pendingRef = useRef(new Map<string, RTCIceCandidateInit[]>());
  const metaRef = useRef<PresenceMeta>({ userId: me.id, name: me.name, muted: false, cameraOff: false });
  const everConnectedRef = useRef(false);
  const endingRef = useRef(false);
  const joinStartedRef = useRef(false);

  const send = useCallback((signal: Signal) => {
    channelRef.current?.send({ type: "broadcast", event: "signal", payload: signal });
  }, []);

  const updateRemote = useCallback((id: string, patch: Partial<Remote>) => {
    setRemotes((all) => (all[id] ? { ...all, [id]: { ...all[id], ...patch } } : all));
  }, []);

  const closePeer = useCallback((id: string) => {
    peersRef.current.get(id)?.close();
    peersRef.current.delete(id);
    pendingRef.current.delete(id);
    setRemotes((all) => {
      const { [id]: _gone, ...rest } = all;
      return rest;
    });
  }, []);

  /** Stops everything this phone is doing in the call. */
  const hangUp = useCallback(() => {
    for (const id of [...peersRef.current.keys()]) closePeer(id);
    localRef.current?.getTracks().forEach((t) => t.stop());
    localRef.current = null;
    if (channelRef.current) {
      channelRef.current.untrack().catch(() => undefined);
      supabase.removeChannel(channelRef.current);
      channelRef.current = null;
    }
  }, [closePeer, supabase]);

  /** Show how the call ended for a moment, then go back to the chat / appointment. */
  const finish = useCallback(
    (reason: string) => {
      hangUp();
      setPhase({ kind: "ended", reason });
      setTimeout(() => {
        router.push(back.href);
        router.refresh();
      }, 1800);
    },
    [back.href, hangUp, router]
  );

  /** End the call (two-person calls: for both of us) with a reason, then finish. */
  const endWith = useCallback(
    async (reason: EndReason) => {
      if (endingRef.current) return;
      endingRef.current = true;
      // Tell the other phones straight away (quicker than waiting for the database).
      // Declining from the incoming screen: not in the call yet, so drop in just to say it.
      const bye = { type: "broadcast" as const, event: "bye", payload: { from: peerId, reason } };
      if (channelRef.current) channelRef.current.send(bye).catch(() => undefined);
      else {
        const quick = supabase.channel(`call:${callId}`, { config: { private: true } });
        quick.subscribe((status) => {
          if (status === "SUBSCRIBED") quick.send(bye).finally(() => setTimeout(() => supabase.removeChannel(quick), 500));
        });
      }
      hangUp();
      setPhase({ kind: "ended", reason: END_TEXT[reason] });
      await callAction(() => endCall(callId, reason), { error: CONNECTION_FAILED });
      finish(END_TEXT[reason]);
    },
    [callId, finish, hangUp, peerId, supabase]
  );

  /** A connection to one other phone. The "initiator" sends the first offer. */
  const connectTo = useCallback(
    async (theirId: string, meta: PresenceMeta, initiator: boolean) => {
      if (peersRef.current.has(theirId) || !localRef.current) return peersRef.current.get(theirId);
      const pc = new RTCPeerConnection({ iceServers });
      peersRef.current.set(theirId, pc);
      setRemotes((all) => ({ ...all, [theirId]: { peerId: theirId, userId: meta.userId, name: meta.name, stream: null, muted: Boolean(meta.muted), cameraOff: Boolean(meta.cameraOff), state: "new" } }));
      localRef.current.getTracks().forEach((track) => pc.addTrack(track, localRef.current!));
      pc.onicecandidate = (e) => {
        if (e.candidate) send({ type: "candidate", from: peerId, to: theirId, candidate: e.candidate.toJSON() });
      };
      pc.ontrack = (e) => {
        updateRemote(theirId, { stream: e.streams[0] ?? new MediaStream([e.track]) });
        if (!everConnectedRef.current) {
          everConnectedRef.current = true;
          setConnectedAt(Date.now());
          markCallConnected(callId).catch(() => undefined);
        }
      };
      pc.onconnectionstatechange = () => {
        updateRemote(theirId, { state: pc.connectionState });
        // A dropped network (e.g. Wi-Fi to mobile data): try to reconnect.
        if (pc.connectionState === "failed" && initiator) {
          pc.restartIce?.();
          pc.createOffer({ iceRestart: true })
            .then((offer) => pc.setLocalDescription(offer))
            .then(() => send({ type: "description", from: peerId, to: theirId, description: pc.localDescription!.toJSON() }))
            .catch(() => undefined);
        }
      };
      if (initiator) {
        const offer = await pc.createOffer();
        await pc.setLocalDescription(offer);
        send({ type: "description", from: peerId, to: theirId, description: pc.localDescription!.toJSON() });
      }
      return pc;
    },
    [callId, iceServers, peerId, send, updateRemote]
  );

  const handleSignal = useCallback(
    async (signal: Signal) => {
      if (signal.to !== peerId) return;
      let pc = peersRef.current.get(signal.from);
      if (!pc) {
        const meta = (channelRef.current?.presenceState<PresenceMeta>()[signal.from]?.[0] ?? { userId: "", name: other?.name ?? "Someone" }) as PresenceMeta;
        pc = await connectTo(signal.from, meta, false);
        if (!pc) return;
      }
      try {
        if (signal.type === "description") {
          await pc.setRemoteDescription(signal.description);
          if (signal.description.type === "offer") {
            const answer = await pc.createAnswer();
            await pc.setLocalDescription(answer);
            send({ type: "description", from: peerId, to: signal.from, description: pc.localDescription!.toJSON() });
          }
          // Candidates that arrived before the description can be used now.
          for (const candidate of pendingRef.current.get(signal.from) ?? []) await pc.addIceCandidate(candidate).catch(() => undefined);
          pendingRef.current.delete(signal.from);
        } else if (pc.remoteDescription) {
          await pc.addIceCandidate(signal.candidate).catch(() => undefined);
        } else {
          pendingRef.current.set(signal.from, [...(pendingRef.current.get(signal.from) ?? []), signal.candidate]);
        }
      } catch (error) {
        console.error("[calls] connection set-up failed:", error);
      }
    },
    [connectTo, other?.name, peerId, send]
  );

  // Leaving the page (or closing the app) leaves the call.
  useEffect(() => hangUp, [hangUp]);

  // The other side ended it (hung up, declined), or it ran out.
  useEffect(() => {
    const status = supabase
      .channel(`call-ended:${callId}`)
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "video_calls", filter: `id=eq.${callId}` }, ({ new: row }) => {
        const r = row as { ended_at: string | null; end_reason?: EndReason | null };
        if (r.ended_at && !endingRef.current) {
          endingRef.current = true;
          finish(END_TEXT[r.end_reason ?? "ended"] ?? "Call ended");
        }
      })
      .subscribe();
    const untilEnd = new Date(expiresAt).getTime() - Date.now();
    const timer = setTimeout(() => finish("Calls end after three hours."), Math.max(0, Math.min(untilEnd, 2_147_000_000)));
    return () => {
      clearTimeout(timer);
      supabase.removeChannel(status);
    };
  }, [callId, expiresAt, finish, supabase]);

  const people = Object.values(remotes);
  const someoneHere = people.length > 0;
  const connected = connectedAt !== null && people.some((p) => p.stream);

  // Caller's side of a two-person call: ringing tone, and "No answer" after 45 s.
  const waitingForAnswer = phase.kind === "in-call" && oneToOne && isCaller && !someoneHere && !everConnectedRef.current;
  useEffect(() => {
    if (!waitingForAnswer) return;
    const stop = startRingback();
    const timer = setTimeout(() => endWith("no_answer"), NO_ANSWER_MS);
    // Keep their phone buzzing even if the app is closed (a fresh pop-up every 7 s).
    const again = setInterval(() => ringAgain(callId).catch(() => undefined), 7000);
    return () => {
      stop();
      clearTimeout(timer);
      clearInterval(again);
    };
  }, [waitingForAnswer, endWith, callId]);

  // Two-person call: when the other person leaves after picking up, it's over for both.
  useEffect(() => {
    if (oneToOne && phase.kind === "in-call" && everConnectedRef.current && !someoneHere) {
      const t = setTimeout(() => endWith("ended"), 1500); // a moment's grace for a quick reconnect
      return () => clearTimeout(t);
    }
  }, [oneToOne, phase.kind, someoneHere, endWith]);

  // Call timer, and keep the screen on during the call (where the phone allows it).
  useEffect(() => {
    if (phase.kind !== "in-call") return;
    const t = setInterval(() => tick((n) => n + 1), 1000);
    let lock: { release: () => Promise<void> } | null = null;
    const nav = navigator as Navigator & { wakeLock?: { request: (type: "screen") => Promise<{ release: () => Promise<void> }> } };
    const keepAwake = () => {
      if (document.visibilityState === "visible") nav.wakeLock?.request("screen").then((l) => (lock = l), () => undefined);
    };
    keepAwake();
    document.addEventListener("visibilitychange", keepAwake);
    return () => {
      clearInterval(t);
      document.removeEventListener("visibilitychange", keepAwake);
      lock?.release().catch(() => undefined);
    };
  }, [phase.kind]);

  // Show my own camera.
  useEffect(() => {
    if (localVideoRef.current && localRef.current) localVideoRef.current.srcObject = localRef.current;
  }, [phase.kind, facing, someoneHere]);

  async function join() {
    if (joinStartedRef.current) return;
    joinStartedRef.current = true;
    setPhase({ kind: "joining" });
    try {
      localRef.current = await navigator.mediaDevices.getUserMedia({
        audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true },
        video: audioOnly ? false : { facingMode: facing, width: { ideal: 640 }, height: { ideal: 480 } },
      });
    } catch (error) {
      joinStartedRef.current = false;
      const denied = (error as DOMException)?.name === "NotAllowedError";
      return setPhase({
        kind: "error",
        message: denied
          ? `Your browser blocked the ${audioOnly ? "microphone" : "camera and microphone"}. Allow ${audioOnly ? "it" : "them"} for this site (tap the lock or ⓘ next to the address), then try again.`
          : `We couldn't start your ${audioOnly ? "microphone" : "camera or microphone"}. Close other apps using ${audioOnly ? "it" : "them"} and try again.`,
      });
    }

    const channel = supabase.channel(`call:${callId}`, { config: { private: true, presence: { key: peerId }, broadcast: { self: false } } });
    channelRef.current = channel;
    let firstSync = true;

    channel
      .on("presence", { event: "sync" }, () => {
        const state = channel.presenceState<PresenceMeta>();
        const others = Object.entries(state).filter(([id]) => id !== peerId);
        if (firstSync) {
          firstSync = false;
          if (others.length + 1 > capacity) {
            hangUp();
            return setPhase({ kind: "full" });
          }
        }
        for (const [id, metas] of others) {
          const meta = metas[0];
          if (!peersRef.current.has(id)) {
            if (shouldInitiate(peerId, id)) connectTo(id, meta, true);
          } else {
            updateRemote(id, { muted: Boolean(meta.muted), cameraOff: Boolean(meta.cameraOff), name: meta.name });
          }
        }
        for (const id of [...peersRef.current.keys()]) if (!state[id]) closePeer(id);
      })
      .on("broadcast", { event: "signal" }, ({ payload }) => handleSignal(payload as Signal))
      // The other person hung up or declined.
      .on("broadcast", { event: "bye" }, ({ payload }) => {
        const p = payload as { from: string; reason: EndReason };
        if (oneToOne && !endingRef.current) {
          endingRef.current = true;
          finish(END_TEXT[p.reason] ?? "Call ended");
        } else if (!oneToOne) {
          closePeer(p.from);
        }
      })
      .subscribe(async (status) => {
        if (status === "SUBSCRIBED") {
          await channel.track(metaRef.current);
          setPhase((p) => (p.kind === "joining" ? { kind: "in-call" } : p));
        } else if (status === "CHANNEL_ERROR" || status === "TIMED_OUT") {
          hangUp();
          joinStartedRef.current = false;
          setPhase({ kind: "error", message: "We couldn't connect to the call. Check your connection and try again." });
        }
      });
  }

  // Tapped Call or Accept to get here: go straight in.
  useEffect(() => {
    if (autoJoin) join();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- once, on arrival
  }, []);

  function share(patch: Partial<PresenceMeta>) {
    metaRef.current = { ...metaRef.current, ...patch };
    channelRef.current?.track(metaRef.current).catch(() => undefined);
  }

  function toggleMute() {
    const next = !muted;
    localRef.current?.getAudioTracks().forEach((t) => (t.enabled = !next));
    setMuted(next);
    share({ muted: next });
  }

  function toggleCamera() {
    const next = !cameraOff;
    localRef.current?.getVideoTracks().forEach((t) => (t.enabled = !next));
    setCameraOff(next);
    share({ cameraOff: next });
  }

  /** Front ↔ back camera on phones: swap the video being sent without reconnecting. */
  /**
   * Front ⇄ back camera. Phones can't open both cameras at once, so the old
   * camera is released first; "exact" makes the phone really change sides
   * (a plain hint is often ignored), with fallbacks for phones that only
   * list their cameras by id.
   */
  async function switchCamera() {
    const local = localRef.current;
    if (!local) return;
    const nextFacing = facing === "user" ? "environment" : "user";
    const oldTrack = local.getVideoTracks()[0];
    const oldDeviceId = oldTrack?.getSettings().deviceId;
    oldTrack?.stop();
    const size = { width: { ideal: 640 }, height: { ideal: 480 } };
    const attempts: MediaTrackConstraints[] = [{ facingMode: { exact: nextFacing }, ...size }];
    try {
      const cameras = (await navigator.mediaDevices.enumerateDevices()).filter((d) => d.kind === "videoinput" && d.deviceId && d.deviceId !== oldDeviceId);
      const wanted = nextFacing === "environment" ? /back|rear|environment/i : /front|user|face/i;
      const pick = cameras.find((d) => wanted.test(d.label)) ?? cameras[0];
      if (pick) attempts.push({ deviceId: { exact: pick.deviceId }, ...size });
    } catch {
      // Can't list cameras; the facing-mode attempts below still run.
    }
    attempts.push({ facingMode: nextFacing, ...size });

    let track: MediaStreamTrack | null = null;
    let usedFacing: "user" | "environment" = nextFacing;
    for (const video of attempts) {
      try {
        track = (await navigator.mediaDevices.getUserMedia({ video })).getVideoTracks()[0] ?? null;
        if (track) break;
      } catch {
        // Try the next way of asking.
      }
    }
    if (!track) {
      // Only one camera: bring the old one back.
      usedFacing = facing;
      try {
        track = (await navigator.mediaDevices.getUserMedia({ video: oldDeviceId ? { deviceId: { exact: oldDeviceId }, ...size } : { facingMode: facing, ...size } })).getVideoTracks()[0] ?? null;
      } catch {
        track = null;
      }
      showToast("Couldn't switch to the other camera on this phone.", "error");
    }
    const reported = track?.getSettings().facingMode;
    if (reported === "user" || reported === "environment") usedFacing = reported;

    if (oldTrack) local.removeTrack(oldTrack);
    if (track) {
      track.enabled = !cameraOff;
      local.addTrack(track);
    }
    for (const pc of peersRef.current.values()) {
      // By transceiver, so it is found even after a failed switch left it empty.
      const sender = pc.getTransceivers().find((t) => t.receiver.track?.kind === "video")?.sender;
      await sender?.replaceTrack(track).catch(() => undefined);
    }
    // The preview keeps showing the stopped camera unless it is re-attached.
    const preview = localVideoRef.current;
    if (preview) {
      preview.srcObject = null;
      preview.srcObject = local;
      preview.play().catch(() => undefined);
    }
    setFacing(usedFacing);
  }

  /** The red button: two-person calls end for both; in a group you just leave. */
  function hangUpButton() {
    if (oneToOne) return endWith("ended");
    hangUp();
    router.push(back.href);
  }

  async function endForAll() {
    if (!(await confirm({ title: "End the call for everyone?", message: "Anyone still in the call will be disconnected.", confirmLabel: "End call", tone: "danger" }))) return;
    endWith("ended");
  }

  const kindLabel = audioOnly ? "Voice call" : "Video call";
  const elapsed = connectedAt ? Math.floor((Date.now() - connectedAt) / 1000) : 0;
  const timer = `${Math.floor(elapsed / 60)}:${String(elapsed % 60).padStart(2, "0")}`;
  const statusLine =
    phase.kind === "joining"
      ? "Connecting…"
      : phase.kind === "ended"
      ? phase.reason
      : connected
      ? timer
      : someoneHere
      ? "Connecting…"
      : oneToOne && isCaller
      ? "Calling…"
      : oneToOne
      ? `Waiting for ${other?.name ?? "them"}…`
      : "Waiting for others to join…";

  const remoteVideo = !audioOnly && oneToOne ? people.find((p) => p.stream && !p.cameraOff) : undefined;

  // ---------------------------------------------------------------------------
  // Screens
  // ---------------------------------------------------------------------------
  return (
    <div className="fixed inset-0 z-[80] flex flex-col bg-[#0b1f1a] text-white" role="dialog" aria-label={`${kindLabel} — ${title}`}>
      {/* Two-person video: the other person fills the screen, like WhatsApp. */}
      {remoteVideo && <RemoteMedia person={remoteVideo} audioOnly={false} fill nameTag={false} />}

      {/* Sound from everyone (and video tiles in group calls). */}
      {!remoteVideo &&
        people.map((p) => (oneToOne || audioOnly ? <RemoteMedia key={p.peerId} person={p} audioOnly hidden /> : null))}

      <header className="relative z-10 px-6 pt-[max(2.5rem,env(safe-area-inset-top))] text-center [text-shadow:0_1px_3px_rgb(0_0_0/0.6)]">
        <p className="flex items-center justify-center gap-1 text-xs text-white/70">
          <Lock aria-hidden className="h-3 w-3" /> End-to-end encrypted
        </p>
        <h1 className="mt-2 truncate text-2xl font-semibold">{title}</h1>
        <p className="mt-1 text-sm tabular-nums text-white/80" role="status">
          {phase.kind === "lobby" ? (oneToOne && !isCaller ? `Incoming ${kindLabel.toLowerCase()}` : kindLabel) : phase.kind === "full" ? `This call is full (${capacity} people)` : statusLine}
        </p>
      </header>

      <main className="relative z-10 flex flex-1 flex-col items-center justify-center gap-4 px-4">
        {!remoteVideo && (oneToOne || audioOnly || !someoneHere) && phase.kind !== "error" && (
          <span className={!connected && phase.kind !== "ended" ? "motion-safe:animate-pulse" : ""}>
            <span className="block scale-[2.2]">
              <Avatar name={oneToOne ? other?.name ?? title : title} src={oneToOne ? other?.photoUrl ?? null : null} size="lg" />
            </span>
          </span>
        )}
        {!oneToOne && !audioOnly && someoneHere && (
          <div className={`grid w-full max-w-3xl gap-2 ${people.length > 1 ? "grid-cols-2" : ""}`}>
            {people.map((p) => (
              <div key={p.peerId} className="relative aspect-video overflow-hidden rounded-2xl bg-black/40">
                <RemoteMedia person={p} audioOnly={false} fill />
              </div>
            ))}
          </div>
        )}
        {!oneToOne && audioOnly && someoneHere && (
          <p className="text-sm text-white/80">{people.map((p) => p.name + (p.muted ? " (muted)" : "")).join(", ")}</p>
        )}
        {oneToOne && people.some((p) => p.muted) && <p className="flex items-center gap-1 text-sm text-white/80"><MicOff aria-hidden className="h-4 w-4" /> {other?.name ?? "They"} muted their microphone</p>}
        {phase.kind === "error" && <p role="alert" className="max-w-sm text-center text-sm text-red-200">{phase.message}</p>}
      </main>

      {/* My own camera, small, bottom right — with the flip-camera button on it, like WhatsApp. */}
      {!audioOnly && (phase.kind === "in-call" || phase.kind === "joining") && (
        <div className="absolute bottom-[max(7.5rem,calc(env(safe-area-inset-bottom)+6.5rem))] right-4 z-20 aspect-[3/4] w-28 overflow-hidden rounded-2xl border border-white/20 bg-black sm:w-36">
          <video ref={localVideoRef} autoPlay playsInline muted className={`h-full w-full object-cover ${facing === "user" ? "-scale-x-100" : ""} ${cameraOff ? "invisible" : ""}`} />
          {cameraOff && <span className="absolute inset-0 flex items-center justify-center text-[11px] text-white/70">Camera off</span>}
          <button type="button" onClick={switchCamera} aria-label="Switch camera" className="absolute right-1.5 top-1.5 flex h-9 w-9 items-center justify-center rounded-full bg-black/60 text-white">
            <SwitchCamera aria-hidden className="h-4 w-4" />
          </button>
        </div>
      )}

      <footer className="relative z-10 px-6 pb-[max(2rem,env(safe-area-inset-bottom))]">
        {phase.kind === "lobby" && oneToOne && !isCaller ? (
          // Incoming call screen: Decline / Accept.
          <div className="flex items-center justify-around">
            <RoundButton label="Decline" tone="red" onClick={() => endWith("declined")}>
              <PhoneOff aria-hidden className="h-7 w-7" />
            </RoundButton>
            <RoundButton label="Accept" tone="green" onClick={join}>
              {audioOnly ? <Phone aria-hidden className="h-7 w-7" /> : <Video aria-hidden className="h-7 w-7" />}
            </RoundButton>
          </div>
        ) : phase.kind === "lobby" || phase.kind === "error" ? (
          <div className="flex items-center justify-around">
            <RoundButton label="Back" tone="glass" onClick={() => router.push(back.href)}>
              <PhoneOff aria-hidden className="h-6 w-6" />
            </RoundButton>
            <RoundButton label={phase.kind === "error" ? "Try again" : "Join"} tone="green" onClick={join}>
              {audioOnly ? <Phone aria-hidden className="h-7 w-7" /> : <Video aria-hidden className="h-7 w-7" />}
            </RoundButton>
          </div>
        ) : phase.kind === "full" || phase.kind === "ended" ? (
          <div className="flex justify-center">
            <button type="button" className="rounded-full bg-white/15 px-6 py-3 text-sm font-semibold" onClick={() => router.push(back.href)}>
              {back.label}
            </button>
          </div>
        ) : (
          <>
            {audioOnly ? (
              // Voice call: a rounded panel of labelled buttons, like WhatsApp.
              <div className="mx-auto flex max-w-sm items-start justify-around rounded-[2rem] bg-white/10 px-4 pb-4 pt-5 backdrop-blur" role="group" aria-label="Call controls">
                <RoundButton label={muted ? "Unmute" : "Mute"} tone={muted ? "light" : "glass"} pressed={muted} onClick={toggleMute}>
                  {muted ? <MicOff aria-hidden className="h-6 w-6" /> : <Mic aria-hidden className="h-6 w-6" />}
                </RoundButton>
                <RoundButton label={oneToOne ? "End" : "Leave"} tone="red" onClick={hangUpButton}>
                  <PhoneOff aria-hidden className="h-6 w-6" />
                </RoundButton>
              </div>
            ) : (
              // Video call: one pill-shaped bar along the bottom.
              <div className="mx-auto flex max-w-sm items-center justify-between gap-3 rounded-full bg-black/60 px-3 py-2.5 backdrop-blur" role="group" aria-label="Call controls">
                <RoundButton label={cameraOff ? "Turn camera on" : "Turn camera off"} tone={cameraOff ? "glass" : "light"} pressed={cameraOff} onClick={toggleCamera} hideLabel>
                  {cameraOff ? <VideoOff aria-hidden className="h-6 w-6" /> : <Video aria-hidden className="h-6 w-6" />}
                </RoundButton>
                <RoundButton label={muted ? "Unmute" : "Mute"} tone={muted ? "light" : "glass"} pressed={muted} onClick={toggleMute} hideLabel>
                  {muted ? <MicOff aria-hidden className="h-6 w-6" /> : <Mic aria-hidden className="h-6 w-6" />}
                </RoundButton>
                <RoundButton label={oneToOne ? "End call" : "Leave the call"} tone="red" onClick={hangUpButton} hideLabel>
                  <PhoneOff aria-hidden className="h-6 w-6" />
                </RoundButton>
              </div>
            )}
            {!oneToOne && canEndForAll && (
              <div className="mt-4 text-center">
                <button type="button" className="text-sm text-white/80 underline" onClick={endForAll}>
                  End the call for everyone
                </button>
              </div>
            )}
          </>
        )}
      </footer>
      {confirmDialog}
    </div>
  );
}

function RoundButton({ label, tone, pressed, onClick, hideLabel = false, children }: { label: string; tone: "red" | "green" | "glass" | "light"; pressed?: boolean; onClick: () => void; hideLabel?: boolean; children: React.ReactNode }) {
  const colors = { red: "bg-red-600 text-white", green: "bg-green-600 text-white", glass: "bg-white/15 text-white", light: "bg-white text-[#0b1f1a]" }[tone];
  return (
    <span className="flex flex-col items-center gap-1.5">
      <button type="button" onClick={onClick} aria-label={label} aria-pressed={pressed} className={`flex h-16 w-16 items-center justify-center rounded-full ${colors} active:scale-95 motion-safe:transition-transform`}>
        {children}
      </button>
      {!hideLabel && (
        <span aria-hidden className="text-xs text-white/80">
          {label}
        </span>
      )}
    </span>
  );
}

/** Someone else's sound and (optionally) video. */
function RemoteMedia({ person, audioOnly, fill = false, hidden = false, nameTag = true }: { person: Remote; audioOnly: boolean; fill?: boolean; hidden?: boolean; nameTag?: boolean }) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const audioRef = useRef<HTMLAudioElement>(null);
  useEffect(() => {
    if (videoRef.current && person.stream) videoRef.current.srcObject = person.stream;
    if (audioRef.current && person.stream) audioRef.current.srcObject = person.stream;
  }, [person.stream]);
  if (audioOnly || hidden) return <audio ref={audioRef} autoPlay className="hidden" />;
  const showVideo = Boolean(person.stream) && !person.cameraOff;
  return (
    <>
      <video ref={videoRef} autoPlay playsInline className={`${fill ? "absolute inset-0 h-full w-full" : "w-full"} object-cover ${showVideo ? "" : "invisible"}`} />
      {!showVideo && (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-2">
          <Avatar name={person.name} size="lg" />
          <span className="text-sm">{person.name}</span>
        </div>
      )}
      {nameTag && (
        <span className="absolute bottom-2 left-2 flex items-center gap-1 rounded-full bg-black/50 px-2 py-0.5 text-xs">
          {person.muted && <MicOff aria-label="Muted" className="h-3 w-3" />}
          {person.name}
        </span>
      )}
    </>
  );
}
