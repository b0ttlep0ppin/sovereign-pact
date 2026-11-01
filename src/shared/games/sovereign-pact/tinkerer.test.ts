// The Tinkerer's Innovation (§12.2, §12.16): the Component offer and what is kept, recipes that use
// Components up, Bolt's Lens, the Turret and the Shield Drone, Grapple Line, Overclock and Repair.
import { describe, expect, it } from "vitest";
import { createRng } from "../../rng.ts";
import { act, advance, cannotUse, resolve } from "./combat/battle.ts";
import { enemyCombatant, newBattle } from "./combat/build.ts";
import { standardParty } from "./combat/fixtures.ts";
import { addStatus, statusValue } from "./combat/status.ts";
import { keepParts, missingParts, pickParts } from "./combat/parts.ts";
import { simulate } from "./combat/sim.ts";
import { summon } from "./combat/summons.ts";
import { cellOf } from "./combat/targets.ts";
import type { Battle, Combatant } from "./combat/types.ts";
import { ABILITY_SET_BY_JOB, ACTIVE_BY_ID } from "./content.ts";

function tinkerer(): Combatant {
  const [, , u] = standardParty(1, 9, 1);
  return { ...u!, id: 1, col: 1, row: 3, tp: 50, abilities: ABILITY_SET_BY_JOB.get("tinkerer")!.actives, gambits: [], mods: { scavenge: 3 } };
}
const foe = (id = 10, row = 3, col = 0): Combatant => ({ ...enemyCombatant("barrow_skeleton", { id, level: 3, col, row }), hp: 9999, maxHp: 9999 });
const ab = (id: string) => ACTIVE_BY_ID.get(id)!;

function ready(u: Combatant, ...others: Combatant[]): Battle {
  const b = newBattle(1, [u, ...others]);
  b.actor = u.id;
  u.ct = 200;
  return b;
}

describe("Components", () => {
  it("are offered three at a time at the start of a turn, four with Tinker's Eye", () => {
    const u = tinkerer();
    const b = newBattle(1, [u, foe()]);
    u.ct = 100;
    advance(b, createRng(1));
    expect(new Set(u.offer).size).toBe(3);
    const v = { ...tinkerer(), mods: { scavenge: 4 } };
    const b2 = newBattle(1, [v, foe()]);
    v.ct = 100;
    advance(b2, createRng(1));
    expect(v.offer).toHaveLength(4);
  });

  it("keep one (two with Scavenger), and the rest are lost", () => {
    const u = { ...tinkerer(), offer: ["gear", "lens", "core"] };
    expect(() => keepParts({ ...u }, ["gear", "core"])).toThrow(/at most 1/);
    expect(() => keepParts({ ...u }, ["wire"])).toThrow(/not offered/);
    keepParts(u, ["core"]);
    expect([u.parts, u.offer]).toEqual([["core"], undefined]);
    const v = { ...tinkerer(), mods: { scavenge: 3, keepParts: 1 }, offer: ["gear", "lens", "core"] };
    keepParts(v, ["gear", "core"]);
    expect(v.parts).toEqual(["gear", "core"]);
  });

  it("are picked by the bots toward the nearest recipe", () => {
    const u = { ...tinkerer(), parts: ["gear"], offer: ["lens", "core", "vial"] };
    // Gear + Core is a Turret; nothing else is that close.
    expect(pickParts(u)).toEqual(["core"]);
  });

  it("are used up by the abilities that need them, and kept for the same turn", () => {
    const u = { ...tinkerer(), offer: ["powder", "lens", "core"] };
    expect(cannotUse(u, ab("scatter_shot"))).toBe("parts");
    const t = foe();
    const b = ready(u, t);
    act(b, createRng(1), u, { do: "ability", ability: "scatter_shot", target: cellOf(t), keep: ["powder"] });
    expect(u.parts).toEqual([]);
    expect(b.events.some((e) => e.t === "use" && e.ability === "scatter_shot")).toBe(true);
    expect(missingParts({ parts: ["plate"] }, ab("shield_drone"))).toEqual(["wire"]);
  });

  it("let Bolt spend a Lens to never miss", () => {
    const u = { ...tinkerer(), parts: ["lens"], accuracy: -500 };
    const t = foe();
    const b = ready(u, t);
    act(b, createRng(1), u, { do: "ability", ability: "bolt", target: cellOf(t) });
    expect(u.parts).toEqual([]);
    expect(b.events.some((e) => e.t === "hit" && e.unit === u.id)).toBe(true);
  });
});

describe("constructs and tools", () => {
  it("Turret follows an ally's hit on a Marked target at half power", () => {
    const u = tinkerer();
    const ally = { ...standardParty(1, 9, 1)[0]!, id: 2, col: 0, row: 3, flags: Array<string>(5).fill("sure_hit") };
    const t = { ...foe(), evasion: -500 };
    const b = ready(ally, u, t);
    const [turret] = summon(b, u, "turret");
    addStatus(b, t, "marked", 200);
    act(b, createRng(1), ally, { do: "ability", ability: "attack", target: cellOf(t) });
    expect(b.events.some((e) => (e.t === "hit" || e.t === "miss") && e.unit === turret!.id)).toBe(true);
  });

  it("Shield Drone tops a Shield up to 15% instead of stacking it", () => {
    const u = tinkerer();
    const ally = { ...standardParty(1, 9, 1)[0]!, id: 2, col: 0, row: 3 };
    const b = ready(u, ally, foe());
    const [drone] = summon(b, u, "shield_drone");
    const pulse = drone!.abilities[0]!;
    resolve(b, createRng(1), drone!, pulse, cellOf(ally), ally.id);
    resolve(b, createRng(1), drone!, pulse, cellOf(ally), ally.id);
    expect(statusValue(ally, "shield")).toBe(Math.round(ally.maxHp * 0.15));
  });

  it("Grapple Line pulls an enemy a column closer; Overclock and Repair help allies", () => {
    const u = { ...tinkerer(), parts: ["wire", "core", "gear"], flags: ["sure_hit"] };
    const ally = { ...standardParty(1, 9, 1)[0]!, id: 2, col: 0, row: 3 };
    const t = foe(10, 3, 2);
    const b = ready(u, ally, t);
    resolve(b, createRng(1), u, ab("grapple_line"), cellOf(t), t.id);
    expect(t.col).toBe(1);
    ally.ct = 0;
    resolve(b, createRng(1), u, ab("overclock"), cellOf(ally), ally.id);
    expect([ally.ct, ally.flags.includes("instant_charge")]).toEqual([30, true]);
    const [turret] = summon(b, u, "turret");
    turret!.hp = 1;
    resolve(b, createRng(1), u, ab("repair"), cellOf(turret!), turret!.id);
    expect(turret!.hp).toBe(1 + Math.round(turret!.maxHp * 0.4));
  });

  it("make it through a battle the bots play", () => {
    const party = standardParty(2, 9, 1);
    party[2] = { ...party[2]!, abilities: ABILITY_SET_BY_JOB.get("tinkerer")!.actives, gambits: [], mods: { ...party[2]!.mods, scavenge: 3 } };
    const b = newBattle(4, [...party, foe(10, 2), foe(11, 4), foe(12, 6)]);
    expect(simulate(b).outcome).toBeDefined();
    expect(b.events.some((e) => e.t === "use" && ABILITY_SET_BY_JOB.get("tinkerer")!.actives.some((a) => a.parts && a.id === e.ability))).toBe(true);
  });
});
