// Loot (§9.8, §9.10): drop tables, Caches, the boss's haul, sharing it out at home, and the draft.
import { describe, expect, it } from "vitest";
import { POOLS, RARE_MATERIALS } from "./content.ts";
import { able, muster } from "./expedition.ts";
import { sovereignPact, type SovMove, type SovState } from "./index.ts";
import { cache, find, gather, snake } from "./loot.ts";
import { levelUp } from "./progression.ts";
import { MATERIALS, type ExpeditionCard } from "./state.ts";
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
const card = (level = 2, pool = "barrows"): ExpeditionCard => ({ type: "delve", pool, level, size: 4 });

/** `H` Houses underway, two Scions each (one House alone fields four), led by House 0's first. */
function underway(H: number, c = card(), seed = 5): SovState {
  let s = calm(campaign(H, seed));
  s.phase = "expedition";
  muster(s, c);
  for (let h = 0; h < H; h++) s = move(s, `p${h + 1}`, { type: "field", people: able(s, h).slice(0, s.expedition!.seats[h]).map((p) => p.id) });
  const leader = s.expedition!.party[0]![0]!;
  if (H > 1) for (let h = 0; h < H; h++) s = move(s, `p${h + 1}`, { type: "lead", person: leader });
  return s;
}

describe("drop tables (§9.8)", () => {
  it("name only known materials, and roll the card's pool, more at higher levels", () => {
    const known = new Set<string>([...MATERIALS, ...RARE_MATERIALS.map((m) => m.id)]);
    for (const p of POOLS) for (const [id] of p.drops.materials) expect(known.has(id), `${p.id}: ${id}`).toBe(true);
    const total = (level: number) => {
      const s = underway(1, card(level, "forge_ruins"));
      gather(s, 200);
      const st = s.expedition!.haul!.stores;
      expect(Object.keys(st).every((k) => ["iron", "stone", "hollow_ivory", "essence"].includes(k))).toBe(true);
      return st.iron!;
    };
    expect(total(9)).toBeGreaterThan(total(1) * 2);
  });

  it("drops from won Encounters into the haul, not into anyone's stores yet", () => {
    let s = underway(1, card(1, "beast_lands"));
    for (const p of s.people) while (p.status === "scion" && p.level < 15) Object.assign(p, levelUp(p));
    s.expedition!.chain = ["encounter", "encounter", "encounter", "boss"];
    const grain = s.houses[0]!.stores.grain ?? 0;
    for (let i = 0; i < 3; i++) s = move(s, "p1", { type: "press_on" });
    expect(s.log.filter((l) => l.includes("wins a battle")).length).toBe(3);
    expect(s.expedition!.haul!.stores.grain).toBeGreaterThan(0);
    expect(s.houses[0]!.stores.grain ?? 0).toBe(grain);
  });
});

describe("Caches and the boss", () => {
  it("a Cache holds 1–2 Fine or better items, found by no one yet; some are trapped", () => {
    let trapped = 0;
    for (let seed = 1; seed <= 40; seed++) {
      const s = underway(1, card(3), seed);
      for (const p of s.people) while (p.status === "scion" && p.level < 15) Object.assign(p, levelUp(p));
      const owned = s.items.length;
      cache(s);
      if (s.log.some((l) => l.includes("is a trap"))) trapped++;
      if (s.expedition!.result) continue;
      const items = s.expedition!.haul!.items;
      expect(items.length).toBeGreaterThanOrEqual(1);
      expect(items.length).toBeLessThanOrEqual(2);
      expect(items.every((i) => i.tier >= 3 && i.house === -1 && i.ilvl === 3)).toBe(true);
      expect(s.items.length).toBe(owned);
    }
    expect(trapped).toBeGreaterThan(0);
    expect(trapped).toBeLessThan(20);
  });

  it("a beaten boss leaves a Masterwork item per House present and one more; solo, the House takes it all", () => {
    let s = underway(1, card(1, "beast_lands"));
    for (const p of s.people) while (p.status === "scion" && p.level < 20) Object.assign(p, levelUp(p));
    s.expedition!.chain = ["boss"];
    const owned = s.items.length;
    s = move(s, "p1", { type: "press_on" });
    expect(s.log.some((l) => l.includes("defeats the boss"))).toBe(true);
    // A boss's own named item falls on top (named.test.ts).
    const found = s.items.slice(owned).filter((i) => !i.named);
    expect(found.length).toBe(1 + TUNING.loot.boss.extraItems);
    expect(found.every((i) => i.tier === 4 && i.house === 0)).toBe(true);
    expect(s.expedition).toBeUndefined();
  });
});

