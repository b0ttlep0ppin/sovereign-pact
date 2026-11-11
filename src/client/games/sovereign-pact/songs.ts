// A Minstrel's songs on the field (Josh 2026-11-11: "musical notes" flying to those a song reaches,
// and "a couple" of notes played, "unique for each song"). Each song has its colour and a short motif,
// played on a small synthesised voice: a plucked lute, a breathy pipe, a low drone or a drum.

export type Voice = "lute" | "pipe" | "drone" | "drum";

export interface SongLook {
  color: string;
  voice: Voice;
  /** The motif's root, in Hz. */
  root: number;
  /** Seconds per beat. */
  beat: number;
  /** Each note: semitones above the root, and how many beats it lasts. */
  notes: readonly (readonly [semitones: number, beats: number])[];
}

const SONGS: Record<string, SongLook> = {
  // Melodies: a step for the feet, iron for the skin, embers for the steel.
  march: { color: "#e0b060", voice: "lute", root: 293.7, beat: 0.13, notes: [[0, 1], [5, 1], [7, 2]] },
  hymn_of_iron: { color: "#b8c4d0", voice: "drone", root: 196, beat: 0.22, notes: [[0, 2], [7, 2], [12, 3]] },
  ballad_of_embers: { color: "#ff8a3a", voice: "lute", root: 329.6, beat: 0.14, notes: [[0, 1], [3, 1], [7, 1], [10, 2]] },
  // Harmonies sung at the foe: a soft fall to sleep, a mourning fall, a jeer, a long dying close.
  lullaby: { color: "#a8b8ff", voice: "pipe", root: 440, beat: 0.24, notes: [[7, 2], [4, 2], [0, 3]] },
  dirge: { color: "#a090c0", voice: "drone", root: 146.8, beat: 0.26, notes: [[0, 2], [1, 2], [-2, 4]] },
  mockery: { color: "#d8c040", voice: "lute", root: 523.3, beat: 0.09, notes: [[0, 1], [2, 1], [0, 1], [-5, 2]] },
  requiem: { color: "#c0c8e0", voice: "pipe", root: 220, beat: 0.26, notes: [[0, 2], [3, 2], [-2, 4]] },
  // Choruses: the hearth's warm chord, water trickling down, the drum, clean air, the plague's tritone.
  hearthsong: { color: "#f0a860", voice: "lute", root: 349.2, beat: 0.15, notes: [[0, 1], [4, 1], [7, 1], [12, 2]] },
  fountain: { color: "#7ac8f0", voice: "pipe", root: 523.3, beat: 0.12, notes: [[12, 1], [7, 1], [9, 1], [4, 2]] },
  drumbeat: { color: "#d06040", voice: "drum", root: 90, beat: 0.15, notes: [[0, 1], [0, 1], [5, 0.5], [0, 2]] },
  cleansing_air: { color: "#c8f0e0", voice: "pipe", root: 659.3, beat: 0.16, notes: [[0, 1], [7, 1], [12, 3]] },
  plague_chant: { color: "#8ab040", voice: "drone", root: 130.8, beat: 0.24, notes: [[0, 2], [6, 2], [1, 3]] },
};

const PLAIN: SongLook = { color: "#e0c890", voice: "lute", root: 392, beat: 0.15, notes: [[0, 1], [7, 2]] };

export const songLook = (id: string): SongLook => SONGS[id] ?? PLAIN;

/** The notes drawn in flight, in turn. */
export const NOTE_GLYPHS = ["♪", "♫", "♩", "♬"] as const;

