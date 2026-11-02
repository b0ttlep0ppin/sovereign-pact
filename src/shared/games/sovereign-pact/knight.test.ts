// The Knight's guarding abilities (§12.4): Interpose, Riposte, Rescue, Stand Fast, and the passives
// Valor, Commanding Presence, Shieldbearer, Heavy Step and Bodyguard.
import { describe, expect, it } from "vitest";
import { createRng } from "../../rng.ts";
import { act, advance } from "./combat/battle.ts";
import { enemyCombatant, newBattle } from "./combat/build.ts";
import { hitChance, strike } from "./combat/damage.ts";
import { standardParty } from "./combat/fixtures.ts";
import { hasStatus, pickWeighted } from "./combat/grid.ts";
import { addStatus } from "./combat/status.ts";
import { cellOf, singleTargets } from "./combat/targets.ts";
import type { AbilityDef, Battle, Combatant } from "./combat/types.ts";
import { ABILITY_SET_BY_JOB, ACTIVE_BY_ID } from "./content.ts";

const HIT: AbilityDef = { id: "hit", shape: "single", side: "foe", power: 1 };

function knight(): Combatant {
  const [u] = standardParty(1, 9, 1);
  return { ...u!, id: 1, col: 0, row: 3, mp: 200, tp: 200, abilities: ABILITY_SET_BY_JOB.get("knight")!.actives, mods: {}, statuses: [] };
}
const ally = (row = 3, col = 1): Combatant => ({ ...standardParty(1, 9, 1)[0]!, id: 2, col, row, mods: {}, statuses: [] });
const foe = (id = 10, row = 3): Combatant => ({ ...enemyCombatant("barrow_skeleton", { id, level: 3, col: 0, row }), hp: 9999, maxHp: 9999, flags: Array<string>(10).fill("sure_hit") });

function ready(u: Combatant, ...others: Combatant[]): Battle {
  const b = newBattle(1, [u, ...others]);
  b.actor = u.id;
  u.ct = 200;
  return b;
}
const use = (b: Battle, u: Combatant, ability: string, t: Combatant) => act(b, createRng(3), u, { do: "ability", ability, target: cellOf(t) });

describe("the Knight", () => {
  it("takes the blows meant for an ally after Interpose, until their next turn", () => {
    const [k, a, f] = [knight(), ally(), foe()];
    const b = ready(k, a, f);
    use(b, k, "interpose", a);
    const [kh, ah] = [k.hp, a.hp];
    strike(b, createRng(1), f, a, HIT);
    expect(a.hp).toBe(ah);
    expect(k.hp).toBeLessThan(kh);
    // The Knight's turn ends the guard.
    k.ct = 500;
    advance(b, createRng(1));
    expect(hasStatus(k, "interposing")).toBe(false);
  });

  it("swaps places with an ally in their own row with Rescue, and only there", () => {
    const [k, a, far] = [knight(), ally(3, 2), { ...ally(5, 1), id: 3 }];
    const b = ready(k, a, far);
    expect(singleTargets(b, k, ACTIVE_BY_ID.get("rescue")!).map((t) => t.id)).toEqual([a.id]);
    use(b, k, "rescue", a);
    expect([k.col, k.row, a.col, a.row]).toEqual([2, 3, 0, 3]);
  });

  it("shrugs off Knockdown, Fear and Readiness damage under Stand Fast", () => {
    const k = knight();
    const b = ready(k, foe());
    use(b, k, "stand_fast", k);
    expect(addStatus(b, k, "knockdown")).toBe(false);
    expect(addStatus(b, k, "fear")).toBe(false);
    k.ct = 80;
    strike(b, createRng(1), b.units[1]!, k, { ...HIT, readiness: 50 });
    expect(k.ct).toBe(80);
  });

  it("stuns with a Riposte counter that crits", () => {
    const k = { ...knight(), counter: 100, flags: ["next_crit"] };
    const f = { ...foe(), resist: { physical: 0, mental: 0 } };
    const b = ready(k, f);
    use(b, k, "riposte", k);
    strike(b, createRng(1), f, k, HIT);
    expect(hasStatus(f, "stun")).toBe(true);
  });

  it("ends physical ailments early with Valor", () => {
    const k = { ...knight(), resilience: 100, mods: { valor: 1 } };
    const b = newBattle(1, [k, foe()]);
    addStatus(b, k, "poison");
    k.ct = 500;
    expect(advance(b, createRng(1))).toBe(k);
    expect(hasStatus(k, "poison")).toBe(false);
  });

  it("lends Sagacity/5 % accuracy to allies in the column with Commanding Presence", () => {
    const k = { ...knight(), sagacity: 40, mods: { commandingPresence: 1 } };
    const a = { ...ally(5, 0), flags: [] };
    const f = { ...foe(), evasion: 60, flags: [] };
    const b = newBattle(1, [k, a, f]);
    expect(hitChance(a, f, HIT, b) - hitChance(a, f, HIT)).toBe(8);
    a.col = 1;
    expect(hitChance(a, f, HIT, b)).toBe(hitChance(a, f, HIT));
  });

  it("draws more single-target blows with Bodyguard, and the allies beside them fewer", () => {
    const k = { ...knight(), row: 3, mods: { bodyguard: 1 } };
    const [a, c] = [{ ...ally(4, 0), id: 2 }, { ...ally(6, 0), id: 3 }];
    const n: Record<number, number> = { 1: 0, 2: 0, 3: 0 };
    const rng = createRng(5);
    for (let i = 0; i < 30_000; i++) n[pickWeighted(rng, [k, a, c])!.id]!++;
    // Weights 1.3 : 0.7 : 1 of 3.
    expect(n[1]! / 30_000).toBeCloseTo(1.3 / 3, 1);
    expect(n[2]! / 30_000).toBeCloseTo(0.7 / 3, 1);
  });

  it("has every Knight ability built", () => {
    const set = ABILITY_SET_BY_JOB.get("knight")!;
    expect([...set.actives, ...set.passives].filter((a) => a.later).map((a) => a.id)).toEqual([]);
  });
});
