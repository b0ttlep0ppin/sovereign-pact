// Cure items (§11.2, §13.6): one-use Relics that undo what the injury tables did. Each is a named item
// with a `cure` (which results it mends), drafted like any loot and scored as a Relic while unused, but
// unlike other named items it can be made again and again. A House spends one on one of its own in the
// Settlement Phase; the Nest's Core (Year 15 won) yields one of each.
import { INJURY_BY_ID, NAMED, NAMED_BY_ID, type NamedDef } from "./content.ts";
import { carryNamed, itemName } from "./loot.ts";
import type { Item, Person, SovMove, SovState } from "./state.ts";
import { log } from "./year.ts";

export type CureMove = Extract<SovMove, { type: "cure" }>;

/** Every kind of cure, in content order. */
export const CURES: readonly NamedDef[] = NAMED.filter((n) => n.cure);

export const cureOf = (item: Item): NamedDef["cure"] => (item.named ? NAMED_BY_ID.get(item.named)?.cure : undefined);

/** The injuries on `p` that `item` can mend, oldest first. */
export function mends(item: Item, p: Person): string[] {
  const c = cureOf(item);
  if (!c) return [];
  return p.injuries.filter((i) => c.injuries?.includes(i.id) || (c.band !== undefined && INJURY_BY_ID.get(i.id)?.band === c.band && INJURY_BY_ID.get(i.id)?.lasting)).map((i) => i.id);
}

export function cannotCure(s: SovState, house: number, move: CureMove): string | null {
  const item = s.items.find((i) => i.id === move.item);
  if (!item || item.house !== house) return "Your House holds no such item.";
  if (!cureOf(item)) return "That is not a cure.";
  const p = s.people.find((x) => x.id === move.person);
  if (!p || p.host !== house || p.status === "lost") return "Only one of your House's own, at home, can be mended.";
  const can = mends(item, p);
  if (!can.length) return `${itemName(item)} mends nothing ${p.name} suffers.`;
  if (move.injury !== undefined && !can.includes(move.injury)) return `${itemName(item)} cannot mend that.`;
  return null;
}

/** Spends the cure: the injury is gone (the chosen one, else the oldest it mends), and so is the item. */
export function cure(s: SovState, move: CureMove): void {
  const item = s.items.find((i) => i.id === move.item)!;
  const p = s.people.find((x) => x.id === move.person)!;
  const id = move.injury ?? mends(item, p)[0]!;
  p.injuries.splice(p.injuries.findIndex((i) => i.id === id), 1);
  const look = cureOf(item)!.look;
  if (look && !p.look.includes(look)) p.look.push(look);
  s.items.splice(s.items.indexOf(item), 1);
  log(s, `${p.name} is mended by ${itemName(item)}: ${INJURY_BY_ID.get(id)!.name} is undone.`);
}

/** The Nest won (§14.7, Year 15): the Unknown Core yields one cure of each kind into the haul. */
export function coreSpoils(s: SovState): void {
  for (const c of CURES) carryNamed(s, c.id);
}

/** A bot spends a cure it holds on the first of its own it can mend. */
export function botCure(s: SovState, house: number): CureMove | null {
  for (const item of s.items.filter((i) => i.house === house && cureOf(i))) {
    const p = s.people.find((x) => x.host === house && x.status !== "lost" && mends(item, x).length);
    if (p) return { type: "cure", item: item.id, person: p.id };
  }
  return null;
}
