// Consumables (§13.7): tonics, salves, bombs and the rest. A House holds them by count and buys them in the
// Settlement Phase wherever they are sold: a Commons shop at its stock tier (the Apothecary, the Curio
// Dealer, the Fence, the Great Market) or one of the House's own buildings at a level (the Workshop, the
// Chapel, the Farm…). Houses pack them into the party satchel for an expedition (§9.10).
import { CONSUMABLE_BY_ID, type ConsumableDef } from "./content.ts";
import { built } from "./commons.ts";
import { seatsOf } from "./expedition.ts";
import { BOT_OPENS } from "./satchel.ts";
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

/**
 * The satchel slots `house` may fill as it fields `fielded` Scions (§9.10): its share of the card's
 * seats, rounded up, and never more than the satchel has left.
 */
export function packRoom(s: SovState, house: number, fielded: number): number {
  const e = s.expedition!;
  const share = Math.ceil((T.satchel * fielded) / seatsOf(e.card));
  return Math.max(0, Math.min(share, T.satchel - (e.satchel?.length ?? 0)));
}

export function cannotPack(s: SovState, house: number, fielded: number, pack: unknown): string | null {
  if (pack === undefined) return null;
  if (typeof pack !== "object" || pack === null || Array.isArray(pack)) return "Pack consumables by id and count.";
  const h = s.houses[house]!;
  let n = 0;
  for (const [id, k] of Object.entries(pack)) {
    if (!CONSUMABLE_BY_ID.has(id)) return `There is no such thing as ${id}.`;
    if (!Number.isInteger(k) || (k as number) < 1) return "Pack whole counts.";
    if (held(h, id) < (k as number)) return `Your House holds only ${held(h, id)} ${CONSUMABLE_BY_ID.get(id)!.name}.`;
    n += k as number;
  }
  const room = packRoom(s, house, fielded);
  return n > room ? `Your House may pack ${room} of the satchel's ${T.satchel} slots.` : null;
}

/** Moves what `house` packs from its home stock into the party satchel, one slot each. */
export function pack(s: SovState, house: number, pack: Partial<Record<string, number>> | undefined): void {
  const e = s.expedition!;
  for (const [id, n] of Object.entries(pack ?? {})) {
    give(s.houses[house]!, id, -n!);
    e.satchel ??= [];
    for (let k = 0; k < n!; k++) e.satchel.push({ id, house });
  }
}

/** The satchel's unused consumables go home to the Houses that packed them (§13.8); a wiped party's are lost with it. */
export function unpack(s: SovState): void {
  const e = s.expedition;
  if (!e?.satchel) return;
  if (e.result !== "wiped") for (const x of e.satchel) give(s.houses[x.house]!, x.id, 1);
  delete e.satchel;
}

/** A bot packs what helps in battle, in its keeping order, up to its share. */
export function botPack(s: SovState, house: number, fielded: number): Partial<Record<string, number>> | undefined {
  const h = s.houses[house]!;
  let room = packRoom(s, house, fielded);
  const out: Partial<Record<string, number>> = {};
  for (const id of [...Object.keys(T.botKeeps), ...Object.keys(h.consumables ?? {})]) {
    const def = CONSUMABLE_BY_ID.get(id);
    // Battle things as many as fit; one of each road thing a bot knows how to use (satchel.ts).
    const road = BOT_OPENS.includes(id) && (id !== "signal_flare" || s.expedition?.card.type === "rescue");
    if (!def || (def.use !== "battle" && !road) || out[id] !== undefined) continue;
    const n = Math.min(room, held(h, id), road ? 1 : Infinity);
    if (n > 0) out[id] = n;
    room -= n;
  }
  return Object.keys(out).length ? out : undefined;
}
