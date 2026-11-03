// Minstrel songs (§12.2, §12.11): three layers, one song each. A song reaches every hearer on its side
// who is not Deaf, as a status that carries the song's mods, and ends with the Minstrel (status.ts endSongs).
import type { Rng } from "../../../rng.ts";
import { hasStatus, standing } from "./grid.ts";
import { addStatus, endSongs, tryStatus } from "./status.ts";
import { TUNING } from "../tuning.ts";
import type { AbilityDef, Battle, Combatant, SongLayer } from "./types.ts";

const scaled = (mods: Record<string, number>, k: number) => Object.fromEntries(Object.entries(mods).map(([m, v]) => [m, Math.round(v * k)]));

/** Crescendo (§12.11): at the Minstrel's turn, each layer that has played 300 ticks swells by half, once. */
export function crescendo(b: Battle, u: Combatant): void {
  if (!u.mods.crescendo || !u.songs) return;
  for (const [layer, id] of Object.entries(u.songs) as [SongLayer, string][]) {
    if (u.swelled?.includes(layer) || b.tick - (u.songSince?.[layer] ?? b.tick) < TUNING.combat.minstrel.crescendoTicks) continue;
    const song = u.abilities.find((a) => a.id === id)?.song;
    if (!song) continue;
    (u.swelled ??= []).push(layer);
    for (const t of b.units) {
      const s = t.statuses.find((x) => x.id === id && x.src === u.id);
      if (s) addStatus(b, t, id, 0, { src: u.id, mods: scaled(song.mods, (hasStatus(t, "deaf") ? 0.5 : 1) * (1 + TUNING.combat.minstrel.crescendoPct / 100)) });
    }
  }
}

/** The Finale a Minstrel with the passive may play once all three layers sound (§12.11). */
export const FINALE: AbilityDef = { id: "finale", name: "Finale", shape: "all", side: "foe", power: 2, kind: "magic", finale: true, cost: 100 };

/** Plays `ab` in its layer, replacing what played there. */
export function playSong(b: Battle, rng: Rng, u: Combatant, ab: AbilityDef): void {
  const { layer, mods } = ab.song!;
  const replacing = !!u.songs?.[layer];
  if (replacing) endSongs(b, u, layer);
  (u.songs ??= {})[layer] = ab.id;
  (u.songSince ??= {})[layer] = b.tick;
  u.swelled = (u.swelled ?? []).filter((l) => l !== layer);
  const side = ab.side === "foe" ? (u.side === "party" ? "enemy" : "party") : u.side;
  // Carrying Voice (§12.11): an ally's song reaches the Deaf too, at half.
  const carries = !!u.mods.carryingVoice && side === u.side;
  const hearers = standing(b, side).filter((t) => carries || !hasStatus(t, "deaf"));
  for (const t of hearers) {
    const half = hasStatus(t, "deaf") ? 0.5 : 1;
    addStatus(b, t, ab.id, 0, { src: u.id, mods: scaled(mods, half) });
    for (const s of ab.statuses ?? []) if (!s.tag || t.tags.includes(s.tag)) tryStatus(b, rng, t, s.id, s.chance, s.ticks, s.value);
  }
  // Heartstring: replacing a layer steadies every ally.
  if (replacing && u.mods.heartstring)
    for (const t of standing(b, u.side)) if (t.maxSanity) t.sanity = Math.min(t.maxSanity, t.sanity + Math.round((t.maxSanity * u.mods.heartstring) / 100));
  b.events.push({ t: "use", unit: u.id, ability: ab.id, target: { side, col: 0, row: 0 } });
}
