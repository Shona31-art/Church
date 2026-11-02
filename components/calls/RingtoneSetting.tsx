"use client";

import { useEffect, useRef, useState } from "react";
import { Music, Play, Scissors, Square, Trash2 } from "lucide-react";
import { showToast } from "@/components/ui/Toaster";
import { CLIP_LENGTHS, RINGTONES, chooseRingtone, chosenRingtone, customRingtone, decodeSong, makeClip, removeCustomRingtone, saveCustomRingtone, startRinging, type Ringtone } from "@/lib/call-sounds";

/**
 * My account → Notifications → Ringtone: the tune this phone plays for an
 * incoming call while the app is open — a built-in one, or the person's own
 * song (kept on this phone only, never uploaded).
 */
export function RingtoneSetting() {
  const [tone, setTone] = useState<Ringtone>("rise_up");
  const [playing, setPlaying] = useState<Ringtone | null>(null);
  const [song, setSong] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  // Choosing which few seconds of a song to keep.
  const [trim, setTrim] = useState<{ song: AudioBuffer; name: string; start: number; length: number } | null>(null);
  const stopRef = useRef<(() => void) | null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout>>();
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setTone(chosenRingtone());
    customRingtone().then((s) => setSong(s?.name ?? null));
    return () => {
      stopRef.current?.();
      clearTimeout(timerRef.current);
    };
  }, []);

  function stop() {
    stopRef.current?.();
    stopRef.current = null;
    clearTimeout(timerRef.current);
    setPlaying(null);
  }

  function preview(t: Ringtone) {
    const wasPlaying = playing === t;
    stop();
    if (wasPlaying) return;
    stopRef.current = startRinging(t);
    setPlaying(t);
    timerRef.current = setTimeout(stop, 12_000); // a preview, not the whole song
  }

  function pick(t: Ringtone) {
    setTone(t);
    chooseRingtone(t);
  }

  async function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    stop();
    setBusy(true);
    const song = await decodeSong(file);
    setBusy(false);
    if (typeof song === "string") return showToast(song, "error");
    setTrim({ song, name: file.name.replace(/\.[^.]+$/, ""), start: 0, length: Math.min(20, Math.floor(song.duration)) });
  }

  /** Plays just the chosen seconds. */
  function previewClip() {
    if (!trim) return;
    const wasPlaying = playing === "custom";
    stop();
    if (wasPlaying) return;
    const ctx = new AudioContext();
    const src = ctx.createBufferSource();
    src.buffer = trim.song;
    src.connect(ctx.destination);
    src.start(0, trim.start, trim.length);
    src.onended = () => stop();
    stopRef.current = () => {
      src.onended = null;
      try {
        src.stop();
      } catch {
        // Already finished.
      }
      ctx.close().catch(() => undefined);
    };
    setPlaying("custom");
  }

  async function saveClip() {
    if (!trim) return;
    stop();
    setBusy(true);
    const clip = await makeClip(trim.song, trim.start, trim.length);
    const problem = await saveCustomRingtone(clip, trim.name);
    setBusy(false);
    if (problem) return showToast(problem, "error");
    setSong(trim.name);
    setTone("custom");
    setTrim(null);
    showToast(`Saved — ${trim.length} seconds of “${trim.name}” (${Math.round(clip.size / 1024)} KB) is your ringtone on this phone.`, "success");
  }

  async function removeSong() {
    stop();
    await removeCustomRingtone();
    setSong(null);
    setTone(chosenRingtone());
  }

  const options = (Object.keys(RINGTONES) as Ringtone[]).filter((t) => t !== "custom" || song);

  return (
    <fieldset className="mt-5 border-t border-line pt-5">
      <legend className="font-medium">Ringtone</legend>
      <p className="text-sm text-ink/60">What this phone plays when someone calls you and Grace is open. It plays at your phone&apos;s media volume — turn that up to hear it loudly.</p>
      <ul className="mt-3 space-y-1.5">
        {options.map((t) => (
          <li key={t} className="flex items-center justify-between gap-3 rounded-xl border border-line px-3 py-2">
            <label className="flex min-w-0 flex-1 cursor-pointer items-center gap-2.5 text-sm">
              <input type="radio" name="ringtone" checked={tone === t} onChange={() => pick(t)} className="h-4 w-4 shrink-0" />
              <span className="truncate">{t === "custom" ? `My own song: ${song}` : RINGTONES[t]}</span>
            </label>
            <span className="flex shrink-0 items-center gap-1">
              <button type="button" className="btn-ghost btn-icon h-9 w-9 rounded-full" onClick={() => preview(t)} aria-label={playing === t ? "Stop" : `Play ${t === "custom" ? song : RINGTONES[t]}`}>
                {playing === t ? <Square aria-hidden className="h-4 w-4" /> : <Play aria-hidden className="h-4 w-4" />}
              </button>
              {t === "custom" && (
                <button type="button" className="btn-ghost btn-icon h-9 w-9 rounded-full" onClick={removeSong} aria-label="Remove my song">
                  <Trash2 aria-hidden className="h-4 w-4" />
                </button>
              )}
            </span>
          </li>
        ))}
      </ul>
      {trim && <Trimmer trim={trim} onChange={(t) => setTrim(t)} onPreview={previewClip} previewing={playing === "custom"} onSave={saveClip} onCancel={() => (stop(), setTrim(null))} busy={busy} />}
      {!trim && (
        <button type="button" className="btn-secondary mt-3" onClick={() => fileRef.current?.click()} disabled={busy}>
          <Music aria-hidden className="h-4 w-4" /> {busy ? "Opening…" : song ? "Choose a different song" : "Use my own song"}
        </button>
      )}
      <input ref={fileRef} type="file" accept="audio/*,.mp3,.m4a,.aac,.wav,.ogg" className="sr-only" onChange={onFile} aria-label="Choose a song for your ringtone" />
      <p className="mt-2 text-xs text-ink/60">Pick a song saved on this phone (e.g. a worship song you&apos;ve bought), then choose the few seconds to use — only that clip is kept, so it takes little space. It stays on this phone; nobody else receives it.</p>
      <details className="mt-3 text-sm text-ink/70">
        <summary className="cursor-pointer font-medium">When Grace is closed</summary>
        <p className="mt-2">
          A closed app can&apos;t play its own tune — your phone shows a call pop-up instead, and it keeps buzzing while you&apos;re being called. To make that loud, give Grace&apos;s notifications a ringtone:
        </p>
        <ul className="mt-2 list-disc space-y-1 pl-5">
          <li>
            <strong>Android, installed app:</strong> Settings → Apps → Grace → Notifications → tap the notification category → Sound → choose a loud ringtone (you can pick a song saved on your phone here too).
          </li>
          <li>
            <strong>Android, in Chrome:</strong> Settings → Apps → Chrome → Notifications → find this site → Sound.
          </li>
          <li>
            <strong>iPhone:</strong> the sound can&apos;t be changed; make sure Grace&apos;s notifications are on with Sounds in Settings → Notifications → Grace.
          </li>
        </ul>
      </details>
    </fieldset>
  );
}

