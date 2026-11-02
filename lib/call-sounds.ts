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
  rise_up: "Rise Up — upbeat worship",
  custom: "My own song",
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
  return "rise_up";
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
const TUNES: Record<Exclude<Ringtone, "classic" | "rise_up" | "custom">, { beat: number; notes: Note[] }> = {
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

// ---------------------------------------------------------------------------
// "Rise Up": an original, upbeat worship-style loop written for Grace (not a
// copy of any song) — four-on-the-floor kick, claps, a driving bass and a
// bright lead, 128 beats a minute, over a I–V–vi–IV progression in G.
// ---------------------------------------------------------------------------
const RISE_BPM = 128;
// Bass and lead per half bar (G, D, Em, C), in eighth notes.
const RISE_BASS = ["G2", "D2", "E2", "C2"];
const RISE_LEAD: (string | null)[] = [
  "B4", "D5", "G5", "D5", "A5", "G5", "F#5", "D5",
  "E5", "G5", "B5", "G5", "A5", "G5", "E5", "D5",
  "B4", "D5", "G5", "A5", "B5", "A5", "G5", "F#5",
  "E5", "G5", "C6", "B5", "A5", null, "G5", null,
];

function kick(ctx: AudioContext, out: AudioNode, t: number) {
  const osc = ctx.createOscillator();
  const g = ctx.createGain();
  osc.frequency.setValueAtTime(150, t);
  osc.frequency.exponentialRampToValueAtTime(45, t + 0.12);
  g.gain.setValueAtTime(1, t);
  g.gain.exponentialRampToValueAtTime(0.001, t + 0.22);
  osc.connect(g).connect(out);
  osc.start(t);
  osc.stop(t + 0.25);
}

function clap(ctx: AudioContext, out: AudioNode, t: number) {
  const length = Math.floor(ctx.sampleRate * 0.15);
  const buffer = ctx.createBuffer(1, length, ctx.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < length; i++) data[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / length, 3);
  const src = ctx.createBufferSource();
  const filter = ctx.createBiquadFilter();
  const g = ctx.createGain();
  src.buffer = buffer;
  filter.type = "bandpass";
  filter.frequency.value = 1500;
  g.gain.value = 0.7;
  src.connect(filter).connect(g).connect(out);
  src.start(t);
}

function tone(ctx: AudioContext, out: AudioNode, note: string, t: number, length: number, type: OscillatorType, level: number) {
  const osc = ctx.createOscillator();
  const g = ctx.createGain();
  osc.type = type;
  osc.frequency.value = frequency(note);
  g.gain.setValueAtTime(0, t);
  g.gain.linearRampToValueAtTime(level, t + 0.01);
  g.gain.exponentialRampToValueAtTime(level * 0.3, t + length * 0.9);
  g.gain.linearRampToValueAtTime(0, t + length);
  osc.connect(g).connect(out);
  osc.start(t);
  osc.stop(t + length + 0.02);
}

/** Plays four bars of "Rise Up". Returns its length in seconds. */
function playRiseUp(ctx: AudioContext, volume: number): number {
  const beat = 60 / RISE_BPM;
  const eighth = beat / 2;
  const start = ctx.currentTime + 0.05;
  const master = ctx.createGain();
  master.gain.value = volume;
  const softener = ctx.createBiquadFilter(); // takes the harsh edge off the lead
  softener.type = "lowpass";
  softener.frequency.value = 3200;
  softener.connect(master);
  // Loud but never crackly on a small phone speaker.
  const limiter = ctx.createDynamicsCompressor();
  limiter.threshold.value = -12;
  limiter.knee.value = 6;
  limiter.ratio.value = 8;
  limiter.attack.value = 0.003;
  limiter.release.value = 0.1;
  master.connect(limiter).connect(ctx.destination);
  const bars = 4;
  for (let b = 0; b < bars * 4; b++) {
    const t = start + b * beat;
    kick(ctx, master, t);
    if (b % 2 === 1) clap(ctx, master, t);
  }
  for (let i = 0; i < bars * 8; i++) {
    const t = start + i * eighth;
    tone(ctx, master, RISE_BASS[Math.floor(i / 4) % 4], t, eighth * 0.9, "sawtooth", 0.18);
    const lead = RISE_LEAD[i % RISE_LEAD.length];
    if (lead) tone(ctx, softener, lead, t, eighth * 0.95, "square", 0.12);
  }
  return bars * 4 * beat;
}

// ---------------------------------------------------------------------------
// "My own song": an audio file the person picked, kept only on this phone
// (IndexedDB), never uploaded. Played on a loop while a call rings.
// ---------------------------------------------------------------------------
const DB_NAME = "grace-ringtone";
/** Songs bigger than this aren't opened (only the chosen clip is ever kept). */
const MAX_SONG_BYTES = 40 * 1024 * 1024;
/** Clip lengths offered when trimming a song (seconds). */
export const CLIP_LENGTHS = [10, 15, 20, 30] as const;
const CLIP_RATE = 22050; // mono, 22 kHz: clear on a phone speaker, small on disk

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = () => req.result.createObjectStore("files");
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function idb<T>(mode: IDBTransactionMode, run: (store: IDBObjectStore) => IDBRequest): Promise<T> {
  const db = await openDb();
  return new Promise<T>((resolve, reject) => {
    const req = run(db.transaction("files", mode).objectStore("files"));
    req.onsuccess = () => resolve(req.result as T);
    req.onerror = () => reject(req.error);
  });
}

/** Opens a song so a clip can be chosen. Returns a message instead if it can't be read. */
export async function decodeSong(file: File): Promise<AudioBuffer | string> {
  if (!file.type.startsWith("audio/") && !/\.(mp3|m4a|aac|wav|ogg|opus)$/i.test(file.name)) return "Choose a song or audio file (MP3, M4A, WAV…).";
  if (file.size > MAX_SONG_BYTES) return "That file is too big to open (over 40 MB).";
  try {
    const AudioCtx = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    const ctx = new AudioCtx();
    const buffer = await ctx.decodeAudioData(await file.arrayBuffer());
    ctx.close().catch(() => undefined);
    return buffer;
  } catch {
    return "This phone couldn't play that file. Try an MP3 or M4A.";
  }
}

/**
 * Cuts `seconds` of the song from `start`, with a short fade in and out, as
 * a small mono WAV (about 44 KB a second) — so only the chosen clip is kept.
 */
export async function makeClip(song: AudioBuffer, start: number, seconds: number): Promise<Blob> {
  const from = Math.max(0, Math.min(start, Math.max(0, song.duration - 1)));
  const length = Math.max(1, Math.min(seconds, song.duration - from));
  const offline = new OfflineAudioContext(1, Math.ceil(length * CLIP_RATE), CLIP_RATE);
  const src = offline.createBufferSource();
  src.buffer = song;
  const fade = offline.createGain();
  const fadeTime = Math.min(0.6, length / 4);
  fade.gain.setValueAtTime(0, 0);
  fade.gain.linearRampToValueAtTime(1, fadeTime);
  fade.gain.setValueAtTime(1, length - fadeTime);
  fade.gain.linearRampToValueAtTime(0, length);
  src.connect(fade).connect(offline.destination);
  src.start(0, from, length);
  const out = await offline.startRendering();
  return wav(out.getChannelData(0), CLIP_RATE);
}

function wav(samples: Float32Array, rate: number): Blob {
  const view = new DataView(new ArrayBuffer(44 + samples.length * 2));
  const text = (offset: number, value: string) => [...value].forEach((c, i) => view.setUint8(offset + i, c.charCodeAt(0)));
  text(0, "RIFF");
  view.setUint32(4, 36 + samples.length * 2, true);
  text(8, "WAVE");
  text(12, "fmt ");
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, 1, true);
  view.setUint32(24, rate, true);
  view.setUint32(28, rate * 2, true);
  view.setUint16(32, 2, true);
  view.setUint16(34, 16, true);
  text(36, "data");
  view.setUint32(40, samples.length * 2, true);
  let peak = 0;
  for (const x of samples) peak = Math.max(peak, Math.abs(x));
  const gain = peak > 0 ? Math.min(4, 0.98 / peak) : 1; // as loud as it can go without crackling
  for (let i = 0; i < samples.length; i++) view.setInt16(44 + i * 2, Math.max(-1, Math.min(1, samples[i] * gain)) * 32767, true);
  return new Blob([view], { type: "audio/wav" });
}

