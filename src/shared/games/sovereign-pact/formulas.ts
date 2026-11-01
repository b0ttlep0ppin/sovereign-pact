// Derived numbers from §7.3, with the primary Job's multipliers (§12.3); every coefficient lives in
// tuning.ts. Combat's own derived numbers (HP, Durability, Evasion…) are made in combat/build.ts.
import { JOB_BY_ID } from "./content.ts";
import { STATS, type Person, type Stat } from "./state.ts";
import { TUNING } from "./tuning.ts";

/** A person's core stat before Job multipliers and gear. */
export const stat = (p: Pick<Person, "base">, s: Stat): number => p.base[STATS.indexOf(s)]!;

type Jobbed = Pick<Person, "base" | "job">;

/** A core stat in the primary Job: multiplied (rounded down), Speed plus the Job's bonus (§7.2, §12.3). */
export function jobStat(p: Jobbed, s: Stat): number {
  const job = p.job ? JOB_BY_ID.get(p.job) : undefined;
  if (s === "speed") return stat(p, s) + (job?.speed ?? 0);
  return Math.floor(stat(p, s) * (job?.mult[s] ?? 1));
}

/** A pool multiplier of the primary Job (hp, mp), 1 without one. */
export const jobMult = (p: Pick<Person, "job">, pool: "hp" | "mp"): number => (p.job ? (JOB_BY_ID.get(p.job)?.mult[pool] ?? 1) : 1);

export function maxMp(p: Jobbed & Pick<Person, "level">): number {
  const f = TUNING.formulas.maxMp;
  return Math.floor((f.base + f.acuity * jobStat(p, "acuity") + f.sagacity * jobStat(p, "sagacity") + f.level * p.level) * jobMult(p, "mp"));
}

export function maxSanity(p: Jobbed): number {
  const f = TUNING.formulas.sanity;
  return Math.floor(f.base + f.sagacity * jobStat(p, "sagacity") + f.resilience * jobStat(p, "resilience"));
}

/** Max HP: 20 + Might + 3 × Resilience + 2 × Level, × the Job's HP multiplier (§7.3). */
export function maxHp(p: Jobbed & Pick<Person, "level">): number {
  const f = TUNING.formulas.maxHp;
  return Math.floor((f.base + f.might * jobStat(p, "might") + f.resilience * jobStat(p, "resilience") + f.level * p.level) * jobMult(p, "hp"));
}
