// Consumables (§13.7): tonics, salves, bombs and the rest. A House holds them by count and buys them in the
// Settlement Phase wherever they are sold: a Commons shop at its stock tier (the Apothecary, the Curio
// Dealer, the Fence, the Great Market) or one of the House's own buildings at a level (the Workshop, the
// Chapel, the Farm…). Houses pack them into the party satchel for an expedition (§9.10).
import { CONSUMABLE_BY_ID, type ConsumableDef } from "./content.ts";
import { built } from "./commons.ts";
import { byPct, econ } from "./houses.ts";
import type { House, SovMove, SovState } from "./state.ts";
import { TUNING } from "./tuning.ts";
import { log } from "./year.ts";

const T = TUNING.consumables;

export type BuyConsumableMove = Extract<SovMove, { type: "buy_consumable" }>;

export const held = (h: House, id: string): number => h.consumables?.[id] ?? 0;

/** Adds (or with a negative `n`, takes) consumables; a count of 0 leaves the House's list. */
export function give(h: House, id: string, n: number): void {
  const left = held(h, id) + n;
  h.consumables ??= {};
  if (left > 0) h.consumables[id] = left;
  else delete h.consumables[id];
}

/** A Commons shop's stock tier (1 when built; expedition finds raise it), or 0 when unbuilt. */
const shopTier = (s: SovState, at: string): number => (built(s, at) ? Math.min(3, s.commons.shopTiers?.[at] ?? 1) : 0);

/** Whether `house` can buy `def` now, and where: a Commons shop, or its own building. */
export function soldAt(s: SovState, house: number, def: ConsumableDef): "commons" | "home" | null {
  const h = s.houses[house]!;
  if (def.sold.some((x) => (h.buildings[x.at] ?? 0) >= x.level)) return "home";
  if (def.sold.some((x) => shopTier(s, x.at) >= x.level)) return "commons";
  return null;
}

/** The price to `house`: the shops' discount (Patrons of the Guilds, §5.7) applies in the Commons. */
export const consumablePrice = (s: SovState, house: number, def: ConsumableDef): number =>
  soldAt(s, house, def) === "commons" ? byPct(def.price, econ(s.houses[house]!, "shopPct")) : def.price;

/** Everything `house` can buy now. */
export const forSale = (s: SovState, house: number): ConsumableDef[] => [...CONSUMABLE_BY_ID.values()].filter((d) => soldAt(s, house, d));

export function cannotBuyConsumable(s: SovState, house: number, move: BuyConsumableMove): string | null {
  const def = CONSUMABLE_BY_ID.get(move.id);
  if (!def) return "There is no such thing for sale.";
  const n = move.n ?? 1;
  if (!Number.isInteger(n) || n < 1 || n > T.perBuy) return `Buy 1 to ${T.perBuy} at a time.`;
  if (!soldAt(s, house, def)) return `No shop or building of yours sells ${def.name}.`;
  if (s.houses[house]!.gold < consumablePrice(s, house, def) * n) return "You cannot afford it.";
  return null;
}

export function buyConsumable(s: SovState, house: number, move: BuyConsumableMove): void {
  const def = CONSUMABLE_BY_ID.get(move.id)!;
  const n = move.n ?? 1;
  const h = s.houses[house]!;
  h.gold -= consumablePrice(s, house, def) * n;
  give(h, def.id, n);
  log(s, `${h.name} buys ${n} ${def.name}.`);
}

/** A bot keeps a few healing and curing things on hand, cheapest first, while it has Gold to spare. */
export function botBuyConsumable(s: SovState, house: number): BuyConsumableMove | null {
  const h = s.houses[house]!;
  for (const [id, want] of Object.entries(T.botKeeps)) {
    const def = CONSUMABLE_BY_ID.get(id);
    if (!def || held(h, id) >= want || !soldAt(s, house, def)) continue;
    const price = consumablePrice(s, house, def);
    if (h.gold - price < T.botReserve) continue;
    return { type: "buy_consumable", id, n: 1 };
  }
  return null;
}
