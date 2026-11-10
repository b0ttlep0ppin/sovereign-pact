// Allied bots (Josh 2026-11-10): "they should always try and take an action, and mostly move to get
// target in range or avoid telegraphed attacks".
import { describe, expect, it } from "vitest";
import { createRng } from "../../../rng.ts";
import { ABILITY_SETS } from "../content.ts";
import { partyOf } from "../journey.ts";
import { calm, campaign } from "../testing.ts";
import { abilityOf } from "./battle.ts";
import { enemyCombatant, newBattle } from "./build.ts";
import { dangerCells, decide } from "./gambits.ts";
import { cellOf } from "./targets.ts";

const scion = () => {
  const s = calm(campaign(1, 5));
  const p = s.people.find((x) => x.host === 0 && x.status === "scion")!;
  return partyOf(s, [p.id])[0]!;
};

describe("allied bots", () => {
  it("act with a later rule rather than step and Wait when the first cannot be done", () => {
    const u = scion();
    // Ember first, with no MP to cast it; a foe far down the rows.
    Object.assign(u, { col: 0, row: 0, mp: 0, abilities: [ABILITY_SETS.flatMap((x) => x.actives).find((a) => a.id === "ember")!] });
    u.gambits = [{ do: "ember" }, { do: "attack" }];
    const b = newBattle(3, [u, enemyCombatant("barrow_skeleton", { id: 99, level: 1, col: 0, row: 7 })]);
    const plan = decide(b, createRng(1), u);
    expect(plan).toEqual({ action: expect.objectContaining({ do: "ability", ability: "attack" }) });
  });

  it("step out of a telegraphed attack, acting from the new cell", () => {
    const u = scion();
    Object.assign(u, { col: 0, row: 3 });
    const foe = enemyCombatant("beast_crow_shaman", { id: 99, level: 1, col: 0, row: 3 });
    const b = newBattle(3, [u, foe]);
    foe.charge = { ability: abilityOf(foe, "black_wings")!, target: cellOf(u), ticks: 2 };
    expect(dangerCells(b, u).has("0:3")).toBe(true);
    const plan = decide(b, createRng(1), u);
    expect(plan.move).toBeDefined();
    expect(dangerCells(b, u).has(`${plan.move![0]}:${plan.move![1]}`)).toBe(false);
    expect(plan.action.do).not.toBe("wait");
  });
});
