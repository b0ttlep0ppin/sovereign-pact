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
    const found = s.items.slice(owned);
    expect(found.length).toBe(1 + TUNING.loot.boss.extraItems);
    expect(found.every((i) => i.tier === 4 && i.house === 0)).toBe(true);
    expect(s.expedition).toBeUndefined();
  });
});

describe("coming home (§9.9, §9.10)", () => {
  it("splits materials evenly between the Houses present, the remainder to the Commons", () => {
    let s = underway(2);
    s.expedition!.haul = { items: [], stores: { iron: 5, voidglass: 1 } };
    const iron = s.houses.map((h) => h.stores.iron ?? 0);
    const [ci, cv] = [s.commons.stores.iron ?? 0, s.commons.stores.voidglass ?? 0];
    s.expedition!.chain = ["event", "boss"];
    s = move(s, "p1", { type: "retreat" });
    expect(s.houses.map((h, i) => (h.stores.iron ?? 0) - iron[i]!)).toEqual([2, 2]);
    expect([(s.commons.stores.iron ?? 0) - ci, (s.commons.stores.voidglass ?? 0) - cv]).toEqual([1, 1]);
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

describe("the draft (§9.10)", () => {
  it("goes lowest Standing first in snake order", () => {
    const s = underway(3);
    s.houses[2]!.score.renown = 60;
    s.houses[1]!.score.renown = 30;
    expect(snake(s, [0, 1, 2], 7)).toEqual([0, 1, 2, 2, 1, 0, 0]);
  });

  it("is drafted blind, a pick at a time, by the Houses still in the party; then the Year goes on", () => {
    let s = underway(2);
    s.houses[1]!.score.renown = 50;
    for (let i = 0; i < 3; i++) find(s, (2 + i) as 2 | 3 | 4);
    s.expedition!.chain = ["event", "boss"];
    s = move(s, "p1", { type: "retreat" });
    const e = s.expedition!;
    expect(e.draft).toEqual([0, 1, 1]);
    expect(g.activePlayers(s)).toEqual(["p1"]);
    expect(view(s, "p2").expedition!.haul!.items.every((i) => i.props === undefined)).toBe(true);
    expect(e.haul!.items.some((i) => i.props)).toBe(true);
    const [a, b] = e.haul!.items;
    expect(error(s, "p2", { type: "draft", item: a!.id })).toMatch(/not your House's pick/);
    expect(error(s, "p1", { type: "draft", item: 999 })).toMatch(/not in the haul/);
    s = move(s, "p1", { type: "draft", item: a!.id });
    expect(s.items.find((i) => i.id === a!.id)!.house).toBe(0);
    expect(g.botMove!(s, "p2", undefined as never)).toEqual({ type: "draft", item: s.expedition!.haul!.items.find((i) => i.tier === 4)!.id });
    s = move(s, "p2", { type: "draft", item: b!.id });
    expect(s.phase).toBe("expedition");
    s = move(s, "p2", g.botMove!(s, "p2", undefined as never));
    expect(s.expedition).toBeUndefined();
    expect(s.items.filter((i) => i.house === 1).length).toBeGreaterThan(0);
    expect([s.year, s.phase]).toEqual([2, "settlement"]);
  });
});
