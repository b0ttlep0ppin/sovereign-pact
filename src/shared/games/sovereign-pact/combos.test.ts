// Pugilist combos (§12.2, §12.10): patterns, TP for repeats, finishers, and the CT of a sequence.
import { describe, expect, it } from "vitest";
import { createRng } from "../../rng.ts";
import { act } from "./combat/battle.ts";
import { enemyCombatant, newBattle } from "./combat/build.ts";
import { cannotCombo, comboCt, comboTp, fitsPattern } from "./combat/combos.ts";
import { standardParty } from "./combat/fixtures.ts";
import { cellOf } from "./combat/targets.ts";
import type { Combatant } from "./combat/types.ts";
import { ABILITY_SET_BY_JOB, ACTIVE_BY_ID } from "./content.ts";

const mv = (...ids: string[]) => ids.map((id) => ACTIVE_BY_ID.get(id)!);
const pugilist = (tp = 100): Combatant => {
  const [u] = standardParty(1, 9, 1);
  return { ...u!, col: 0, row: 3, tp, mp: 50, abilities: ABILITY_SET_BY_JOB.get("pugilist")!.actives };
};

describe("combos", () => {
  it("read finisher patterns from the moves before them", () => {
    expect(fitsPattern("jab,jab,jab", mv("hook", "jab", "palm_strike"))).toBe(true);
    expect(fitsPattern("kick,kick,jab", mv("low_kick", "high_kick", "jab"))).toBe(true);
    expect(fitsPattern("grapple,grapple", mv("grapple", "jab"))).toBe(false);
    expect(fitsPattern("distinct:5", mv("jab", "hook", "low_kick", "high_kick", "grapple"))).toBe(true);
    expect(fitsPattern("distinct:5", mv("jab", "jab", "low_kick", "high_kick", "grapple"))).toBe(false);
  });

  it("charge 5 TP more for each repeat, and 10 CT for each move past the third", () => {
    expect(comboTp(mv("jab", "jab", "jab", "flurry"))).toEqual([5, 10, 15, 20]);
    expect(comboCt(3)).toBe(100);
    expect(comboCt(5)).toBe(120);
  });

  it("refuse a finisher that is not last or whose pattern is missing, and a sequence beyond the TP", () => {
    const u = pugilist();
    expect(cannotCombo(u, mv("jab", "jab", "jab", "flurry"))).toBeNull();
    expect(cannotCombo(u, mv("flurry", "jab"))).toMatch(/ends/);
    expect(cannotCombo(u, mv("jab", "flurry"))).toMatch(/needs/);
    expect(cannotCombo(pugilist(20), mv("jab", "jab", "jab", "flurry"))).toBe("tp");
  });

  it("play move after move on one target in a single turn", () => {
    const u = pugilist();
    const t = { ...enemyCombatant("barrow_skeleton", { id: 10, level: 3, col: 0, row: 3 }), hp: 9999, maxHp: 9999 };
    const b = newBattle(1, [u, t]);
    b.actor = u.id;
    u.ct = 200;
    act(b, createRng(2), u, { do: "combo", moves: ["jab", "jab", "jab", "flurry"], target: cellOf(t) });
    const swings = b.events.filter((e) => (e.t === "hit" || e.t === "miss") && e.unit === u.id).length;
    expect(swings).toBe(3 + 5);
    expect(u.ct).toBe(200 - 110);
    expect(b.acted).toBe(true);
  });

  it("treats a lone move as a sequence of one, so a finisher cannot open", () => {
    const u = pugilist();
    const t = enemyCombatant("barrow_skeleton", { id: 10, level: 3, col: 0, row: 3 });
    const b = newBattle(1, [u, t]);
    b.actor = u.id;
    expect(() => act(b, createRng(1), u, { do: "ability", ability: "flurry", target: cellOf(t) })).toThrow(/needs|finisher/);
    act(b, createRng(1), u, { do: "ability", ability: "jab", target: cellOf(t) });
    expect(u.tp).toBeLessThan(100 + 8);
  });
});
