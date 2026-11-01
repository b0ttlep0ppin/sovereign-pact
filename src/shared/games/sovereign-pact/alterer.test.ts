// The Alterer's Forms (§12.2, §12.17): Shift and Revert, the Form's time, a two-cell Form, HP and
// healing rules, Revert prices and Stable Flesh, feral picks and Wild Blood, Graft, Molt.
import { describe, expect, it } from "vitest";
import { createRng } from "../../rng.ts";
import { act, cannotUse, resolve } from "./combat/battle.ts";
import { step } from "./combat/clock.ts";
import { enemyCombatant, newBattle } from "./combat/build.ts";
import { heal } from "./combat/damage.ts";
import { standardParty } from "./combat/fixtures.ts";
import { feralPick, revert, shift } from "./combat/forms.ts";
import { hasStatus } from "./combat/grid.ts";
import { simulate } from "./combat/sim.ts";
import { cellOf } from "./combat/targets.ts";
import type { Battle, Combatant } from "./combat/types.ts";
import { ABILITY_SET_BY_JOB, ACTIVE_BY_ID } from "./content.ts";

function alterer(): Combatant {
  const [u] = standardParty(1, 9, 1);
  return { ...u!, id: 1, col: 0, row: 3, mp: 300, abilities: ABILITY_SET_BY_JOB.get("alterer")!.actives, gambits: [], mods: {} };
}
const foe = (id = 10, row = 3): Combatant => ({ ...enemyCombatant("barrow_skeleton", { id, level: 3, col: 0, row }), hp: 9999, maxHp: 9999 });
const ab = (id: string) => ACTIVE_BY_ID.get(id)!;

function ready(u: Combatant, ...others: Combatant[]): Battle {
  const b = newBattle(1, [u, ...others]);
  b.actor = u.id;
  u.ct = 200;
  return b;
}

describe("Forms", () => {
  it("swap the Alterer's abilities for the Form's, keep the tools, and put everything back on Revert", () => {
    const u = alterer();
    const own = u.abilities;
    const b = ready(u, foe());
    act(b, createRng(1), u, { do: "ability", ability: "shift_werewolf", target: cellOf(u) });
    expect(u.form?.id).toBe("werewolf");
    expect(u.abilities.map((a) => a.id)).toContain("werewolf_claw");
    expect(u.abilities.map((a) => a.id)).toContain("revert");
    expect(u.mods.mightPct).toBe(30);
    revert(b, u);
    expect(u.abilities).toBe(own);
    expect(u.mods.mightPct).toBeUndefined();
    // Werewolf's price: Exhausted, Speed −2.
    expect(hasStatus(u, "exhausted")).toBe(true);
    expect(u.mods.speed).toBe(-2);
  });

  it("end when their time runs out, later with Long Shift", () => {
    const u = { ...alterer(), mods: { formTicks: 150 } as Record<string, number> };
    const b = newBattle(1, [u, foe()]);
    shift(b, u, "shrike");
    expect(u.form!.ends).toBe(450);
    for (let i = 0; i < 44; i++) step(b, createRng(i));
    expect(u.form).toBeDefined();
    step(b, createRng(1));
    expect(u.form).toBeUndefined();
  });

  it("grow to two cells as the Stone Colossus, which cannot be healed; its Revert costs Body Durability", () => {
    const u = alterer();
    const b = ready(u, foe());
    u.hp = 10;
    shift(b, u, "stone_colossus");
    expect(u.size).toEqual([1, 2]);
    expect(u.guard).toBeGreaterThanOrEqual(50);
    heal(b, u, u, { id: "big", shape: "single", side: "ally", power: 50, kind: "heal" });
    expect(u.hp).toBe(10);
    const body = u.dur!.body;
    revert(b, u);
    expect(u.size).toEqual([1, 1]);
    expect(u.dur!.body).toBe(Math.max(0, body - Math.round(u.maxDur!.body * 0.3)));
  });

  it("cost HP as the Shrike, and give it back on Revert as max HP only", () => {
    const u = alterer();
    const b = ready(u, foe());
    const max = u.maxHp;
    shift(b, u, "shrike");
    expect(u.maxHp).toBe(Math.round(max * 0.7));
    expect(u.hp).toBeLessThanOrEqual(u.maxHp);
    revert(b, u);
    expect(u.maxHp).toBe(max);
  });

  it("halve Revert prices with Stable Flesh", () => {
    const u = { ...alterer(), mods: { stableFlesh: 1 } as Record<string, number> };
    const b = ready(u, foe());
    shift(b, u, "werewolf");
    revert(b, u);
    expect(u.statuses.find((s) => s.id === "exhausted")?.ticks).toBe(150);
    expect(u.mods.speed).toBe(-1);
  });

  it("let a feral Form choose the ability, unless Wild Blood wins the roll", () => {
    const u = alterer();
    const b = ready(u, foe());
    shift(b, u, "rift_spawn");
    feralPick(createRng(2), u, () => true);
    expect(u.feral).toMatch(/^rift_/);
    const other = u.abilities.find((a) => a.id.startsWith("rift_") && a.id !== u.feral)!;
    expect(cannotUse(u, other)).toBe("feral");
    expect(cannotUse(u, { id: "attack", shape: "single", side: "foe", power: 1 })).toBe("feral");
    u.mods.wildBlood = 100;
    feralPick(createRng(2), u, () => true);
    expect(u.feral).toBeUndefined();
  });

  it("Graft lends an ally the Form's passive; Revert and Graft need a Form", () => {
    const u = alterer();
    const ally = { ...standardParty(1, 9, 1)[1]!, id: 2, col: 1, row: 3 };
    const b = ready(u, ally, foe());
    expect(cannotUse(u, ab("graft"))).toBe("no form");
    expect(cannotUse(u, ab("revert"))).toBe("no form");
    shift(b, u, "marsh_thing");
    resolve(b, createRng(1), u, ab("graft"), cellOf(ally), ally.id);
    expect(ally.mods["immune.poison"]).toBe(1);
    expect(hasStatus(u, "regen")).toBe(true);
    revert(b, u);
    expect(hasStatus(u, "regen")).toBe(false);
    expect(hasStatus(u, "slow")).toBe(true);
  });

  it("are not Dispelled or cured away", () => {
    const u = alterer();
    const b = ready(u, foe());
    shift(b, u, "werewolf");
    resolve(b, createRng(1), u, ab("molt"), cellOf(u));
    resolve(b, createRng(1), foe(), { id: "dispel_all", shape: "single", side: "foe", power: 0, kind: "support", dispelBuffs: 99 }, cellOf(u), u.id);
    expect(u.mods.mightPct).toBe(30);
  });

  it("make it through a battle the bots play", () => {
    const party = standardParty(3, 9, 1);
    party[0] = { ...party[0]!, abilities: ABILITY_SET_BY_JOB.get("alterer")!.actives, gambits: [], mp: 300 };
    const b = newBattle(6, [...party, foe(10, 2), foe(11, 4), foe(12, 6)]);
    expect(simulate(b).outcome).toBeDefined();
    expect(b.events.some((e) => e.t === "shift" && e.form)).toBe(true);
  });
});
