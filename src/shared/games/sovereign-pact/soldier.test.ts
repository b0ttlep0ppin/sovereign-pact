// The Soldier's last abilities (§12.5): Brace, Charge!, Throw Weapon, Last Stand, and the passives
// Skullsplitter, Grizzled and Veteran.
import { describe, expect, it } from "vitest";
import { createRng } from "../../rng.ts";
import { act, advance } from "./combat/battle.ts";
import { enemyCombatant, newBattle } from "./combat/build.ts";
import { baseDamage, hpCap } from "./combat/damage.ts";
import { standardParty } from "./combat/fixtures.ts";
import { hasStatus } from "./combat/grid.ts";
import { baseSteps } from "./combat/injury.ts";
import { addStatus } from "./combat/status.ts";
import { cellOf, singleTargets } from "./combat/targets.ts";
import type { AbilityDef, Battle, Combatant } from "./combat/types.ts";
import { ABILITY_SET_BY_JOB, ACTIVE_BY_ID } from "./content.ts";

const HIT: AbilityDef = { id: "hit", shape: "single", side: "foe", power: 1 };

function soldier(col = 0): Combatant {
  const [u] = standardParty(1, 9, 1);
  return { ...u!, id: 1, col, row: 3, mp: 200, tp: 200, abilities: ABILITY_SET_BY_JOB.get("soldier")!.actives, mods: {}, statuses: [], flags: Array<string>(4).fill("sure_hit") };
}
const foe = (id = 10, row = 3, col = 0): Combatant => ({ ...enemyCombatant("barrow_skeleton", { id, level: 3, col, row }), hp: 9999, maxHp: 9999 });

function ready(u: Combatant, ...others: Combatant[]): Battle {
  const b = newBattle(1, [u, ...others]);
  b.actor = u.id;
  u.ct = 200;
  return b;
}
const use = (b: Battle, u: Combatant, ability: string, t: Combatant) => act(b, createRng(3), u, { do: "ability", ability, target: cellOf(t) });

describe("the Soldier", () => {
  it("Defends and cannot be knocked down until their next turn with Brace", () => {
    const u = soldier();
    const b = ready(u, foe());
    use(b, u, "brace", u);
    expect(u.defending).toBe(true);
    expect(addStatus(b, u, "knockdown")).toBe(false);
    u.ct = 500;
    advance(b, createRng(1));
    expect(hasStatus(u, "braced")).toBe(false);
  });

  it("runs from the Back to the Front of its row and strikes with Charge!", () => {
    const u = { ...soldier(2), weapon: { ...soldier().weapon, reach: "melee" as const } };
    const f = foe();
    const b = ready(u, f);
    expect(singleTargets(b, u, ACTIVE_BY_ID.get("charge")!).map((t) => t.id)).toContain(f.id);
    const hp = f.hp;
    use(b, u, "charge", f);
    expect(u.col).toBe(0);
    expect(f.hp).toBeLessThan(hp);
  });

  it("stops the run at whoever stands in the way", () => {
    const u = soldier(2);
    const wall = { ...soldier(0), id: 2 };
    const b = ready(u, wall, foe());
    use(b, u, "charge", b.units[2]!);
    expect(u.col).toBe(1);
  });

  it("throws a melee weapon at a foe in the Back with Throw Weapon", () => {
    const u = { ...soldier(), weapon: { ...soldier().weapon, reach: "melee" as const } };
    const [front, back] = [foe(10, 3, 0), foe(11, 6, 2)];
    const b = ready(u, front, back);
    expect(singleTargets(b, u, ACTIVE_BY_ID.get("throw_weapon")!).map((t) => t.id)).toContain(back.id);
  });

  it("hits harder, Defends each turn and cannot be healed under Last Stand", () => {
    const u = soldier();
    const b = ready(u, foe());
    const before = baseDamage(u, HIT);
    use(b, u, "last_stand", u);
    expect(u.mods.damagePct).toBe(30);
    expect(baseDamage(u, HIT)).toBe(before);
    u.hp = 10;
    expect(hpCap(u)).toBe(10);
    u.ct = 500;
    advance(b, createRng(1));
    expect(u.defending).toBe(true);
  });

  it("lets Might count half again with an axe under Skullsplitter", () => {
    const u = { ...soldier(), might: 50, weapon: { ...soldier().weapon, kind: "axe" } };
    const plain = baseDamage(u, HIT);
    const split = baseDamage({ ...u, mods: { skullsplitter: 50 } }, HIT);
    expect(split / plain).toBeCloseTo((1 + 75 / 25) / (1 + 50 / 25), 1);
    expect(baseDamage({ ...u, weapon: { ...u.weapon, kind: "sword" }, mods: { skullsplitter: 50 } }, HIT)).toBe(plain);
  });

  it("brings a step per 20 Might to the body's injury rolls with Grizzled, not to Sanity's", () => {
    const u = { ...soldier(), might: 45 };
    const g = { ...u, mods: { grizzled: 1 } };
    expect(baseSteps(g, "body") - baseSteps(u, "body")).toBe(2);
    expect(baseSteps(g, "sanity")).toBe(baseSteps(u, "sanity"));
  });

  it("has every Soldier ability built", () => {
    const set = ABILITY_SET_BY_JOB.get("soldier")!;
    expect([...set.actives, ...set.passives].filter((a) => a.later).map((a) => a.id)).toEqual([]);
  });
});