let ctx: AudioContext | null | undefined;
function audio(): AudioContext | null {
  if (ctx !== undefined) return ctx;
  const Ctor = (globalThis as { AudioContext?: typeof AudioContext; webkitAudioContext?: typeof AudioContext }).AudioContext ?? (globalThis as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  try {
    ctx = Ctor ? new Ctor() : null;
  } catch {
    ctx = null;
  }
  return ctx;
}

/** One note on a voice, at `t` (the context's time), `len` seconds long, into `out`. */
function note(a: AudioContext, out: AudioNode, voice: Voice, hz: number, t: number, len: number): void {
  const env = a.createGain();
  env.connect(out);
  const osc = (type: OscillatorType, f: number, gain: number) => {
    const o = a.createOscillator();
    o.type = type;
    o.frequency.setValueAtTime(f, t);
    const g = a.createGain();
    g.gain.value = gain;
    o.connect(g).connect(env);
    o.start(t);
    o.stop(t + len + 0.8);
    return o;
  };
  if (voice === "lute") {
    // A pluck: bright at once, dulling as it rings.
    const lp = a.createBiquadFilter();
    lp.type = "lowpass";
    lp.frequency.setValueAtTime(hz * 8, t);
    lp.frequency.exponentialRampToValueAtTime(hz * 1.5, t + 0.5);
    lp.connect(env);
    for (const [type, f, g] of [["triangle", hz, 0.7], ["sawtooth", hz, 0.25], ["sine", hz * 2, 0.15]] as const) {
      const o = a.createOscillator();
      o.type = type;
      o.frequency.setValueAtTime(f, t);
      const gg = a.createGain();
      gg.gain.value = g;
      o.connect(gg).connect(lp);
      o.start(t);
      o.stop(t + len + 0.8);
    }
    env.gain.setValueAtTime(0, t);
    env.gain.linearRampToValueAtTime(1, t + 0.005);
    env.gain.exponentialRampToValueAtTime(0.001, t + len + 0.6);
  } else if (voice === "pipe") {
    // Breath: a soft swell, a little vibrato, a falling-off.
    const o = osc("sine", hz, 0.8);
    osc("triangle", hz * 2, 0.08);
    const lfo = a.createOscillator();
    lfo.frequency.value = 5;
    const depth = a.createGain();
    depth.gain.value = hz * 0.006;
    lfo.connect(depth).connect(o.frequency);
    lfo.start(t);
    lfo.stop(t + len + 0.8);
    env.gain.setValueAtTime(0, t);
    env.gain.linearRampToValueAtTime(0.8, t + 0.06);
    env.gain.setValueAtTime(0.7, t + len);
    env.gain.exponentialRampToValueAtTime(0.001, t + len + 0.35);
  } else if (voice === "drone") {
    // A low reed with its fifth below, muffled.
    const lp = a.createBiquadFilter();
    lp.type = "lowpass";
    lp.frequency.value = 700;
    lp.connect(env);
    for (const [f, g] of [[hz, 0.5], [hz * 0.75, 0.25], [hz * 1.005, 0.3]] as const) {
      const o = a.createOscillator();
      o.type = "sawtooth";
      o.frequency.setValueAtTime(f, t);
      const gg = a.createGain();
      gg.gain.value = g;
      o.connect(gg).connect(lp);
      o.start(t);
      o.stop(t + len + 0.8);
    }
    env.gain.setValueAtTime(0, t);
    env.gain.linearRampToValueAtTime(0.7, t + 0.08);
    env.gain.setValueAtTime(0.6, t + len);
    env.gain.exponentialRampToValueAtTime(0.001, t + len + 0.5);
  } else {
    // A skin drum: a thump falling in pitch.
    const o = osc("sine", hz * 1.8, 1);
    o.frequency.exponentialRampToValueAtTime(hz * 0.6, t + 0.18);
    env.gain.setValueAtTime(0, t);
    env.gain.linearRampToValueAtTime(1, t + 0.004);
    env.gain.exponentialRampToValueAtTime(0.001, t + 0.35);
  }
}

/** Plays a song's motif at `volume` (0–1). Silent where the browser has no Web Audio. */
export function playSong(id: string, volume: number): void {
  const a = audio();
  if (!a || volume <= 0) return;
  if (a.state === "suspended") a.resume().catch(() => undefined);
  const s = songLook(id);
  const out = a.createGain();
  out.gain.value = Math.min(1, volume) * (s.voice === "drum" ? 0.5 : 0.22);
  out.connect(a.destination);
  let t = a.currentTime + 0.02;
  for (const [semi, beats] of s.notes) {
    const len = beats * s.beat;
    note(a, out, s.voice, s.root * 2 ** (semi / 12), t, len);
    t += len;
  }
}
