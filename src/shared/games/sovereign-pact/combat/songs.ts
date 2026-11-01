// Minstrel songs (§12.2, §12.11): three layers, one song each. A song reaches every hearer on its side
// who is not Deaf, as a status that carries the song's mods, and ends with the Minstrel (status.ts endSongs).
import type { Rng } from "../../../rng.ts";
import { hasStatus, standing } from "./grid.ts";
import { addStatus, endSongs, tryStatus } from "./status.ts";
import type { AbilityDef, Battle, Combatant } from "./types.ts";

/** Plays `ab` in its layer, replacing what played there. */
export function playSong(b: Battle, rng: Rng, u: Combatant, ab: AbilityDef): void {
  const { layer, mods } = ab.song!;
  const replacing = !!u.songs?.[layer];
  if (replacing) endSongs(b, u, layer);
  (u.songs ??= {})[layer] = ab.id;
  const side = ab.side === "foe" ? (u.side === "party" ? "enemy" : "party") : u.side;
  const hearers = standing(b, side).filter((t) => !hasStatus(t, "deaf"));
  for (const t of hearers) {
    addStatus(b, t, ab.id, 0, { src: u.id, mods: { ...mods } });
    for (const s of ab.statuses ?? []) if (!s.tag || t.tags.includes(s.tag)) tryStatus(b, rng, t, s.id, s.chance, s.ticks, s.value);
  }
  // Heartstring: replacing a layer steadies every ally.
  if (replacing && u.mods.heartstring)
    for (const t of standing(b, u.side)) if (t.maxSanity) t.sanity = Math.min(t.maxSanity, t.sanity + Math.round((t.maxSanity * u.mods.heartstring) / 100));
  b.events.push({ t: "use", unit: u.id, ability: ab.id, target: { side, col: 0, row: 0 } });
}
