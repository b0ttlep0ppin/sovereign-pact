// Consumables in battle (§13.7): a Scion's action from the party satchel, and the bots' use of it.
import { describe, expect, it } from "vitest";
import { createRng } from "../../../rng.ts";
import { ACTIVE_BY_ID } from "../content.ts";
import { TUNING } from "../tuning.ts";
import { act } from "./battle.ts";
import { enemyCombatant, newBattle } from "./build.ts";
import { standardParty } from "./fixtures.ts";
import { decide } from "./gambits.ts";
import { itemAbility, itemPlan } from "./items.ts";
import { addStatus } from "./status.ts";
import { cellOf } from "./targets.ts";
import type { Battle, Combatant } from "./types.ts";

function scion(id: number, col: number, row: number, extra: Partial<Combatant> = {}): Combatant {
  const [p] = standardParty(id, 6, id);
  return { ...p!, id, col, row, person: id, ...extra };
}
const enemy = (id: number, col: number, row: number) => enemyCombatant("barrow_skeleton", { id, level: 2, col, row });

/** A battle with `satchel`, waiting on unit 1. */
function fight(satchel: string[], ...units: Combatant[]): Battle {
  const b = newBattle(3, units);
  b.satchel = [...satchel];
  b.actor = 1;
  b.acted = false;
  b.moved = false;
  return b;
}
const rng = () => createRng(9);
const unitOf = (b: Battle, id: number) => b.units.find((u) => u.id === id)!;

describe("using a consumable (§13.7)", () => {
  it("heals from the satchel for 100 CT, and the satchel remembers", () => {
    const b = fight(["tonic", "tonic"], scion(1, 0, 0), scion(2, 0, 1), enemy(9, 0, 0));
    const t = unitOf(b, 2);
    t.hp = 10;
    unitOf(b, 1).ct = 200;
    act(b, rng(), unitOf(b, 1), { do: "item", item: "tonic", target: cellOf(t) });
    expect(t.hp).toBe(10 + Math.round(t.maxHp * 0.25));
    expect(b.satchel).toEqual(["tonic"]);
    expect(b.used).toEqual(["tonic"]);
    expect(unitOf(b, 1).ct).toBe(100);
  });

  it("costs 60 CT under Quick Hands and heals more with Herb Lore", () => {
    const u = scion(1, 0, 0, { mods: { itemCt: 60, itemHealPct: 30 } });
    const ab = itemAbility(u, "tonic")!;
    expect(ab.cost).toBe(60);
    expect(ab.restore?.hpPct).toBe(Math.round(25 * 1.3));
  });

  it("refuses what the satchel lacks, and anyone but a Scion", () => {
    const b = fight(["tonic"], scion(1, 0, 0), enemy(9, 0, 0));
    expect(() => act(b, rng(), unitOf(b, 1), { do: "item", item: "ether", target: cellOf(unitOf(b, 1)) })).toThrow(/holds none/);
    expect(() => act(b, rng(), unitOf(b, 1), { do: "item", item: "lantern", target: cellOf(unitOf(b, 1)) })).toThrow(/holds none/);
  });

  it("revives, restores MP and cures like the abilities it is shaped as", () => {
    const b = fight(["smelling_salts", "ether", "antidote"], scion(1, 0, 0), scion(2, 0, 1), enemy(9, 0, 0));
    const down = unitOf(b, 2);
    down.hp = 0;
    down.down = true;
    act(b, rng(), unitOf(b, 1), { do: "item", item: "smelling_salts", target: cellOf(down) });
    expect(down.down).toBe(false);
    expect(down.hp).toBe(Math.max(1, Math.round(down.maxHp * 0.1)));
    const u = unitOf(b, 1);
    u.mp = 0;
    b.actor = 1;
    b.acted = false;
    act(b, rng(), u, { do: "item", item: "ether", target: cellOf(u) });
    expect(u.mp).toBe(Math.round(u.maxMp * 0.25));
    addStatus(b, u, "poison", 300);
    b.actor = 1;
    b.acted = false;
    act(b, rng(), u, { do: "item", item: "antidote", target: cellOf(u) });
    expect(u.statuses.some((s) => s.id === "poison")).toBe(false);
  });
});

