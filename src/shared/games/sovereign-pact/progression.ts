// Growing a Scion (§6.6, §7.2, §12.1): XP into levels through the growth accumulator, JP per Job,
// Job prerequisites, the passive budget, and the stats a Job's multipliers make. Pure: every function
// returns a new Person.
import { JOB_BY_ID, type JobDef } from "./content.ts";
import { jobStat, maxMp } from "./formulas.ts";
import { STATS, type JobId, type Person, type Six, type Stat } from "./state.ts";
import { TUNING } from "./tuning.ts";

const P = TUNING.progression;

/** One level: each stat's growth (hundredths) goes into its accumulator; whole points become stat (§7.2). */
export function levelUp(p: Person): Person {
  if (p.level >= P.levelCap) return p;
  const base = [...p.base] as Six;
  const carry = [...p.carry] as Six;
  for (let i = 0; i < STATS.length; i++) {
    carry[i]! += p.growth[i]!;
    base[i]! += Math.floor(carry[i]! / 100);
    carry[i]! %= 100;
  }
  const next = { ...p, base, carry, level: p.level + 1 };
  // A new level's extra MP arrives with it; MP otherwise only refills in town (§7.1).
  return { ...next, mp: p.mp + Math.max(0, maxMp(next) - maxMp(p)) };
}

/** Adds XP and takes every level it pays for; XP past the cap is kept but buys nothing. */
export function gainXp(p: Person, xp: number): Person {
  let q: Person = { ...p, xp: p.xp + Math.max(0, Math.round(xp)) };
  while (q.level < P.levelCap && q.xp >= P.xpPerLevel) q = { ...levelUp(q), xp: q.xp - P.xpPerLevel };
  return q;
}

/** XP capped so the Scion ends at most at `maxLevel` (training under a Mentor, §6.6). */
export function gainXpUpTo(p: Person, xp: number, maxLevel: number): Person {
  if (p.level >= maxLevel) return p;
  const room = (maxLevel - p.level) * P.xpPerLevel - p.xp;
  return gainXp(p, Math.min(xp, Math.max(0, room - 1)));
}

/** JP go to the Job the Scion is in (§6.6). */
export function gainJp(p: Person, jp: number, job: JobId | null = p.job): Person {
  if (!job) return p;
  return { ...p, jp: { ...p.jp, [job]: (p.jp[job] ?? 0) + Math.max(0, Math.round(jp)) } };
}

/** Points to spend on passives: 5, +1 every 6 levels (§12.1), plus extras from Tarot, items and events. */
export const passiveBudget = (p: Pick<Person, "level">, extra = 0): number => P.passiveBase + Math.floor(p.level / P.passiveEvery) + extra;

/** Whether a Scion may take `job`: base Jobs always; advanced ones by JP held in their prerequisites (§12.1). */
export function canTakeJob(p: Person, job: JobId): boolean {
  const def = JOB_BY_ID.get(job);
  if (!def) return false;
  if (!def.advanced) return true;
  if (p.mastered.includes(job) || (p.jp[job] ?? 0) > 0) return true;
  return (def.requires ?? []).every((r) => (p.jp[r.job] ?? 0) >= r.jp);
}

/** Changes the primary Job (in town only; the caller checks that). */
export function changeJob(p: Person, job: JobId): Person {
  if (!canTakeJob(p, job)) throw new Error(`${p.name} cannot take ${job} yet`);
  return { ...p, job, jp: { ...p.jp, [job]: p.jp[job] ?? 0 }, secondary: p.secondary === job ? undefined : p.secondary };
}

export const jobOf = (p: Pick<Person, "job">): JobDef | undefined => (p.job ? JOB_BY_ID.get(p.job) : undefined);

/** All six stats in the primary Job (§7.2, §12.3). */
export function jobStats(p: Person): Record<Stat, number> {
  return Object.fromEntries(STATS.map((s) => [s, jobStat(p, s)])) as Record<Stat, number>;
}

/** The passives a Scion has for free: the primary Job's innate one and every mastered Job's mastery one (§12.1). */
export function freePassives(p: Person): JobDef["innate"][] {
  const out: JobDef["innate"][] = [];
  const job = jobOf(p);
  if (job) out.push(job.innate);
  for (const id of p.mastered) {
    const m = JOB_BY_ID.get(id)?.mastery;
    if (m) out.push(m);
  }
  return out;
}

/** Whether `p`'s primary Job may wield a weapon type (and hands) or wear an armor class (§12.3). */
export function mayWield(p: Person, type: string, hands: 1 | 2): boolean {
  const job = jobOf(p);
  if (!job) return type === "unarmed";
  return job.weapons.some((w) => {
    const [t, h] = w.split(":");
    return t === type && (!h || h === `${hands}h`);
  });
}

const ARMOR_ORDER = ["light", "medium", "heavy"] as const;
export function mayWear(p: Person, cls: (typeof ARMOR_ORDER)[number]): boolean {
  const job = jobOf(p);
  return !!job && ARMOR_ORDER.indexOf(cls) <= ARMOR_ORDER.indexOf(job.armor);
}
