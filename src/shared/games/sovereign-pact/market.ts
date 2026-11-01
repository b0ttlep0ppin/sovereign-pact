// Shops and auctions (§8.6, §13.4a). Each built shop stocks a few lots a Year, seeded, by its stock
// tier; Common and Fine goods sell at list price, first come. Masterwork, Relic and rare-property goods
// go to sealed bids, settled at the seal: one bidder pays the list price, several pay the highest bid,
// and a tie costs Accord −3 and goes to the higher Renown. A House may also put a stashed item up for
// sealed bids above a reserve; the winner pays the seller.
import { ITEM_BASES, type ItemBase } from "./content.ts";
import { built, loseAccord } from "./commons.ts";
import { year20 } from "./crisis.ts";
import { byPct, econ } from "./houses.ts";
import { baseOf, rollProps } from "./items.ts";
import type { Item, ItemTier, Lot, SovState } from "./state.ts";
import { TUNING } from "./tuning.ts";
import { log, withRng } from "./year.ts";

const T = TUNING.shops;

/** What each shop sells (Apothecary, Beastmonger and Fence stock arrive with consumables and loot). */
const SELLS: Record<string, (b: ItemBase) => boolean> = {
  armorer: (b) => ["head", "body", "arms", "legs"].includes(b.slot) || b.type === "shield",
  weaponsmith: (b) => b.slot === "main" || (b.slot === "off" && b.type !== "shield"),
  curio_dealer: (b) => b.slot === "acc",
};

export const listPrice = (item: Pick<Item, "tier" | "ilvl">): number => Math.round(T.price[item.tier - 1]! * (1 + T.perLevel * (item.ilvl - 1)));

/** Whether an item must go to sealed bids (§13.4a). */
export const auctioned = (item: Item): boolean => item.tier >= 4 || (item.props ?? []).some(([id]) => T.rareProps.includes(id));

/** A stock tier per shop: 1 when built; expedition finds raise it (Milestone 6). */
export const stockTier = (s: SovState, shop: string): number => (built(s, shop) ? Math.min(3, s.commons.shopTiers?.[shop] ?? 1) : 0);

/** The Year's stock, seeded, replacing last Year's. */
export function restock(s: SovState): void {
  s.market = s.market.filter((l) => l.shop === null);
  const ilvl = Math.max(1, Math.min(10, Math.ceil(year20(s) / 2)));
  withRng(s, (rng) => {
    for (const [shop, sells] of Object.entries(SELLS)) {
      const tier = stockTier(s, shop);
      if (!tier) continue;
      const bases = ITEM_BASES.filter(sells);
      const odds = T.quality[tier - 1]!;
      const lots = T.lots[tier - 1]! + (shop === "curio_dealer" ? 1 : 0);
      for (let n = 0; n < lots; n++) {
        let roll = rng.int(100);
        let q = odds.findIndex((w) => (roll -= w) < 0);
        // The Curio Dealer's one magic item a Year (§8.6).
        if (shop === "curio_dealer" && n === lots - 1) q = Math.max(q, T.curioTier - 2);
        const item: Item = rollProps(rng, { id: s.nextId++, base: rng.pick(bases).id, tier: (q + 2) as ItemTier, ilvl, house: -1 });
        s.market.push({ item, shop, price: listPrice(item), auction: auctioned(item), bids: s.houses.map(() => null) });
      }
    }
  });
}

const lotOf = (s: SovState, id: number) => s.market.find((l) => l.item.id === id);

/** A shop's list price to `house`: Patrons of the Guilds pay 10% less (§5.7). Sealed bids are what they are. */
export const priceFor = (s: SovState, house: number, lot: Lot): number => byPct(lot.price, econ(s.houses[house]!, "shopPct"));

export function cannotBuy(s: SovState, house: number, id: number): string | null {
  const lot = lotOf(s, id);
  if (!lot || lot.shop === null) return "That is not for sale in the shops.";
  if (lot.auction) return "That goes to sealed bids.";
  if (s.houses[house]!.gold < priceFor(s, house, lot)) return "You cannot afford it.";
  return null;
}

export function buy(s: SovState, house: number, id: number): void {
  const lot = lotOf(s, id)!;
  s.houses[house]!.gold -= priceFor(s, house, lot);
  s.market = s.market.filter((l) => l !== lot);
  s.items.push({ ...lot.item, house });
}

export function cannotBid(s: SovState, house: number, id: number, gold: number): string | null {
  const lot = lotOf(s, id);
  if (!lot || !lot.auction) return "That is not up for bids.";
  if (lot.seller === house) return "You cannot bid on your own lot.";
  if (!Number.isInteger(gold) || gold < lot.price) return `Bid at least ${lot.price} Gold.`;
  if (s.houses[house]!.gold < gold) return "You cannot cover that bid.";
  return null;
}

/** A sealed bid, replacing the House's last one on that lot. */
export const bid = (s: SovState, house: number, id: number, gold: number): void => void (lotOf(s, id)!.bids[house] = gold);

export function cannotAuction(s: SovState, house: number, id: number, reserve: number): string | null {
  if (s.houses.length < 2) return "There is no one to bid.";
  const worn = new Set(s.people.flatMap((p) => Object.values(p.gear)));
  const item = s.items.find((i) => i.id === id);
  if (!item || item.house !== house || worn.has(id)) return "Only an item in your stash can go up for bids.";
  if (!Number.isInteger(reserve) || reserve < 0) return "Set a reserve in whole Gold.";
  return null;
}

/** The item leaves the stash for the auction block until the seal. */
export function putUp(s: SovState, house: number, id: number, reserve: number): void {
  const item = s.items.find((i) => i.id === id)!;
  s.items = s.items.filter((i) => i !== item);
  s.market.push({ item, shop: null, seller: house, price: reserve, auction: true, bids: s.houses.map(() => null) });
  log(s, `House ${s.houses[house]!.name} puts a ${baseOf(item).name} up for sealed bids.`);
}

/** At the seal: each auction goes to its winner; a House's unsold lot goes home. */
export function settleAuctions(s: SovState): void {
  for (const lot of s.market.filter((l) => l.auction)) {
    const bidders = lot.bids.flatMap((g, h) => (g !== null && s.houses[h]!.gold >= g ? [h] : []));
    s.market = s.market.filter((l) => l !== lot);
    const name = baseOf(lot.item).name;
    if (!bidders.length) {
      if (lot.seller !== undefined) s.items.push(lot.item);
      continue;
    }
    const top = Math.max(...bidders.map((h) => lot.bids[h]!));
    const tied = bidders.filter((h) => lot.bids[h] === top);
    if (tied.length > 1) loseAccord(s, TUNING.tracks.tieCost);
    const winner = tied.reduce((a, h) => (s.houses[h]!.score.renown > s.houses[a]!.score.renown ? h : a));
    // A shop's lot with one bidder sells at its list price; a House's lot always at the bid.
    const pay = lot.seller === undefined && bidders.length === 1 ? lot.price : top;
    s.houses[winner]!.gold -= pay;
    if (lot.seller !== undefined) s.houses[lot.seller]!.gold += pay;
    s.items.push({ ...lot.item, house: winner });
    log(s, `House ${s.houses[winner]!.name} wins the ${name} for ${pay} Gold${tied.length > 1 ? ", the tie broken at a cost of trust" : ""}.`);
  }
}

/** The market as a House sees it: every lot, its own bids only. */
export const marketFor = (s: SovState, viewer: number | null): Lot[] =>
  s.market.map((l) => ({ ...l, bids: l.bids.map((b, h) => (h === viewer ? b : null)) }));
