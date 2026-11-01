// The Gambler (§12.2, §12.7): Cast Lots each turn, Double Down, and the dice abilities.
import { describe, expect, it } from "vitest";
import { createRng, type Rng } from "../../rng.ts";
import { resolve } from "./combat/battle.ts";
import { enemyCombatant, newBattle } from "./combat/build.ts";
import { abilityDice, castLots, rolledAbility } from "./combat/dice.ts";
import { standardParty } from "./combat/fixtures.ts";
import { addStatus } from "./combat/status.ts";
import { cellOf } from "./combat/targets.ts";
import type { Combatant } from "./combat/types.ts";
import { ACTIVE_BY_ID } from "./content.ts";
import { TUNING } from "./tuning.ts";

/** An Rng whose d6 rolls come out as given (1–6), then 4s. */
function dice(...faces: number[]): Rng {
  const base = createRng(1);
  return { ...base, int: (n: number) => (n === 6 ? (faces.shift() ?? 4) - 1 : base.int(n)) };
}

const gambler = (extra: Partial<Combatant> = {}): Combatant => {
  const [u] = standardParty(1, 9, 1);
  return { ...u!, col: 0, row: 3, mods: { ...u!.mods, castLots: 1 }, tp: 50, mp: 999, maxMp: 999, ...extra };
};
const foe = (id = 10) => ({ ...enemyCombatant("barrow_skeleton", { id, level: 3, col: 0, row: 3 }), hp: 9999, maxHp: 9999, evasion: 0 });

describe("Cast Lots", () => {
  it.each([
    [[1, 1], (u: Combatant) => expect(u.mods.nextActionCt).toBe(TUNING.combat.dice.snakeEyesCt)],
    [[1, 2], (u: Combatant) => expect(u.tp).toBe(40)],
    [[3, 3], (u: Combatant) => expect(u.mods["turn.evasion"]).toBe(10)],
    [[4, 5], (u: Combatant) => expect(u.tp).toBe(60)],
    [[5, 6], (u: Combatant) => expect(u.flags).toContain("sure_hit")],
    [[6, 6], (u: Combatant) => expect(u.flags).toContain("next_crit")],
  ] as const)("rolls %j", (faces, check) => {
    const u = gambler();
    const b = newBattle(1, [u, foe()]);
    expect(castLots(b, dice(...faces), u)).toBe(faces[0] + faces[1]);
    check(u);
  });

  it("Weighted turns a 2 into a 3, House Rules makes it at least 7", () => {
    const u = gambler({ mods: { castLots: 1, weighted: 1 } });
    expect(castLots(newBattle(1, [u]), dice(1, 1), u)).toBe(3);
    u.flags.push("lots_floor7");
    expect(castLots(newBattle(1, [u]), dice(1, 2), u)).toBe(7);
    expect(u.flags).not.toContain("lots_floor7");
  });
});

describe("Double Down", () => {
  it("keeps the new total unless it is 4 or more lower, which fizzles", () => {
    const u = gambler();
    const b = newBattle(1, [u]);
    expect(abilityDice(b, dice(3, 3, 2, 3), u, undefined, 1)).toBe(5);
    expect(abilityDice(b, dice(4, 4, 1, 2), u, undefined, 1)).toBeNull();
    // House Edge or Risk Taker: one point more before it fizzles.
    u.mods.fizzleAt = 1;
    expect(abilityDice(b, dice(4, 4, 2, 2), u, undefined, 1)).toBe(4);
  });

  it("Marked Card makes the next roll against the target an 11", () => {
    const u = gambler();
    const t = foe();
    const b = newBattle(1, [u, t]);
    addStatus(b, t, "loaded_card");
    expect(abilityDice(b, dice(1, 1), u, t)).toBe(11);
    expect(abilityDice(b, dice(1, 1), u, t)).toBe(2);
  });

  it("sets the ability's power from the total", () => {
    const toss = ACTIVE_BY_ID.get("knife_toss")!;
    expect(rolledAbility(toss, 8).ab.power).toBeCloseTo(0.8);
    const snake = ACTIVE_BY_ID.get("snake_eyes")!;
    expect(rolledAbility(snake, 3).ab.power).toBe(3);
    expect(rolledAbility(snake, 9).ab.power).toBe(0.5);
    const allIn = ACTIVE_BY_ID.get("all_in")!;
    expect(rolledAbility(allIn, 11).ab.power).toBe(3);
    expect(rolledAbility(allIn, 3).self).toBe(true);
    expect(rolledAbility(ACTIVE_BY_ID.get("fortunes_cure")!, 10).ab.restore?.hpPct).toBe(50);
  });

  it("a fizzle spends the turn and deals nothing", () => {
    const u = gambler();
    const t = foe();
    const b = newBattle(1, [u, t]);
    resolve(b, dice(4, 4, 1, 2), u, ACTIVE_BY_ID.get("knife_toss")!, cellOf(t), t.id, 1);
    expect(b.events.some((e) => e.t === "fizzle")).toBe(true);
    expect(b.events.some((e) => e.t === "hit")).toBe(false);
  });
});
