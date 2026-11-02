// The music player (SPEC §16.2): one track at a time, looping, crossfading over 1.5 s when the screen
// changes. Browsers start sound only after the viewer has clicked or pressed something, so the first
// track waits for that. The viewer's on/off and volume are kept in this browser.
import { useEffect, useRef, useState } from "react";
import { TRACKS, trackUrl, type TrackId } from "./music";

const KEY = "sovereign-pact:music";
const FADE_MS = 1500;

export interface MusicSettings {
  on: boolean;
  volume: number;
  /** Battle sound effects (§16.1), and their volume. */
  sfx: boolean;
  sfxVolume: number;
}

const DEFAULTS: MusicSettings = { on: true, volume: 0.5, sfx: true, sfxVolume: 0.7 };

function read(): MusicSettings {
  try {
    const raw = globalThis.localStorage?.getItem(KEY);
    return raw ? { ...DEFAULTS, ...(JSON.parse(raw) as Partial<MusicSettings>) } : DEFAULTS;
  } catch {
    return DEFAULTS;
  }
}

/** Test runners and browsers without media playback get no player. */
const canPlay = (): boolean => typeof Audio !== "undefined" && !globalThis.navigator?.userAgent?.includes("jsdom");

export function useMusicSettings(): [MusicSettings, (next: MusicSettings) => void] {
  const [settings, setSettings] = useState(read);
  const set = (next: MusicSettings) => {
    setSettings(next);
    try {
      globalThis.localStorage?.setItem(KEY, JSON.stringify(next));
    } catch {
      // Storage blocked: the choice lasts this visit.
    }
  };
  return [settings, set];
}

/** Fades `audio` to `to` over the fade time, then calls `done`. */
function fade(audio: HTMLAudioElement, to: number, done?: () => void): () => void {
  const from = audio.volume;
  const start = performance.now();
  let raf = 0;
  const step = () => {
    const k = Math.min(1, (performance.now() - start) / FADE_MS);
    audio.volume = from + (to - from) * k;
    if (k < 1) raf = requestAnimationFrame(step);
    else done?.();
  };
  raf = requestAnimationFrame(step);
  return () => cancelAnimationFrame(raf);
}

/** Plays `track` (null: silence), crossfading from whatever played before. */
export function useMusic(track: TrackId | null, { on, volume }: MusicSettings): void {
  const current = useRef<{ id: TrackId; audio: HTMLAudioElement; cancel: () => void } | null>(null);
  const [heard, setHeard] = useState(false);
  // Wait for the viewer's first gesture: before it, play() is refused.
  useEffect(() => {
    if (heard || !canPlay()) return;
    const go = () => setHeard(true);
    window.addEventListener("pointerdown", go, { once: true });
    window.addEventListener("keydown", go, { once: true });
    return () => {
      window.removeEventListener("pointerdown", go);
      window.removeEventListener("keydown", go);
    };
  }, [heard]);
  useEffect(() => {
    if (!canPlay() || !heard) return;
    const want = on ? track : null;
    const was = current.current;
    if (was?.id === want) {
      if (was) {
        was.cancel();
        was.audio.volume = volume;
      }
      return;
    }
    // A fade in flight stops where it is, and the old track fades out from there.
    if (was) {
      was.cancel();
      const old = was.audio;
      fade(old, 0, () => old.pause());
    }
    current.current = null;
    if (want) {
      const audio = new Audio(trackUrl(want));
      audio.loop = true;
      audio.volume = 0;
      audio.play().catch(() => undefined);
      current.current = { id: want, audio, cancel: fade(audio, volume) };
    }
  }, [track, on, volume, heard]);
  useEffect(() => () => current.current?.audio.pause(), []);
}

export default function MusicPanel({ track, settings, set }: { track: TrackId | null; settings: MusicSettings; set: (next: MusicSettings) => void }) {
  const info = track ? TRACKS[track] : null;
  return (
    <div className="sp-music" aria-label="Music">
      <label className="sp-check">
        <input type="checkbox" checked={settings.on} onChange={(e) => set({ ...settings, on: e.target.checked })} /> Music
      </label>
      <input type="range" min={0} max={1} step={0.05} value={settings.volume} aria-label="Music volume" disabled={!settings.on} onChange={(e) => set({ ...settings, volume: Number(e.target.value) })} />
      <label className="sp-check">
        <input type="checkbox" checked={settings.sfx} onChange={(e) => set({ ...settings, sfx: e.target.checked })} /> Sound effects
      </label>
      <input type="range" min={0} max={1} step={0.05} value={settings.sfxVolume} aria-label="Sound effects volume" disabled={!settings.sfx} onChange={(e) => set({ ...settings, sfxVolume: Number(e.target.value) })} />
      {info && settings.on ? (
        <small>
          ♪ {info.title}, {info.author}
        </small>
      ) : null}
    </div>
  );
}
