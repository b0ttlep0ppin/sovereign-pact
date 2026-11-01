// Parts (§14.1): sub-entities of a big enemy that sit on some of its cells with their own HP and can be
// struck on their own. A Part takes no turns; damage to it also reaches the body (a share, tuning);
// destroying it removes the abilities it powers for the rest of the fight and staggers the body.
import type { EnemyDef, PartDef } from "../content.ts";
import { TUNING } from "../tuning.ts";
import type { Battle, Combatant } from "./types.ts";

const P = TUNING.enemies.parts;

/** Part ids are kept clear of every other combatant's: 1000 + 10 × the body's id + the Part's index. */
export const partId = (owner: number, index: number) => 1000 + owner * 10 + index;

/** The bounding rectangle of a Part's cells, relative to the body's top-left; Parts are rectangles. */
export function partBox(p: PartDef): { col: number; row: number; size: [number, number] } {
  const cols = p.cells.map(([c]) => c);
  const rows = p.cells.map(([, r]) => r);
  const col = Math.min(...cols);
  const row = Math.min(...rows);
  const size: [number, number] = [Math.max(...cols) - col + 1, Math.max(...rows) - row + 1];
  if (size[0] * size[1] !== new Set(p.cells.map(([c, r]) => `${c},${r}`)).size) throw new Error(`part ${p.id} is not a rectangle`);
  return { col, row, size };
}

/** The Part combatants of `owner` (built from `def`): its defenses and leanings, their own HP, no turns. */
export function partsOf(owner: Combatant, def: EnemyDef): Combatant[] {
  return (def.parts ?? []).map((p, i) => {
    const box = partBox(p);
    const hp = Math.max(1, Math.round(owner.maxHp * p.hp));
    return {
      ...owner,
      statuses: [],
      cooldowns: {},
      mods: { noMove: 1 },
      flags: [],
      injuries: [],
      broken: [],
      resist: { ...owner.resist },
      id: partId(owner.id, i),
      name: `${owner.name}'s ${p.name}`,
      partOf: owner.id,
      part: p.id,
      col: owner.col + box.col,
      row: owner.row + box.row,
      size: box.size,
      maxHp: hp,
      hp,
      speed: 0,
      ct: 0,
      boss: undefined,
      phase: undefined,
      tags: [...owner.tags, "part"],
      affinity: { ...owner.affinity, ...p.affinity },
      immune: [...owner.immune, ...(p.immune ?? [])],
      weak: p.weak ?? owner.weak,
      abilities: [],
      gambits: [{ do: "wait" }],
      disables: [...(p.disables ?? [])],
    };
  });
}

/** The body a Part belongs to, if it still stands. */
export const bodyOf = (b: Battle, u: Combatant): Combatant | undefined => (u.partOf === undefined ? undefined : b.units.find((o) => o.id === u.partOf && !o.dead));

/** Living Parts of `owner`. */
export const livingParts = (b: Battle, owner: Combatant): Combatant[] => b.units.filter((o) => o.partOf === owner.id && !o.dead);

/** The share of a blow on a Part that the body takes too. */
export const bodyShare = (damage: number): number => Math.round((damage * P.bodySharePct) / 100);

/** A Part is destroyed: its abilities are lost to the body, and the body staggers (Readiness −50). */
export function partBroken(b: Battle, part: Combatant): void {
  const body = bodyOf(b, part);
  if (!body) return;
  body.lost = [...new Set([...(body.lost ?? []), ...(part.disables ?? [])])];
  body.ct = Math.max(0, body.ct - P.stagger);
  b.events.push({ t: "part", unit: body.id, part: part.part! });
}
