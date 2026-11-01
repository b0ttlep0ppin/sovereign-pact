// Simulator parties from real Scions (combat/roster.ts): every Job builds at every level with its
// gear, JP spent and passives within budget, and a battle with it plays to the end.
import { describe, expect, it } from "vitest";
import { createRng } from "../../rng.ts";
import { BASELINE, outfit, realBattle, realParty, realScion, tierFor, withJob } from "./combat/roster.ts";
import { simulate } from "./combat/sim.ts";
import { JOBS } from "./content.ts";
import { gearTotals } from "./items.ts";
import { canTakeJob, passiveBudget, passivePoints } from "./progression.ts";

describe("real Scions for the simulator", () => {
  it.each(JOBS.map((j) => j.id))("build a %s at levels 1, 9 and 30", (job) => {
    for (const level of [1, 9, 30]) {
      const p = realScion(createRng(level), 1, job, level);
      expect(p.job).toBe(job);
      expect(p.level).toBe(level);
      expect(canTakeJob(p, job)).toBe(true);
      expect(p.learned.length).toBeGreaterThan(0);
      expect(passivePoints(p)).toBeLessThanOrEqual(passiveBudget(p));
      const s = outfit(p, level);
      expect(Object.keys(p.gear)).toEqual(expect.arrayContaining(["main", "head", "body", "arms", "legs"]));
      expect(s.items.every((i) => i.tier === tierFor(level))).toBe(true);
      expect(gearTotals(s, p).weapon.power).toBeGreaterThan(0);
    }
  });

  it("set out a party by column and swap a Job into its column's place", () => {
    const party = realParty(1, 9, BASELINE);
    expect(party.map((u) => u.col)).toEqual([0, 1, 2, 2]);
    expect(new Set(party.map((u) => `${u.col},${u.row}`)).size).toBe(4);
    expect(withJob("ravager")).toEqual(["ravager", "knight", "vagabond", "soothsayer"]);
    expect(withJob("conjurer")).toEqual(["soldier", "knight", "conjurer", "soothsayer"]);
  });

  it("fight battles that end, for every Job", () => {
    for (const j of JOBS) expect(simulate(realBattle(3, 3, withJob(j.id))).outcome).toBeDefined();
  });
});