describe("bots and the satchel", () => {
  it("raise the Down first, then heal the badly hurt", () => {
    const b = fight(["tonic", "smelling_salts"], scion(1, 0, 0), scion(2, 0, 1), scion(3, 1, 0), enemy(9, 0, 0));
    expect(itemPlan(b, unitOf(b, 1))).toBe(undefined);
    unitOf(b, 3).hp = 1;
    unitOf(b, 2).down = true;
    unitOf(b, 2).hp = 0;
    expect(itemPlan(b, unitOf(b, 1))).toMatchObject({ do: "item", item: "smelling_salts", target: cellOf(unitOf(b, 2)) });
    b.satchel = ["tonic"];
    expect(itemPlan(b, unitOf(b, 1))).toMatchObject({ do: "item", item: "tonic", target: cellOf(unitOf(b, 3)) });
    unitOf(b, 3).hp = unitOf(b, 3).maxHp;
    expect(itemPlan(b, unitOf(b, 1))).toBe(undefined);
  });

  it("throw a bomb once the foes bunch up, and leave the satchel alone with gambits of their own", () => {
    const foes = Array.from({ length: TUNING.consumables.bots.bombFoes }, (_, i) => enemy(9 + i, 0, i));
    const b = fight(["firebomb"], scion(1, 0, 0), ...foes);
    expect(decide(b, rng(), unitOf(b, 1)).action).toMatchObject({ do: "item", item: "firebomb" });
    unitOf(b, 1).gambits = [{ do: "attack" }];
    expect(decide(b, rng(), unitOf(b, 1)).action.do).not.toBe("item");
    unitOf(b, 1).gambits = [{ do: "item:firebomb" }];
    expect(decide(b, rng(), unitOf(b, 1)).action).toMatchObject({ do: "item", item: "firebomb" });
  });
});

describe("the hand-coded battle items (§13.7)", () => {
  /** Unit 1 uses `item` at `on`'s cell, with resists out of the way. */
  const use = (b: Battle, item: string, on: Combatant) => {
    for (const x of b.units) x.resist = { physical: 0, mental: 0 };
    b.actor = 1;
    b.acted = false;
    act(b, rng(), unitOf(b, 1), { do: "item", item, target: cellOf(on) });
  };
  const has = (u: Combatant, id: string) => u.statuses.some((s) => s.id === id);

  it("Grave Dust turns the undead, fearless or not, and takes Readiness from a boss", () => {
    const bat = enemyCombatant("beast_bat", { id: 10, level: 2, col: 1, row: 0 });
    const boss = { ...enemy(11, 2, 2), boss: true, ct: 80 };
    const b = fight(["grave_dust"], scion(1, 0, 0), enemy(9, 1, 1), bat, boss);
    use(b, "grave_dust", unitOf(b, 9));
    expect(has(unitOf(b, 9), "turned")).toBe(true);
    expect(has(unitOf(b, 10), "turned")).toBe(false);
    expect(unitOf(b, 11).ct).toBe(50);
    // The Turned flee as the Afraid do.
    expect(decide(b, rng(), unitOf(b, 9)).action).toEqual({ do: "wait" });
  });

  it("Hollow Ivory Dust stuns the undead and constructs in a cross, no one else", () => {
    const bat = enemyCombatant("beast_bat", { id: 10, level: 2, col: 0, row: 1 });
    const b = fight(["hollow_ivory_dust"], scion(1, 0, 0), enemy(9, 1, 1), bat);
    use(b, "hollow_ivory_dust", unitOf(b, 9));
    expect(has(unitOf(b, 9), "stun")).toBe(true);
    expect(has(unitOf(b, 10), "stun")).toBe(false);
  });

  it("gives a weapon an edge for the battle, one edge at a time", () => {
    const b = fight(["ember_oil", "brine"], scion(1, 0, 0), enemy(9, 0, 0));
    const u = unitOf(b, 1);
    use(b, "ember_oil", u);
    expect(u.mods["enchant.fire"]).toBe(1);
    use(b, "brine", u);
    expect(u.mods["enchant.fire"]).toBeUndefined();
    expect(u.mods["enchant.water"]).toBe(1);
  });

  it("Oathwine strengthens the user's own House, not its allies'", () => {
    const b = fight(["oathwine"], scion(1, 0, 0, { house: 0 }), scion(2, 0, 1, { house: 0 }), scion(3, 1, 0, { house: 1 }), enemy(9, 0, 0));
    use(b, "oathwine", unitOf(b, 1));
    expect([1, 2, 3].map((id) => unitOf(b, id).mods.damagePct ?? 0)).toEqual([10, 10, 0]);
  });

  it("the Mourning Veil costs Sanity, then keeps the rest; Blackroot mends at each turn for Sanity", () => {
    const b = fight(["mourning_veil", "blackroot_chew"], scion(1, 0, 0), enemy(9, 0, 0));
    const u = unitOf(b, 1);
    const sanity = u.sanity;
    use(b, "mourning_veil", u);
    expect(u.sanity).toBe(sanity + Math.round((u.maxSanity * -10) / 100));
    expect(u.mods.sanityTakenPct).toBe(-100);
    expect(addStatus(b, u, "fear", 300)).toBe(false);
    use(b, "blackroot_chew", u);
    expect(u.mods.durPctPerTurn).toBe(5);
    expect(has(u, "blackroot")).toBe(true);
  });

  it("a Scroll casts its spell at once for no MP; Wine leaves the Fond of Wine steady", () => {
    const b = fight(["scroll_of_mending_rain", "wine"], scion(1, 0, 0), scion(2, 0, 1, { hp: 1 }), enemy(9, 0, 0));
    const u = unitOf(b, 1);
    const mp = u.mp;
    use(b, "scroll_of_mending_rain", unitOf(b, 2));
    expect(unitOf(b, 2).hp).toBeGreaterThan(1);
    expect(u.mp).toBe(mp);
    expect(u.charge).toBeUndefined();
    u.mods["immune.tipsy"] = 1;
    use(b, "wine", u);
    expect(has(u, "tipsy")).toBe(false);
  });

  it("bots dust the dead and pour Oathwine when the field is full", () => {
    const b = fight(["grave_dust"], scion(1, 0, 0), enemy(9, 0, 0), enemy(10, 1, 0));
    expect(itemPlan(b, unitOf(b, 1))).toMatchObject({ do: "item", item: "grave_dust" });
    b.satchel = ["oathwine"];
    b.units.push(enemy(11, 2, 0));
    expect(itemPlan(b, unitOf(b, 1))).toMatchObject({ do: "item", item: "oathwine" });
    addStatus(b, unitOf(b, 1), "oathbound", 0);
    expect(itemPlan(b, unitOf(b, 1))).toBe(undefined);
  });
});