const clock = (s: number) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, "0")}`;

/** Choose where the clip starts and how long it is; preview; save. */
function Trimmer({
  trim,
  onChange,
  onPreview,
  previewing,
  onSave,
  onCancel,
  busy,
}: {
  trim: { song: AudioBuffer; name: string; start: number; length: number };
  onChange: (t: { song: AudioBuffer; name: string; start: number; length: number }) => void;
  onPreview: () => void;
  previewing: boolean;
  onSave: () => void;
  onCancel: () => void;
  busy: boolean;
}) {
  const duration = trim.song.duration;
  const lengths = CLIP_LENGTHS.filter((l) => l <= Math.max(CLIP_LENGTHS[0], duration));
  const maxStart = Math.max(0, duration - trim.length);
  return (
    <div className="mt-3 space-y-4 rounded-2xl border border-gold/50 bg-gold/5 p-4">
      <p className="flex items-center gap-2 font-semibold">
        <Scissors aria-hidden className="h-4 w-4" /> Choose your clip from “{trim.name}”
      </p>
      <div>
        <label htmlFor="clip-start" className="text-sm font-medium">
          Starts at <span className="tabular">{clock(trim.start)}</span> · ends at <span className="tabular">{clock(Math.min(duration, trim.start + trim.length))}</span>{" "}
          <span className="text-ink/60">(song is {clock(duration)})</span>
        </label>
        <input
          id="clip-start"
          type="range"
          min={0}
          max={maxStart}
          step={0.5}
          value={Math.min(trim.start, maxStart)}
          onChange={(e) => onChange({ ...trim, start: Number(e.target.value) })}
          className="mt-2 w-full accent-[rgb(var(--gold))]"
        />
        <p className="text-xs text-ink/60">Slide to the part you love — the chorus works well.</p>
      </div>
      <fieldset>
        <legend className="text-sm font-medium">Length</legend>
        <div className="mt-1.5 flex flex-wrap gap-2">
          {lengths.map((l) => (
            <button
              key={l}
              type="button"
              aria-pressed={trim.length === l}
              onClick={() => onChange({ ...trim, length: l, start: Math.min(trim.start, Math.max(0, duration - l)) })}
              className={`rounded-full border px-3 py-1.5 text-sm ${trim.length === l ? "border-gold bg-gold/15 font-semibold" : "border-line"}`}
            >
              {l} s
            </button>
          ))}
        </div>
        <p className="mt-1 text-xs text-ink/60">About {Math.round((trim.length * 44) / 10) * 10} KB on your phone.</p>
      </fieldset>
      <div className="flex flex-wrap gap-2">
        <button type="button" className="btn-secondary" onClick={onPreview}>
          {previewing ? <Square aria-hidden className="h-4 w-4" /> : <Play aria-hidden className="h-4 w-4" />} {previewing ? "Stop" : "Preview"}
        </button>
        <button type="button" className="btn-primary" onClick={onSave} disabled={busy}>
          {busy ? "Saving…" : "Save as ringtone"}
        </button>
        <button type="button" className="btn-ghost" onClick={onCancel}>
          Cancel
        </button>
      </div>
    </div>
  );
}

