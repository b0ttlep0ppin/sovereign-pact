import { describe, expect, it } from "vitest";
import { createRng } from "../../rng.ts";
import { scionCombatant } from "./combat/build.ts";
import { JOBS } from "./content.ts";
import { jobStat, maxHp, stat } from "./formulas.ts";
import { promote, rollRecruit } from "./generate.ts";
import { canTakeJob, changeJob, freePassives, gainJp, gainXp, gainXpUpTo, levelUp, mayWear, mayWield, passiveBudget } from "./progression.ts";
import type { Person } from "./state.ts";
import { TUNING } from "./tuning.ts";

const recruit = (seed = 1): Person => rollRecruit(createRng(seed), 1, 0);
const soldier = (seed = 1) => promote(recruit(seed), "soldier");

describe("levels and growth (§7.2)", () => {
  it("adds growth to the accumulator and keeps the fraction", () => {
    const p = { ...soldier(), growth: [150, 40, 100, 99, 60, 0] as Person["growth"], carry: [60, 70, 0, 0, 50, 0] as Person["carry"] };
    const q = levelUp(p);
    expect(q.level).toBe(2);
    expect(q.base.map((v, i) => v - p.base[i]!)).toEqual([2, 1, 1, 0, 1, 0]);
    expect(q.carry).toEqual([10, 10, 0, 99, 10, 0]);
  });

  it("takes every level XP pays for, up to the cap", () => {
    const per = TUNING.progression.xpPerLevel;
    const q = gainXp(soldier(), per * 3 + 7);
    expect([q.level, q.xp]).toEqual([4, 7]);
    const capped = gainXp(soldier(), per * 100);
    expect(capped.level).toBe(TUNING.progression.levelCap);
  });

  it("caps training XP below the Mentor's level (§6.6)", () => {
    const q = gainXpUpTo(soldier(), 10_000, 5);
    expect(q.level).toBe(4);
    expect(gainXpUpTo(q, 10_000, 4).level).toBe(4);
  });

  it("gives 5 passive points at level 1 and 10 at level 30 (§12.1)", () => {
    expect(passiveBudget({ level: 1 })).toBe(5);
    expect(passiveBudget({ level: 6 })).toBe(6);
    expect(passiveBudget({ level: 30 })).toBe(10);
  });
});

describe("Jobs (§12.1, §12.3)", () => {
  it("lists the 8 base and 6 advanced Jobs, every advanced one with prerequisites", () => {
    expect(JOBS.filter((j) => !j.advanced)).toHaveLength(8);
    expect(JOBS.filter((j) => j.advanced).every((j) => (j.requires ?? []).length > 0)).toBe(true);
  });

  it("opens advanced Jobs by JP in their prerequisites", () => {
    const p = soldier();
    expect(canTakeJob(p, "ravager")).toBe(false);
    expect(() => changeJob(p, "ravager")).toThrow();
    const q = gainJp(p, 400);
    expect(canTakeJob(q, "ravager")).toBe(true);
    expect(canTakeJob(q, "sword_saint")).toBe(false);
    expect(changeJob(q, "ravager").job).toBe("ravager");
  });

  it("applies the Job's multipliers to stats, HP and Speed", () => {
    const p = soldier();
    expect(jobStat(p, "might")).toBe(Math.floor(stat(p, "might") * 1.15));
    const vag = promote(recruit(), "vagabond");
    expect(jobStat(vag, "speed")).toBe(stat(vag, "speed") + 1);
    const magus = promote(recruit(), "magus");
    const raw = 20 + jobStat(magus, "might") + 3 * jobStat(magus, "resilience") + 2 * magus.level;
    expect(maxHp(magus)).toBe(Math.floor(raw * 0.9));
  });

  it("brings the innate passive into battle, and mastery passives once mastered", () => {
    const p = soldier();
    expect(freePassives(p).map((x) => x.id)).toEqual(["stalwart"]);
    const plain = scionCombatant({ ...p, job: null }, { id: 1, col: 0, row: 0 });
    const withJob = scionCombatant(p, { id: 1, col: 0, row: 0 });
    expect(withJob.maxDur!.body).toBeGreaterThan(plain.maxDur!.body);
    const knight = { ...promote(recruit(), "knight"), mastered: ["knight" as const] };
    const k = scionCombatant(knight, { id: 2, col: 0, row: 1 });
    expect(k.guard).toBe(10);
    expect(k.statuses.map((s) => s.id)).toContain("protect");
  });

  it("limits weapons and armor by Job", () => {
    const vag = promote(recruit(), "vagabond");
    expect(mayWield(vag, "sword", 1)).toBe(true);
    expect(mayWield(vag, "sword", 2)).toBe(false);
    expect(mayWear(vag, "medium")).toBe(false);
    expect(mayWear(soldier(), "heavy")).toBe(true);
  });
});