/** Saves the chosen clip as this phone's ringtone (replacing any earlier one). Returns a message if it can't. */
export async function saveCustomRingtone(clip: Blob, name: string): Promise<string | null> {
  try {
    await idb("readwrite", (store) => store.put({ blob: clip, name }, "custom"));
    chooseRingtone("custom");
    return null;
  } catch {
    return "Couldn't save it on this phone (storage may be full or blocked).";
  }
}

export async function customRingtone(): Promise<{ blob: Blob; name: string } | null> {
  try {
    return (await idb<{ blob: Blob; name: string } | undefined>("readonly", (store) => store.get("custom"))) ?? null;
  } catch {
    return null;
  }
}

export async function removeCustomRingtone(): Promise<void> {
  try {
    await idb("readwrite", (store) => store.delete("custom"));
  } catch {
    // Nothing saved.
  }
  if (chosenRingtone() === "custom") chooseRingtone("rise_up");
}

/** Incoming call: the chosen ringtone, repeating, with vibration. `tone` overrides the saved choice (for previews). */
export function startRinging(choice: Ringtone = chosenRingtone()): () => void {
  if (choice === "custom") {
    // Their own song on a loop, full volume; "Rise Up" if it's missing or won't play.
    let stopped = false;
    let fallback: (() => void) | null = null;
    const audio = new Audio();
    audio.loop = true;
    audio.volume = 1;
    const buzz = setInterval(() => navigator.vibrate?.([800, 400, 800]), 2400);
    navigator.vibrate?.([800, 400, 800]);
    customRingtone().then((song) => {
      if (stopped) return;
      if (!song) return void (fallback = startRinging("rise_up"));
      audio.src = URL.createObjectURL(song.blob);
      audio.play().catch(() => {
        if (!stopped) fallback = startRinging("rise_up");
      });
    });
    return () => {
      stopped = true;
      clearInterval(buzz);
      navigator.vibrate?.(0);
      audio.pause();
      if (audio.src) URL.revokeObjectURL(audio.src);
      fallback?.();
    };
  }
  const ctx = audioContext();
  if (choice === "classic") {
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
  if (choice === "rise_up") {
    const seconds = (4 * 4 * 60) / RISE_BPM;
    return repeat(
      () => {
        navigator.vibrate?.([600, 300, 600, 300, 600]);
        if (ctx && ctx.state !== "closed") playRiseUp(ctx, 0.75);
      },
      Math.round(seconds * 1000),
      ctx,
      true
    );
  }
  const tune = TUNES[choice];
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
