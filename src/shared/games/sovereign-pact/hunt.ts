// Hunts and the bestiary (§14.9, §14.3). A Hunt card names a quarry of its pool: a titled enemy, a level
// up with half again its HP, with one trick (Enrage, Ambush, Call the Pack). One Encounter of the chain
// becomes its Lair; killing it pays its trophy (Valor for each House in the party, materials into the
// haul) and marks it slain for the campaign. The bestiary counts kills by enemy for every House to read;
// the first kill of an enemy is a new entry, Lore for each House in that fight.
import type { Rng } from "../../rng.ts";
import type { Battle } from "./combat/types.ts";
import { ENEMY_BY_ID, QUARRIES, QUARRY_BY_ID, type QuarryDef } from "./content.ts";
import type { NodeKind, SovState } from "./state.ts";
import { TUNING } from "./tuning.ts";
import { log } from "./year.ts";

const H = TUNING.hunt;

/** Quarries not yet slain this campaign. */
const alive = (s: SovState): QuarryDef[] => QUARRIES.filter((q) => !s.bestiary.quarries[q.id]);

/** A Hunt card's quarry: one of its pool's still alive, among those nearest the card's level. */
export function quarryFor(s: SovState, rng: Rng, pool: string, level: number): string | undefined {
  const far = (q: QuarryDef) => {
    const [lo, hi] = ENEMY_BY_ID.get(q.enemy)!.levels;
    return level < lo ? lo - level : Math.max(0, level - hi);
  };
  const here = alive(s).filter((q) => ENEMY_BY_ID.get(q.enemy)!.pool === pool);
  if (!here.length) return undefined;
  const best = Math.min(...here.map(far));
  return rng.pick(here.filter((q) => far(q) === best)).id;
}

/** The chain with one Encounter turned into the quarry's Lair (or a Lair before the boss, if it has none). */
export function withLair(rng: Rng, chain: NodeKind[]): NodeKind[] {
  const at = chain.flatMap((k, i) => (k === "encounter" ? [i] : []));
  if (!at.length) return [...chain.slice(0, -1), "lair", chain.at(-1)!];
  const i = rng.pick(at);
  return chain.map((k, j) => (j === i ? "lair" : k));
}

/** The Lair fight's quarry, for the encounter. */
export function lairOf(s: SovState): { enemy: string; title: string; ability: QuarryDef["ability"] } | undefined {
  const q = QUARRY_BY_ID.get(s.expedition?.card.quarry ?? "");
  return q && !s.bestiary.quarries[q.id] ? { enemy: q.enemy, title: q.title, ability: q.ability } : undefined;
}

/** The quarry falls: its trophy, and its name in the bestiary beside the Houses that took it. */
export function slay(s: SovState, houses: number[]): void {
  const e = s.expedition!;
  const q = QUARRY_BY_ID.get(e.card.quarry ?? "");
  if (!q || s.bestiary.quarries[q.id]) return;
  s.bestiary.quarries[q.id] = houses;
  for (const h of houses) s.houses[h]!.score.valor += q.trophy.valor;
  const haul = (e.haul ??= { items: [], stores: {} });
  for (const [k, n] of Object.entries(q.trophy.stores ?? {})) haul.stores[k] = (haul.stores[k] ?? 0) + n!;
  log(s, `${q.title} is slain. The trophy is carried with the party.`);
}

/** Counts a battle's fallen enemies into the bestiary; a first kill is a new entry, Lore for the Houses in the fight. */
export function tally(s: SovState, b: Battle, houses: number[]): void {
  const fresh = new Set<string>();
  for (const u of b.units) {
    if (u.side !== "enemy" || !u.enemy || u.partOf !== undefined || u.hazard || !(u.dead || u.down)) continue;
    if (!s.bestiary.kills[u.enemy]) fresh.add(u.enemy);
    s.bestiary.kills[u.enemy] = (s.bestiary.kills[u.enemy] ?? 0) + 1;
  }
  for (const h of houses) s.houses[h]!.score.lore += fresh.size * H.lorePerEntry;
}
