"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Mic, MicOff, Phone, PhoneOff, SwitchCamera, Video, VideoOff } from "lucide-react";
import type { RealtimeChannel } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/client";
import { callAction, CONNECTION_FAILED } from "@/lib/call-action";
import { useConfirm } from "@/components/ui/ConfirmDialog";
import { Avatar } from "@/components/ui/Avatar";
import { shouldInitiate } from "@/lib/video-call-rules";
import { endCall } from "../actions";

/**
 * A built-in voice or video call (no outside call service).
 *
 * How it works: everyone in the call joins a private Supabase Realtime
 * channel for it ("call:<id>" — only the call's participants may join,
 * calls_v2.sql). There each phone announces itself (presence) and exchanges
 * the short WebRTC set-up messages ("offer", "answer", network candidates)
 * with every other phone. Sound and video then go directly between the
 * phones, encrypted end to end by WebRTC; nothing is recorded or stored.
 */

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

export function CallRoom({
  callId,
  me,
  capacity,
  iceServers,
  back,
  canEndForAll,
  audioOnly = false,
  expiresAt,
}: {
  callId: string;
  me: { id: string; name: string };
  capacity: number;
  iceServers: RTCIceServer[];
  back: { href: string; label: string };
  canEndForAll: boolean;
  audioOnly?: boolean;
  expiresAt: string;
}) {
  const router = useRouter();
  const [supabase] = useState(() => createClient());
  const peerId = useMemo(() => (typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID() : String(Math.random()).slice(2)), []);
  const [phase, setPhase] = useState<Phase>({ kind: "lobby" });
  const [remotes, setRemotes] = useState<Record<string, Remote>>({});
  const [muted, setMuted] = useState(false);
  const [cameraOff, setCameraOff] = useState(false);
  const [facing, setFacing] = useState<"user" | "environment">("user");
  const [seconds, setSeconds] = useState(0);
  const [confirm, confirmDialog] = useConfirm();

  const localRef = useRef<MediaStream | null>(null);
  const localVideoRef = useRef<HTMLVideoElement>(null);
  const channelRef = useRef<RealtimeChannel | null>(null);
  const peersRef = useRef(new Map<string, RTCPeerConnection>());
  const pendingRef = useRef(new Map<string, RTCIceCandidateInit[]>());
  const metaRef = useRef<PresenceMeta>({ userId: me.id, name: me.name, muted: false, cameraOff: false });

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
      pc.ontrack = (e) => updateRemote(theirId, { stream: e.streams[0] ?? new MediaStream([e.track]) });
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
    [iceServers, peerId, send, updateRemote]
  );

  const handleSignal = useCallback(
    async (signal: Signal) => {
      if (signal.to !== peerId) return;
      let pc = peersRef.current.get(signal.from);
      if (!pc) {
        const meta = (channelRef.current?.presenceState<PresenceMeta>()[signal.from]?.[0] ?? { userId: "", name: "Someone" }) as PresenceMeta;
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
    [connectTo, peerId, send]
  );

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

  // Leaving the page (or closing the app) leaves the call.
  useEffect(() => hangUp, [hangUp]);

  // Someone ended the call for everyone, or it ran out.
  useEffect(() => {
    const status = supabase
      .channel(`call-ended:${callId}`)
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "video_calls", filter: `id=eq.${callId}` }, ({ new: row }) => {
        if ((row as { ended_at: string | null }).ended_at) {
          hangUp();
          setPhase({ kind: "ended", reason: "The call was ended." });
        }
      })
      .subscribe();
    const untilEnd = new Date(expiresAt).getTime() - Date.now();
    const timer = setTimeout(() => {
      hangUp();
      setPhase({ kind: "ended", reason: "Calls end after three hours." });
    }, Math.max(0, Math.min(untilEnd, 2_147_000_000)));
    return () => {
      clearTimeout(timer);
      supabase.removeChannel(status);
    };
  }, [callId, expiresAt, hangUp, supabase]);

  // Call timer.
  useEffect(() => {
    if (phase.kind !== "in-call") return;
    const started = Date.now();
    const t = setInterval(() => setSeconds(Math.floor((Date.now() - started) / 1000)), 1000);
    return () => clearInterval(t);
  }, [phase.kind]);

  // Show my own camera.
  useEffect(() => {
    if (localVideoRef.current && localRef.current) localVideoRef.current.srcObject = localRef.current;
  }, [phase.kind, facing]);

  async function join() {
    setPhase({ kind: "joining" });
    try {
      localRef.current = await navigator.mediaDevices.getUserMedia({
        audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true },
        video: audioOnly ? false : { facingMode: facing, width: { ideal: 640 }, height: { ideal: 480 } },
      });
    } catch (error) {
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
    let joinedOnce = false;

    channel
      .on("presence", { event: "sync" }, () => {
        const state = channel.presenceState<PresenceMeta>();
        const others = Object.entries(state).filter(([id]) => id !== peerId);
        if (!joinedOnce) {
          joinedOnce = true;
          // Full: everyone already there (and me) would be over the limit.
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
        // People who left.
        for (const id of [...peersRef.current.keys()]) if (!state[id]) closePeer(id);
      })
      .on("broadcast", { event: "signal" }, ({ payload }) => handleSignal(payload as Signal))
      .subscribe(async (status) => {
        if (status === "SUBSCRIBED") {
          await channel.track(metaRef.current);
          setPhase((p) => (p.kind === "joining" ? { kind: "in-call" } : p));
        } else if (status === "CHANNEL_ERROR" || status === "TIMED_OUT") {
          hangUp();
          setPhase({ kind: "error", message: "We couldn't connect to the call. Check your connection and try again." });
        }
      });
  }

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
  async function switchCamera() {
    const nextFacing = facing === "user" ? "environment" : "user";
    try {
      const fresh = await navigator.mediaDevices.getUserMedia({ video: { facingMode: nextFacing, width: { ideal: 640 }, height: { ideal: 480 } } });
      const track = fresh.getVideoTracks()[0];
      track.enabled = !cameraOff;
      for (const pc of peersRef.current.values()) {
        const sender = pc.getSenders().find((s) => s.track?.kind === "video");
        await sender?.replaceTrack(track);
      }
      const local = localRef.current!;
      local.getVideoTracks().forEach((t) => {
        local.removeTrack(t);
        t.stop();
      });
      local.addTrack(track);
      setFacing(nextFacing);
    } catch {
      // No second camera: nothing to switch to.
    }
  }

  function leave() {
    hangUp();
    router.push(back.href);
  }

  async function endForAll() {
    if (!(await confirm({ title: "End the call for everyone?", message: "Anyone still in the call will be disconnected.", confirmLabel: "End call", tone: "danger" }))) return;
    const r = await callAction(() => endCall(callId), { error: CONNECTION_FAILED });
    if (r.error) return setPhase({ kind: "error", message: r.error });
    hangUp();
    router.push(back.href);
    router.refresh();
  }

  const people = Object.values(remotes);
  const kind = audioOnly ? "Voice call" : "Video call";

  if (phase.kind === "lobby" || phase.kind === "joining" || phase.kind === "error" || phase.kind === "full" || phase.kind === "ended") {
    return (
      <div className="mx-auto max-w-md space-y-5 py-6 text-center">
        <span aria-hidden className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-success-tint text-success">
          {audioOnly ? <Phone className="h-7 w-7" /> : <Video className="h-7 w-7" />}
        </span>
        <h1 className="font-display text-2xl font-semibold">{kind}</h1>
        {phase.kind === "error" && <p role="alert" className="text-sm text-danger">{phase.message}</p>}
        {phase.kind === "full" && <p className="text-sm text-ink/70">This call is full ({capacity} people). Try again when someone leaves.</p>}
        {phase.kind === "ended" && <p className="text-sm text-ink/70">{phase.reason}</p>}
        {(phase.kind === "lobby" || phase.kind === "joining" || phase.kind === "error") && (
          <>
            <p className="text-sm text-ink/70">
              {audioOnly ? "Your browser will ask to use your microphone — choose Allow." : "Your browser will ask to use your camera and microphone — choose Allow."} Calls aren&apos;t recorded.
            </p>
            <button type="button" className="btn-primary w-full" onClick={join} disabled={phase.kind === "joining"}>
              {audioOnly ? <Phone aria-hidden className="h-4 w-4" /> : <Video aria-hidden className="h-4 w-4" />}
              {phase.kind === "joining" ? "Connecting…" : phase.kind === "error" ? "Try again" : "Join call"}
            </button>
          </>
        )}
        <button type="button" className="btn-secondary w-full" onClick={leave}>
          {back.label}
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-2 text-sm">
        <span className="font-semibold">{kind}</span>
        <span className="tabular text-ink/60">
          {people.length ? `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")}` : "Waiting for others to join…"}
        </span>
      </div>

      <div className={`grid gap-2 ${people.length > 1 ? "sm:grid-cols-2" : ""}`}>
        {people.map((p) => (
          <RemoteTile key={p.peerId} person={p} audioOnly={audioOnly} />
        ))}
        {!people.length && (
          <div className="flex aspect-video flex-col items-center justify-center gap-3 rounded-2xl bg-ink text-on-ember">
            <span className="motion-safe:animate-pulse">
              <Avatar name={me.name} size="lg" />
            </span>
            <p className="text-sm opacity-80">Ringing… the call starts when someone joins.</p>
          </div>
        )}
      </div>

      {!audioOnly && (
        <div className="relative ml-auto aspect-[3/4] w-28 overflow-hidden rounded-xl border border-line bg-ink sm:w-36">
          <video ref={localVideoRef} autoPlay playsInline muted className={`h-full w-full object-cover ${facing === "user" ? "-scale-x-100" : ""} ${cameraOff ? "invisible" : ""}`} />
          {cameraOff && <span className="absolute inset-0 flex items-center justify-center text-xs text-on-ember/80">Camera off</span>}
          <span className="absolute bottom-1 left-1 rounded bg-ink/60 px-1.5 text-[10px] text-on-ember">You</span>
        </div>
      )}

      <div className="flex flex-wrap items-center justify-center gap-3 pt-2" role="group" aria-label="Call controls">
        <button type="button" onClick={toggleMute} aria-pressed={muted} className={`btn-icon h-14 w-14 rounded-full ${muted ? "btn-primary" : "btn-secondary"}`} aria-label={muted ? "Unmute" : "Mute"}>
          {muted ? <MicOff aria-hidden className="h-5 w-5" /> : <Mic aria-hidden className="h-5 w-5" />}
        </button>
        {!audioOnly && (
          <>
            <button type="button" onClick={toggleCamera} aria-pressed={cameraOff} className={`btn-icon h-14 w-14 rounded-full ${cameraOff ? "btn-primary" : "btn-secondary"}`} aria-label={cameraOff ? "Turn camera on" : "Turn camera off"}>
              {cameraOff ? <VideoOff aria-hidden className="h-5 w-5" /> : <Video aria-hidden className="h-5 w-5" />}
            </button>
            <button type="button" onClick={switchCamera} className="btn-secondary btn-icon h-14 w-14 rounded-full" aria-label="Switch camera">
              <SwitchCamera aria-hidden className="h-5 w-5" />
            </button>
          </>
        )}
        <button type="button" onClick={leave} className="btn-icon h-14 w-14 rounded-full bg-danger text-white hover:opacity-90" aria-label="Leave the call">
          <PhoneOff aria-hidden className="h-5 w-5" />
        </button>
      </div>
      {canEndForAll && (
        <div className="text-center">
          <button type="button" className="btn-ghost btn-sm text-danger" onClick={endForAll}>
            End the call for everyone
          </button>
        </div>
      )}
      {confirmDialog}
    </div>
  );
}

/** Someone else in the call: their video (or their name for voice/camera off), and their sound. */
function RemoteTile({ person, audioOnly }: { person: Remote; audioOnly: boolean }) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const audioRef = useRef<HTMLAudioElement>(null);
  useEffect(() => {
    if (videoRef.current && person.stream) videoRef.current.srcObject = person.stream;
    if (audioRef.current && person.stream) audioRef.current.srcObject = person.stream;
  }, [person.stream]);
  const showVideo = !audioOnly && !person.cameraOff && person.stream;
  const connecting = !person.stream || person.state === "connecting" || person.state === "new";

  return (
    <div className="relative flex aspect-video items-center justify-center overflow-hidden rounded-2xl bg-ink text-on-ember">
      {/* Video elements carry sound too; in voice calls an audio element plays it. */}
      {!audioOnly ? (
        <video ref={videoRef} autoPlay playsInline className={`absolute inset-0 h-full w-full object-cover ${showVideo ? "" : "invisible"}`} />
      ) : (
        <audio ref={audioRef} autoPlay />
      )}
      {!showVideo && (
        <div className="flex flex-col items-center gap-2">
          <Avatar name={person.name} size="lg" />
          <span className="text-sm font-semibold">{person.name}</span>
        </div>
      )}
      <span className="absolute bottom-2 left-2 flex items-center gap-1 rounded-full bg-ink/60 px-2 py-0.5 text-xs">
        {person.muted && <MicOff aria-label="Muted" className="h-3 w-3" />}
        {showVideo && person.name}
        {connecting && <span className="opacity-80">· connecting…</span>}
        {person.state === "failed" && <span className="opacity-80">· reconnecting…</span>}
      </span>
    </div>
  );
}
