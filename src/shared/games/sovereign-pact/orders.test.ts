// Year orders (Josh 2026-11-03: "only Year orders"): once a Year each standing building may be given one
// of its orders, which spends materials for what it makes.
import { describe, expect, it } from "vitest";
import { BUILDINGS, CONSUMABLE_BY_ID, RARE_MATERIALS, TRAIT_BY_ID } from "./content.ts";
import { sovereignPact as g, type SovMove, type SovState } from "./index.ts";
import { calm, campaign } from "./testing.ts";
import { openYear } from "./year.ts";

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
const town = () => {
  const s = calm(campaign(2, 4));
  Object.assign(s.houses[0]!, { gold: 200, stores: { grain: 100, timber: 100, stone: 100, iron: 100, essence: 20 } });
  return s;
};

describe("the Year orders' content", () => {
  it("gives every building an order, and names only real materials, consumables and traits", () => {
    const stores = new Set(["gold", "grain", "timber", "stone", "iron", "essence", ...RARE_MATERIALS.map((m) => m.id)]);
    for (const b of BUILDINGS) {
      expect(b.orders?.length, b.id).toBeGreaterThan(0);
      for (const o of b.orders!) {
        for (const k of Object.keys(o.cost)) expect(stores.has(k), `${b.id}.${o.id} costs ${k}`).toBe(true);
        // A rare material is a level-3 order's.
        if (Object.keys(o.cost).some((k) => RARE_MATERIALS.some((m) => m.id === k))) expect(o.level, `${b.id}.${o.id}`).toBe(3);
        for (const e of o.effects) {
          if (e.consumable) expect(CONSUMABLE_BY_ID.has(e.consumable.id), e.consumable.id).toBe(true);
          const t = e.scion?.blessing?.trait;
          if (t) expect(TRAIT_BY_ID.has(t), t).toBe(true);
          if (e.scion?.who === "champion") expect(o.person, `${b.id}.${o.id} names its Scion`).toBe(true);
        }
      }
    }
  });
});

describe("Year orders", () => {
  it("needs the building at the order's level, spends what it costs, and makes what it makes", () => {
    let s = town();
    expect(error(s, "p1", { type: "order", building: "forge", order: "craft" })).toMatch(/Build the Forge first/);
    s.houses[0]!.buildings.forge = 1;
    expect(error(s, "p1", { type: "order", building: "forge", order: "masterwork" })).toMatch(/at level 2/);
    const items = s.items.filter((i) => i.house === 0).length;
    s = move(s, "p1", { type: "order", building: "forge", order: "craft" });
    expect(s.houses[0]!.stores.iron).toBe(85);
    expect(s.houses[0]!.stores.timber).toBe(95);
    expect(s.items.filter((i) => i.house === 0)).toHaveLength(items + 1);
    expect(s.items.filter((i) => i.house === 0).at(-1)!.tier).toBe(2);
    expect(s.notes[0]!.at(-1)).toMatch(/Craft a Common piece/);
  });

  it("gives each building one order a Year", () => {
    let s = town();
    s.houses[0]!.buildings.workshop = 2;
    s = move(s, "p1", { type: "order", building: "workshop", order: "bombs" });
    expect(s.houses[0]!.consumables?.firebomb).toBe(2);
    expect(error(s, "p1", { type: "order", building: "workshop", order: "traps" })).toMatch(/had its order this Year/);
    s.year += 1;
    openYear(s);
    s = move(s, "p1", { type: "order", building: "workshop", order: "traps" });
    expect(s.houses[0]!.consumables).toMatchObject({ caltrops: 2, net: 1 });
  });

  it("falls on the Scion the House names, and only its own", () => {
    let s = town();
    s.houses[0]!.buildings.training_ground = 1;
    const mine = s.people.find((p) => p.host === 0 && p.status === "scion")!;
    const theirs = s.people.find((p) => p.host === 1 && p.status === "scion")!;
    expect(error(s, "p1", { type: "order", building: "training_ground", order: "drill" })).toMatch(/your own Scions/);
    expect(error(s, "p1", { type: "order", building: "training_ground", order: "drill", person: theirs.id })).toMatch(/your own Scions/);
    s = move(s, "p1", { type: "order", building: "training_ground", order: "drill", person: mine.id });
    expect(s.people.find((p) => p.id === mine.id)!.xp).toBeGreaterThan(mine.xp);
  });

  it("refuses an order the House cannot pay for, rare materials included", () => {
    const s = town();
    s.houses[0]!.buildings.forge = 3;
    expect(error(s, "p1", { type: "order", building: "forge", order: "wyrmforge" })).toMatch(/1 Wyrmbone, and you have 0/);
  });
});