describe("the Candle, the Chorus and the Pouch (§13.7)", () => {
  const go = (b: Battle, item: string, on: Combatant) => {
    b.actor = 1;
    b.acted = false;
    act(b, rng(), unitOf(b, 1), { do: "item", item, target: cellOf(on) });
  };

  it("the Thief's Candle disarms hidden traps and takes the Lurkers' head start", () => {
    const lurker = { ...enemy(9, 1, 0), role: "lurker", ct: 100 };
    const b = fight(["thiefs_candle"], scion(1, 0, 0), lurker, enemy(10, 0, 1));
    b.field = [{ id: "bear_trap", col: 0, row: 3, hidden: true }, { id: "rockfall", col: 0, row: 2, at: 400 }];
    expect(itemPlan(b, unitOf(b, 1))).toMatchObject({ item: "thiefs_candle" });
    go(b, "thiefs_candle", unitOf(b, 1));
    expect(b.field).toEqual([{ id: "rockfall", col: 0, row: 2, at: 400 }]);
    expect(unitOf(b, 9).ct).toBe(0);
  });

  it("the Bottled Chorus plays a March for every ally", () => {
    const b = fight(["bottled_chorus"], scion(1, 0, 0), scion(2, 0, 1), enemy(9, 0, 0));
    go(b, "bottled_chorus", unitOf(b, 1));
    expect([unitOf(b, 1), unitOf(b, 2)].map((u) => u.mods.speed)).toEqual([1, 1]);
  });

  it("the Component Pouch gives a Tinkerer what its recipes want, and nothing to anyone else", () => {
    const tinkerer = scion(1, 0, 0, { mods: { scavenge: 3 }, abilities: [ACTIVE_BY_ID.get("shrapnel_mine")!], parts: [] });
    const b = fight(["component_pouch", "component_pouch"], tinkerer, scion(2, 0, 1), enemy(9, 0, 0));
    expect(itemPlan(b, unitOf(b, 1))).toMatchObject({ item: "component_pouch" });
    go(b, "component_pouch", unitOf(b, 1));
    expect([...unitOf(b, 1).parts!].sort()).toEqual(["plate", "powder"]);
    go(b, "component_pouch", unitOf(b, 2));
    expect(unitOf(b, 2).parts ?? []).toEqual([]);
  });
});
