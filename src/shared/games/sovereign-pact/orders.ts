// Year orders (Josh 2026-11-03: buildings "don't do much and the resources don't really matter other than
// gold"; upkeep ruled out, "only Year orders"): once a Year, each standing building may be set one of its
// orders, which spends materials (rare ones at level 3) for what the order makes. Content: buildings.json.
import { BUILDING_BY_ID, type BuildingOrder } from "./content.ts";
import { applyEffects } from "./effects.ts";
import { recordOmen } from "./omens.ts";
import type { SovState } from "./state.ts";

const word = (k: string) => (k === "gold" ? "Gold" : k.split("_").map((w) => w[0]!.toUpperCase() + w.slice(1)).join(" "));
const have = (s: SovState, house: number, k: string) => (k === "gold" ? s.houses[house]!.gold : (s.houses[house]!.stores[k] ?? 0));

export const orderOf = (building: string, order: string): BuildingOrder | undefined => BUILDING_BY_ID.get(building)?.orders?.find((o) => o.id === order);

/** Why House `house` cannot give that order now, or null. */
export function cannotOrder(s: SovState, house: number, building: string, order: string, person?: number): string | null {
  const h = s.houses[house]!;
  const o = orderOf(building, order);
  if (!o) return "That building has no such order.";
  const level = h.buildings[building] ?? 0;
  if (level < o.level) return level ? `That order needs the ${BUILDING_BY_ID.get(building)!.name} at level ${o.level}.` : `Build the ${BUILDING_BY_ID.get(building)!.name} first.`;
  if (h.ordered?.includes(building)) return `The ${BUILDING_BY_ID.get(building)!.name} has had its order this Year.`;
  for (const [k, n] of Object.entries(o.cost)) if (have(s, house, k) < (n ?? 0)) return `That takes ${n} ${word(k)}, and you have ${have(s, house, k)}.`;
  if (o.person) {
    const p = s.people.find((x) => x.id === person);
    if (!p || p.host !== house || (p.status !== "scion" && p.status !== "retired")) return "Choose one of your own Scions.";
  }
  return null;
}

/** Pays for the order and carries it out; the building is spent for the Year. */
export function giveOrder(s: SovState, house: number, building: string, order: string, person?: number): void {
  const h = s.houses[house]!;
  const o = orderOf(building, order)!;
  for (const [k, n] of Object.entries(o.cost)) {
    if (k === "gold") h.gold -= n ?? 0;
    else h.stores[k] = (h.stores[k] ?? 0) - (n ?? 0);
  }
  (h.ordered ??= []).push(building);
  // Private: a House's orders are its own business, told only to it, as its own events are.
  const who = o.person ? s.people.find((p) => p.id === person)?.name : undefined;
  recordOmen(s, `order:${building}`, house, house, `${o.name}${who ? `, for ${who}` : ""}.`, o.text, () => applyEffects(s, o.effects, house, false, undefined, person));
  (s.notes[house] ??= []).push(`${o.name} (${BUILDING_BY_ID.get(building)!.name}): ${o.text}`);
}
