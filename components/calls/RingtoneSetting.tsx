"use client";

import { useEffect, useRef, useState } from "react";
import { Play, Square } from "lucide-react";
import { RINGTONES, chooseRingtone, chosenRingtone, startRinging, type Ringtone } from "@/lib/call-sounds";

/**
 * My account → Notifications → Ringtone: the tune this phone plays for an
 * incoming call while the app is open. Saved on this phone only.
 */
export function RingtoneSetting() {
  const [tone, setTone] = useState<Ringtone>("amazing_grace");
  const [playing, setPlaying] = useState<Ringtone | null>(null);
  const stopRef = useRef<(() => void) | null>(null);

  useEffect(() => {
    setTone(chosenRingtone());
    return () => stopRef.current?.();
  }, []);

  function preview(t: Ringtone) {
    stopRef.current?.();
    stopRef.current = null;
    if (playing === t) return setPlaying(null);
    stopRef.current = startRinging(t);
    setPlaying(t);
    // One play-through is enough for a preview.
    setTimeout(() => {
      if (stopRef.current) {
        stopRef.current();
        stopRef.current = null;
        setPlaying((p) => (p === t ? null : p));
      }
    }, 9000);
  }

  return (
    <fieldset className="mt-5 border-t border-line pt-5">
      <legend className="font-medium">Ringtone</legend>
      <p className="text-sm text-ink/60">What this phone plays when someone calls you and Grace is open. Turn your phone&apos;s media volume up to hear it loudly.</p>
      <ul className="mt-3 space-y-1.5">
        {(Object.keys(RINGTONES) as Ringtone[]).map((t) => (
          <li key={t} className="flex items-center justify-between gap-3 rounded-xl border border-line px-3 py-2">
            <label className="flex flex-1 cursor-pointer items-center gap-2.5 text-sm">
              <input
                type="radio"
                name="ringtone"
                checked={tone === t}
                onChange={() => {
                  setTone(t);
                  chooseRingtone(t);
                }}
                className="h-4 w-4"
              />
              {RINGTONES[t]}
            </label>
            <button type="button" className="btn-ghost btn-icon h-9 w-9 rounded-full" onClick={() => preview(t)} aria-label={playing === t ? `Stop ${RINGTONES[t]}` : `Play ${RINGTONES[t]}`}>
              {playing === t ? <Square aria-hidden className="h-4 w-4" /> : <Play aria-hidden className="h-4 w-4" />}
            </button>
          </li>
        ))}
      </ul>
      <details className="mt-3 text-sm text-ink/70">
        <summary className="cursor-pointer font-medium">When Grace is closed</summary>
        <p className="mt-2">
          A closed app can&apos;t play its own tune — your phone shows a call pop-up instead, and it keeps buzzing while you&apos;re being called. To make that loud, give Grace&apos;s notifications a ringtone:
        </p>
        <ul className="mt-2 list-disc space-y-1 pl-5">
          <li>
            <strong>Android, installed app:</strong> Settings → Apps → Grace → Notifications → tap the notification category → Sound → choose a loud ringtone.
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
