import { describe, expect, it } from "vitest";
import { sovereignPact, type SovMove, type SovState } from "./index.ts";
import { mint } from "./items.ts";
import { auctioned, listPrice, restock } from "./market.ts";
import type { Item } from "./state.ts";
import { calm, campaign } from "./testing.ts";
import { TUNING } from "./tuning.ts";
import { view } from "./view.ts";

const g = sovereignPact;

const move = (s: SovState, player: string, m: SovMove): SovState => {
  const r = g.applyMove(s, player, m);
  if (!r.ok) throw new Error(r.error);
  return r.state;
};
const error = (s: SovState, player: string, m: SovMove): string => {
  const r = g.applyMove(s, player, m);
  if (r.ok) throw new Error("expected a refusal");
  return r.error;
};
const sealAll = (s: SovState): SovState => s.players.reduce((x, p, i) => (x.houses[i]!.sealed ? x : move(x, p, { type: "seal" })), s);
/** A calm, rich campaign with one shop lot of the given tier. */
function shop(H: number, tier: Item["tier"], props?: Item["props"]): { s: SovState; id: number } {
  const s = calm(campaign(H, 5));
  for (const h of s.houses) h.gold = 1000;
  const item: Item = { id: s.nextId++, base: "sword", tier, ilvl: 1, house: -1, ...(props ? { props } : {}) };
  s.market = [{ item, shop: "weaponsmith", price: listPrice(item), auction: auctioned(item), bids: s.houses.map(() => null) }];
  return { s, id: item.id };
}

describe("shops (§8.6)", () => {
  it("stock only once built, a few lots a Year by stock tier, refreshed each Year", () => {
    const s = calm(campaign(2, 5));
    restock(s);
    expect(s.market).toEqual([]);
    s.commons.built = { great_market: 1, armorer: 1, weaponsmith: 1, curio_dealer: 1 };
    restock(s);
    const by = (shop: string) => s.market.filter((l) => l.shop === shop);
    expect([by("armorer").length, by("weaponsmith").length, by("curio_dealer").length]).toEqual([TUNING.shops.lots[0], TUNING.shops.lots[0], TUNING.shops.lots[0]! + 1]);
    expect(by("curio_dealer").at(-1)!.item.tier).toBeGreaterThanOrEqual(TUNING.shops.curioTier);
    expect(by("curio_dealer").every((l) => l.item.base.match(/ring|amulet|charm/))).toBe(true);
    const first = s.market.map((l) => l.item.id);
    restock(s);
    expect(s.market.some((l) => first.includes(l.item.id))).toBe(false);
  });

  it("sells Common and Fine goods at list price, first come", () => {
    const lot = shop(2, 3);
    const id = lot.id;
    let s = lot.s;
    s = move(s, "p1", { type: "buy", item: id });
    expect(s.houses[0]!.gold).toBe(1000 - listPrice({ tier: 3, ilvl: 1 }));
    expect(s.items.find((i) => i.id === id)!.house).toBe(0);
    expect(error(s, "p2", { type: "buy", item: id })).toMatch(/not for sale/);
  });

  it("prices by tier and item level", () => {
    expect(listPrice({ tier: 2, ilvl: 1 })).toBe(TUNING.shops.price[1]);
    expect(listPrice({ tier: 4, ilvl: 6 })).toBe(Math.round(TUNING.shops.price[3]! * (1 + 5 * TUNING.shops.perLevel)));
  });
});

describe("auctions (§13.4a)", () => {
  it("send Masterwork and rare-property goods to sealed bids", () => {
    expect(shop(2, 4).s.market[0]!.auction).toBe(true);
    expect(shop(2, 3, [["quickening", 1]]).s.market[0]!.auction).toBe(true);
    const { s, id } = shop(2, 4);
    expect(error(s, "p1", { type: "buy", item: id })).toMatch(/sealed bids/);
  });

  it("sells to a lone bidder at list price", () => {
    const lot = shop(2, 4);
    const id = lot.id;
    let s = lot.s;
    s = sealAll(move(s, "p2", { type: "bid", item: id, gold: 400 }));
    const price = listPrice({ tier: 4, ilvl: 1 });
    expect(s.items.find((i) => i.id === id)!.house).toBe(1);
    expect(s.log.some((l) => l.includes(`for ${price} Gold`))).toBe(true);
  });

  it("sells to the highest of several bids, which stay private until the result", () => {
    const lot = shop(3, 4);
    const id = lot.id;
    let s = lot.s;
    s = move(s, "p1", { type: "bid", item: id, gold: 150 });
    s = move(s, "p2", { type: "bid", item: id, gold: 180 });
    expect(view(s, "p1").market[0]!.bids).toEqual([150, null, null]);
    expect(error(s, "p3", { type: "bid", item: id, gold: 10 })).toMatch(/at least/);
    s = sealAll(s);
    expect(s.items.find((i) => i.id === id)!.house).toBe(1);
    expect(s.log.some((l) => l.includes("for 180 Gold"))).toBe(true);
  });

  it("breaks a tie by Renown at a cost of Accord", () => {
    const lot = shop(2, 4);
    const id = lot.id;
    let s = lot.s;
    s.houses[0]!.score.renown = 9;
    const accord = s.accord;
    s = move(move(s, "p1", { type: "bid", item: id, gold: 200 }), "p2", { type: "bid", item: id, gold: 200 });
    s = sealAll(s);
    expect(s.items.find((i) => i.id === id)!.house).toBe(0);
    expect(s.accord).toBe(accord - TUNING.tracks.tieCost);
    expect(s.log.some((l) => /tie broken/.test(l))).toBe(true);
  });

  it("lets a House put up its own item above a reserve; unsold, it comes home", () => {
    let s = calm(campaign(2, 5));
    for (const h of s.houses) h.gold = 500;
    const relic = mint(s, "sword", 0, 5);
    s = move(s, "p1", { type: "auction", item: relic.id, reserve: 100 });
    expect(s.items.some((i) => i.id === relic.id)).toBe(false);
    expect(error(s, "p1", { type: "bid", item: relic.id, gold: 200 })).toMatch(/own lot/);
    s = move(s, "p2", { type: "bid", item: relic.id, gold: 120 });
    s = sealAll(s);
    expect(s.items.find((i) => i.id === relic.id)!.house).toBe(1);
    let t = calm(campaign(2, 5));
    const ring = mint(t, "ring", 0, 3);
    t = sealAll(move(t, "p1", { type: "auction", item: ring.id, reserve: 999 }));
    expect(t.items.find((i) => i.id === ring.id)!.house).toBe(0);
  });
});
