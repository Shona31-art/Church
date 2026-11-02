// Call sounds made in the browser (no sound files), like a phone:
//   startRinging()  — the incoming ring (two bursts, repeating) + vibration;
//   startRingback() — what the caller hears while it rings at the other end.
// Browsers only play sound after the person has tapped something on the
// page; if it's blocked, nothing breaks — the screen still shows the call.

type Stop = () => void;

function audioContext(): AudioContext | null {
  try {
    const AudioCtx = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    const ctx = AudioCtx ? new AudioCtx() : null;
    ctx?.resume().catch(() => undefined);
    return ctx;
  } catch {
    return null;
  }
}

/** Plays `freqs` together for each [start, length] burst (seconds), at `volume`. */
function burst(ctx: AudioContext, freqs: number[], bursts: [number, number][], volume: number) {
  const start = ctx.currentTime + 0.05;
  const gain = ctx.createGain();
  gain.connect(ctx.destination);
  gain.gain.setValueAtTime(0, start);
  let end = start;
  for (const [offset, length] of bursts) {
    gain.gain.linearRampToValueAtTime(volume, start + offset + 0.03);
    gain.gain.setValueAtTime(volume, start + offset + length - 0.05);
    gain.gain.linearRampToValueAtTime(0, start + offset + length);
    end = Math.max(end, start + offset + length);
  }
  for (const freq of freqs) {
    const osc = ctx.createOscillator();
    osc.type = "sine";
    osc.frequency.value = freq;
    osc.connect(gain);
    osc.start(start);
    osc.stop(end + 0.05);
  }
}

function repeat(play: () => void, everyMs: number, ctx: AudioContext | null, vibrate: boolean): Stop {
  play();
  const timer = setInterval(play, everyMs);
  return () => {
    clearInterval(timer);
    if (vibrate) navigator.vibrate?.(0);
    ctx?.close().catch(() => undefined);
  };
}

// ---------------------------------------------------------------------------
// Ringtones for incoming calls. Hymn tunes are long out of copyright and are
// played note by note here (no sound files). Each phone remembers its own
// choice (My account → Notifications → Ringtone).
// ---------------------------------------------------------------------------

export const RINGTONES = {
  amazing_grace: "Amazing Grace",
  joyful: "Joyful, Joyful (Ode to Joy)",
  how_great: "Holy, Holy, Holy",
  classic: "Classic phone ring",
} as const;
export type Ringtone = keyof typeof RINGTONES;
const STORAGE_KEY = "grace-ringtone";

export function chosenRingtone(): Ringtone {
  try {
    const value = localStorage.getItem(STORAGE_KEY);
    if (value && value in RINGTONES) return value as Ringtone;
  } catch {
    // Storage blocked (private mode): use the default.
  }
  return "amazing_grace";
}

export function chooseRingtone(tone: Ringtone) {
  try {
    localStorage.setItem(STORAGE_KEY, tone);
  } catch {
    // Not saved on this phone; the default still plays.
  }
}

// [note, beats] — note names with octave; beat length set per tune.
type Note = [string, number];
const TUNES: Record<Exclude<Ringtone, "classic">, { beat: number; notes: Note[] }> = {
  // "Amazing grace, how sweet the sound, that saved a wretch like me" (New Britain)
  amazing_grace: {
    beat: 0.42,
    notes: [["D5", 1], ["G5", 2], ["B5", 0.5], ["G5", 0.5], ["B5", 2], ["A5", 1], ["G5", 2], ["E5", 1], ["D5", 2], ["D5", 1], ["G5", 2], ["B5", 0.5], ["G5", 0.5], ["B5", 2], ["A5", 1], ["D6", 3]],
  },
  // "Joyful, joyful, we adore thee" (Beethoven)
  joyful: {
    beat: 0.36,
    notes: [["E5", 1], ["E5", 1], ["F5", 1], ["G5", 1], ["G5", 1], ["F5", 1], ["E5", 1], ["D5", 1], ["C5", 1], ["C5", 1], ["D5", 1], ["E5", 1], ["E5", 1.5], ["D5", 0.5], ["D5", 2]],
  },
  // "Holy, holy, holy! Lord God Almighty" (Nicaea)
  how_great: {
    beat: 0.4,
    notes: [["D5", 1], ["D5", 1], ["F#5", 1], ["F#5", 1], ["A5", 2], ["A5", 2], ["B5", 2], ["B5", 1], ["B5", 1], ["A5", 2], ["F#5", 2]],
  },
};

const SEMITONE: Record<string, number> = { C: -9, "C#": -8, D: -7, "D#": -6, E: -5, F: -4, "F#": -3, G: -2, "G#": -1, A: 0, "A#": 1, B: 2 };
function frequency(note: string): number {
  const m = /^([A-G]#?)(\d)$/.exec(note)!;
  return 440 * Math.pow(2, (SEMITONE[m[1]] + (Number(m[2]) - 4) * 12) / 12);
}

/** Plays a tune once, loud and clear (a bright tone with a soft bell-like edge). Returns its length in seconds. */
function playTune(ctx: AudioContext, tune: { beat: number; notes: Note[] }, volume: number): number {
  let t = ctx.currentTime + 0.05;
  const master = ctx.createGain();
  master.gain.value = volume;
  master.connect(ctx.destination);
  for (const [note, beats] of tune.notes) {
    const length = beats * tune.beat;
    for (const [type, level, mult] of [["triangle", 1, 1], ["sine", 0.35, 2]] as const) {
      const osc = ctx.createOscillator();
      const g = ctx.createGain();
      osc.type = type;
      osc.frequency.value = frequency(note) * mult;
      g.gain.setValueAtTime(0, t);
      g.gain.linearRampToValueAtTime(level, t + 0.02);
      g.gain.exponentialRampToValueAtTime(level * 0.35, t + Math.max(0.05, length * 0.9));
      g.gain.linearRampToValueAtTime(0, t + length);
      osc.connect(g).connect(master);
      osc.start(t);
      osc.stop(t + length + 0.02);
    }
    t += length;
  }
  return t - ctx.currentTime;
}

/** Incoming call: the chosen ringtone, repeating, with vibration. `tone` overrides the saved choice (for previews). */
export function startRinging(tone: Ringtone = chosenRingtone()): () => void {
  const ctx = audioContext();
  if (tone === "classic") {
    return repeat(
      () => {
        navigator.vibrate?.([700, 300, 700]);
        if (ctx && ctx.state !== "closed") burst(ctx, [440, 480], [[0, 0.6], [0.8, 0.6]], 0.35);
      },
      3000,
      ctx,
      true
    );
  }
  const tune = TUNES[tone];
  const seconds = tune.notes.reduce((n, [, beats]) => n + beats * tune.beat, 0);
  return repeat(
    () => {
      navigator.vibrate?.([800, 400, 800, 400, 800]);
      if (ctx && ctx.state !== "closed") playTune(ctx, tune, 0.6);
    },
    Math.round((seconds + 1.2) * 1000),
    ctx,
    true
  );
}

/** Outgoing call: a soft tone every few seconds until someone answers. */
export function startRingback(): Stop {
  const ctx = audioContext();
  return repeat(
    () => {
      if (ctx && ctx.state !== "closed") burst(ctx, [425], [[0, 1]], 0.08);
    },
    4000,
    ctx,
    false
  );
}