describe("coming home (§9.9, §9.10)", () => {
  it("turns the haul into shares: an item each, and each material in a bundle per House drafting", () => {
    let s = underway(2);
    s.expedition!.haul = { items: [], stores: { iron: 5, voidglass: 1 } };
    find(s, 3);
    s.expedition!.chain = ["event", "boss"];
    s = move(s, "p1", { type: "retreat" });
    const pool = s.expedition!.pool!;
    expect(pool.filter((x) => x.item).length).toBe(1);
    expect(pool.filter((x) => x.stores).map((x) => x.stores)).toEqual([{ iron: 3 }, { iron: 2 }, { voidglass: 1 }]);
    expect(s.expedition!.draft!.length).toBe(4);
    expect(s.expedition!.haul).toBeUndefined();
  });

  it("alone, a House takes the whole haul", () => {
    let s = underway(1);
    s.expedition!.haul = { items: [], stores: { iron: 5 } };
    const iron = s.houses[0]!.stores.iron ?? 0;
    find(s, 3);
    const owned = s.items.length;
    s.expedition!.chain = ["event", "boss"];
    s = move(s, "p1", { type: "retreat" });
    expect(s.houses[0]!.stores.iron).toBe(iron + 5);
    expect(s.items.length).toBe(owned + 1);
    expect(s.expedition).toBeUndefined();
  });

  it("loses the haul in a wipe", () => {
    let s = underway(1, card(10, "outer_dark"));
    find(s, 4);
    s.expedition!.chain = ["encounter", "boss"];
    const owned = s.items.length;
    s = move(s, "p1", { type: "press_on" });
    expect(s.log.some((l) => l.includes("lost with it"))).toBe(true);
    expect(s.items.length).toBe(owned);
  });
});

describe("the draft (Josh, 2026-11-02: one pool of shares, a random House order)", () => {
  it("goes in a random order, then snakes back", () => {
    const firsts = new Set<number>();
    for (let seed = 1; seed <= 12; seed++) {
      const order = snake(underway(3, card(), seed), [0, 1, 2], 7);
      const [a, b, c] = order;
      expect(order).toEqual([a, b, c, c, b, a, a]);
      expect(new Set([a, b, c]).size).toBe(3);
      firsts.add(a!);
    }
    expect(firsts.size).toBeGreaterThan(1);
  });

  it("is claimed a share at a time, gear blind, by the Houses still in the party; then the Year goes on", () => {
    let s = underway(2);
    for (let i = 0; i < 2; i++) find(s, (3 + i) as 3 | 4);
    s.expedition!.haul!.stores = { essence: 2 };
    s.expedition!.chain = ["event", "boss"];
    s = move(s, "p1", { type: "retreat" });
    const e = s.expedition!;
    const [first, second] = e.draft!;
    expect(e.draft!.length).toBe(4);
    expect(g.activePlayers(s)).toEqual([`p${first! + 1}`]);
    expect(view(s, "p2").expedition!.pool!.every((x) => !x.item || x.item.props === undefined)).toBe(true);
    expect(e.pool!.some((x) => x.item?.props)).toBe(true);
    const essence = e.pool!.find((x) => x.stores)!;
    expect(error(s, `p${second! + 1}`, { type: "draft", share: essence.id })).toMatch(/not your House's pick/);
    expect(error(s, `p${first! + 1}`, { type: "draft", share: 999 })).toMatch(/not in the haul/);
    const had = s.houses[first!]!.stores.essence ?? 0;
    s = move(s, `p${first! + 1}`, { type: "draft", share: essence.id });
    expect(s.houses[first!]!.stores.essence).toBe(had + 1);
    // The bot takes the Masterwork over the Fine item and the other Essence.
    const mw = s.expedition!.pool!.find((x) => x.item?.tier === 4)!;
    expect(g.botMove!(s, `p${second! + 1}`, undefined as never)).toEqual({ type: "draft", share: mw.id });
    for (let i = 0; i < 3; i++) s = move(s, g.activePlayers(s)[0]!, g.botMove!(s, g.activePlayers(s)[0]!, undefined as never));
    expect(s.expedition).toBeUndefined();
    expect(s.items.find((i) => i.id === mw.id)!.house).toBe(second);
    expect([s.year, s.phase]).toEqual([2, "settlement"]);
  });
});
