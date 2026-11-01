// The Abjurer's Warding (§12.14): Shields, Dispel and Purge, Reflect, Brands, Anchor, Null Zone,
// Counterspell, Thick Skin and Aegis.
import { describe, expect, it } from "vitest";
import { createRng } from "../../rng.ts";
import { act, cannotUse, resolve } from "./combat/battle.ts";
import { enemyCombatant, newBattle, scionCombatant } from "./combat/build.ts";
import { atLevel, standardParty } from "./combat/fixtures.ts";
import { hasStatus } from "./combat/grid.ts";
import { addStatus, statusValue } from "./combat/status.ts";
import { cellOf } from "./combat/targets.ts";
import type { AbilityDef, Battle, Combatant } from "./combat/types.ts";
import { ABILITY_SET_BY_JOB, ACTIVE_BY_ID } from "./content.ts";
import { promote, rollRecruit } from "./generate.ts";

const BOLT: AbilityDef = { id: "bolt", shape: "single", side: "foe", power: 1, base: 20, kind: "magic", element: "fire" };

function abjurer(): Combatant {
  const [, u] = standardParty(1, 9, 1);
  return { ...u!, col: 1, row: 3, mp: 200, abilities: ABILITY_SET_BY_JOB.get("abjurer")!.actives, mods: {} };
}
const ally = (): Combatant => ({ ...standardParty(1, 9, 1)[0]!, col: 0, row: 3, mods: {}, flags: Array<string>(10).fill("sure_hit") });
const foe = (id = 10, row = 3): Combatant => ({ ...enemyCombatant("barrow_skeleton", { id, level: 3, col: 0, row }), hp: 9999, maxHp: 9999 });

function ready(u: Combatant, ...others: Combatant[]): Battle {
  const b = newBattle(1, [u, ...others]);
  b.actor = u.id;
  u.ct = 200;
  return b;
}
const use = (b: Battle, u: Combatant, ability: string, t: Combatant) => act(b, createRng(3), u, { do: "ability", ability, target: cellOf(t) });

describe("the Abjurer", () => {
  it("raises a Barrier of 30% max HP, a quarter more under Aegis", () => {
    const [u, a] = [abjurer(), ally()];
    use(ready(u, a), u, "barrier", a);
    expect(statusValue(a, "shield")).toBe(Math.round(a.maxHp * 0.3));
    const [v, c] = [{ ...abjurer(), mods: { shieldCastPct: 25 } }, ally()];
    use(ready(v, c), v, "barrier", c);
    expect(statusValue(c, "shield")).toBe(Math.round(c.maxHp * 0.3 * 1.25));
  });

  it("strips every buff with Dispel, one from each enemy with Purge", () => {
    const u = abjurer();
    const [t, s] = [foe(10, 2), foe(11, 5)];
    for (const x of [t, s]) for (const id of ["protect", "haste", "regen"]) addStatus(newBattle(1, []), x, id);
    use(ready(u, t, s), u, "dispel", t);
    expect(t.statuses).toEqual([]);
    expect(s.statuses).toHaveLength(3);
    resolve(ready(u, t, s), createRng(1), u, ACTIVE_BY_ID.get("purge")!, cellOf(s));
    expect(s.statuses.map((x) => x.id)).toEqual(["protect", "haste"]);
  });

  it("turns an enemy's spell back on its caster with Reflect", () => {
    const [u, a, t] = [abjurer(), ally(), foe()];
    use(ready(u, a, t), u, "reflect", a);
    const b = ready(t, u, a);
    const hp = a.hp;
    resolve(b, createRng(2), t, BOLT, cellOf(a), a.id);
    expect(a.hp).toBe(hp);
    expect(b.events.some((e) => e.t === "reflect" && e.unit === a.id)).toBe(true);
    expect(b.events.some((e) => (e.t === "hit" || e.t === "miss") && e.target === t.id)).toBe(true);
  });

  it("makes an ally's weapon strike as the Brand's element", () => {
    const [u, a, t] = [abjurer(), ally(), foe()];
    use(ready(u, a, t), u, "dawn_brand", a);
    const b = ready(a, t);
    act(b, createRng(1), a, { do: "ability", ability: "attack", target: cellOf(t) });
    expect(b.events.find((e) => e.t === "hit" && e.unit === a.id)).toMatchObject({ element: "holy" });
    use(ready(u, a, t), u, "frost_brand", a);
    expect(a.mods["enchant.holy"]).toBeUndefined();
    expect(a.mods["enchant.water"]).toBe(1);
  });

  it("Anchors an ally against Readiness damage and Knockdown", () => {
    const [u, a, t] = [abjurer(), ally(), { ...foe(), flags: Array<string>(5).fill("sure_hit") }];
    use(ready(u, a, t), u, "anchor", a);
    expect(addStatus(newBattle(1, []), a, "knockdown")).toBe(false);
    a.ct = 80;
    resolve(ready(t, a), createRng(1), t, { id: "shove", shape: "single", side: "foe", power: 0.1, readiness: 50 }, cellOf(a), a.id);
    expect(a.ct).toBe(80);
  });

  it("stops casting in a Null Zone and ends a spell being charged", () => {
    const [u, t] = [abjurer(), foe()];
    t.abilities = [BOLT];
    t.charge = { ability: BOLT, target: cellOf(u), ticks: 100 };
    resolve(ready(u, t), createRng(1), u, ACTIVE_BY_ID.get("null_zone")!, cellOf(t));
    expect(hasStatus(t, "null_zone")).toBe(true);
    expect(t.charge).toBeUndefined();
    expect(cannotUse(t, BOLT)).toBe("silenced");
  });

  it("may Counterspell a spell aimed at an adjacent ally", () => {
    const [u, a, t] = [{ ...abjurer(), col: 0, row: 4, mods: { counterspell: 100 } }, ally(), foe()];
    const b = ready(t, u, a);
    const hp = a.hp;
    resolve(b, createRng(1), t, BOLT, cellOf(a), a.id);
    expect(a.hp).toBe(hp);
    expect(b.events.some((e) => e.t === "counterspell" && e.unit === u.id)).toBe(true);
  });

  it("starts the battle under Shell with Thick Skin", () => {
    // A Soothsayer carrying the passive as a secondary-Job pick (the Abjurer's own Warded already does it).
    const p = atLevel(promote(rollRecruit(createRng(4), 1, 0), "soothsayer"), 9);
    expect(scionCombatant(p, { id: 1, col: 2, row: 3 }).statuses.some((s) => s.id === "shell")).toBe(false);
    const u = scionCombatant({ ...p, passives: ["thick_skin"], learned: ["thick_skin"] }, { id: 1, col: 2, row: 3 });
    expect(u.statuses.filter((s) => s.id === "shell")).toHaveLength(1);
  });
});
