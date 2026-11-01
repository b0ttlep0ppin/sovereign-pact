// Derived numbers from §7.3. Milestone 2 adds the rest (HP, Durability, Evasion, Job multipliers);
// every coefficient lives in tuning.ts.
import { STATS, type Person, type Stat } from "./state.ts";
import { TUNING } from "./tuning.ts";

/** A person's core stat before Job multipliers and gear. */
export const stat = (p: Pick<Person, "base">, s: Stat): number => p.base[STATS.indexOf(s)]!;

export function maxMp(p: Pick<Person, "base" | "level">): number {
  const f = TUNING.formulas.maxMp;
  return Math.floor(f.base + f.acuity * stat(p, "acuity") + f.sagacity * stat(p, "sagacity") + f.level * p.level);
}

export function maxSanity(p: Pick<Person, "base">): number {
  const f = TUNING.formulas.sanity;
  return Math.floor(f.base + f.sagacity * stat(p, "sagacity") + f.resilience * stat(p, "resilience"));
}
