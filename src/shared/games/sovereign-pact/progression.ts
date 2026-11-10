// Growing a Scion (§6.6, §7.2, §12.1): XP into levels through the growth accumulator, JP per Job,
// Job prerequisites, the passive budget, and the stats a Job's multipliers make. Pure: every function
// returns a new Person.
import { ABILITY_SET_BY_JOB, ACTIVE_BY_ID, CHANGE_BY_ID, JOB_BY_ID, JOB_PASSIVE_BY_ID, TAROT_BY_ID, TRAIT_BY_ID, type ActiveDef, type JobDef } from "./content.ts";
import { jobStat, maxMp } from "./formulas.ts";
import type { Battle } from "./combat/types.ts";
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
/**
 * XP for a fight (tuning pass, Josh 2026-11-03: "give a bonus for people who are underleveled so they can
 * catch up"): `xp`, plus `catchUpPct`% for every level the Scion stands below `top`, the highest level
 * among those who marched, counting at most `catchUpLevels` levels.
 */
export function xpAt(p: Pick<Person, "level">, xp: number, top: number): number {
  return Math.round(xp * (1 + (P.catchUpPct / 100) * Math.min(P.catchUpLevels, Math.max(0, top - p.level))));
}

/** Foes slain in a battle: the enemy side's dead, not its Parts or hazards. */
export const slain = (b: Pick<Battle, "units">): number => b.units.filter((u) => u.side === "enemy" && u.dead && u.partOf === undefined && u.hazard === undefined).length;

/** Pay grows with the Years: +`growPct`% for each Year after the first (Josh 2026-11-10). */
export const grown = (n: number, year: number, pct = 100): number => Math.round((n * pct * (100 + P.growPct * Math.max(0, year - 1))) / 10_000);

/** What a won battle pays each Scion before catch-up: a base, and more for every foe slain (Josh 2026-11-10). */
export const battlePay = (b: Pick<Battle, "units">, year: number, pct = 100): { xp: number; jp: number } => ({
  xp: grown(P.battleXp + P.killXp * slain(b), year, pct),
  jp: grown(P.battleJp + P.killJp * slain(b), year, pct),
});

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

/**
 * The mods a Person's Tarot card gives (§6.8). Reversed (Superstitious) turns each bonus into its loss
 * and an immunity into nothing.
 */
export function tarotMods(p: Pick<Person, "tarot" | "reversed">): Record<string, number> {
  const mods = TAROT_BY_ID.get(p.tarot)?.mods ?? {};
  if (!p.reversed) return mods;
  return Object.fromEntries(Object.entries(mods).flatMap(([k, v]) => (k.startsWith("immune.") ? [] : [[k, -v]])));
}

/** Points to spend on passives: 5, +1 every 6 levels (§12.1), plus extras from Tarot (The World), traits (Worldwalker), items and events. */
export const passiveBudget = (p: Pick<Person, "level"> & Partial<Pick<Person, "tarot" | "reversed" | "traits">>, extra = 0): number =>
  P.passiveBase +
  Math.floor(p.level / P.passiveEvery) +
  extra +
  (p.tarot ? (tarotMods({ tarot: p.tarot, reversed: p.reversed }).passiveBudget ?? 0) : 0) +
  (p.traits ?? []).reduce((n, id) => n + (TRAIT_BY_ID.get(id)?.mods?.passiveBudget ?? 0), 0);

/** Whether a Scion may take `job`: base Jobs always; advanced ones by JP held in their prerequisites (§12.1). */
export function canTakeJob(p: Person, job: JobId): boolean {
  const def = JOB_BY_ID.get(job);
  if (!def) return false;
  // A Change with a fixed Job allows no other (§9.6: a Barrow Knight is a Knight).
  const fixed = p.change && CHANGE_BY_ID.get(p.change.id)?.job;
  if (fixed) return job === fixed;
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

/** The Job an active or passive belongs to. */
const jobOfAbility = (id: string): JobId | undefined => ACTIVE_BY_ID.get(id)?.job ?? JOB_PASSIVE_BY_ID.get(id)?.job;
const priceOf = (id: string): number => ACTIVE_BY_ID.get(id)?.jp ?? JOB_PASSIVE_BY_ID.get(id)?.jp ?? 0;

/** Whether the Scion has bought an active or passive (a mastered Job counts as all bought). */
export function knows(p: Person, id: string): boolean {
  const job = jobOfAbility(id);
  return p.learned.includes(id) || (!!job && p.mastered.includes(job));
}

/** JP not yet spent in a Job: earned less the prices of what was bought there (§12.1). */
export function jpLeft(p: Person, job: JobId): number {
  if (p.mastered.includes(job)) return 0;
  return (p.jp[job] ?? 0) - p.learned.filter((id) => jobOfAbility(id) === job).reduce((n, id) => n + priceOf(id), 0);
}

/** Buys an active or passive of the primary Job with its JP; buying the last one masters the Job. */
export function learn(p: Person, id: string): Person {
  const job = jobOfAbility(id);
  if (!job || job !== p.job) throw new Error(`${id} is not in ${p.name}'s Job`);
  if (knows(p, id)) throw new Error(`${p.name} already knows ${id}`);
  if (jpLeft(p, job) < priceOf(id)) throw new Error(`not enough JP for ${id}`);
  const learned = [...p.learned, id];
  const set = ABILITY_SET_BY_JOB.get(job)!;
  const all = [...set.actives, ...set.passives].every((a) => learned.includes(a.id));
  if (!all) return { ...p, learned };
  // Mastered: the Job's abilities stop being listed one by one, and the JP left over stays earned.
  return { ...p, mastered: [...p.mastered, job], learned: learned.filter((x) => jobOfAbility(x) !== job) };
}

/** Budget points the equipped passives use. */
export const passivePoints = (p: Pick<Person, "passives">): number => p.passives.reduce((n, id) => n + (JOB_PASSIVE_BY_ID.get(id)?.points ?? 0), 0);

/** Equips a bought passive, within the budget (§12.1). */
export function equipPassive(p: Person, id: string, extra = 0): Person {
  const def = JOB_PASSIVE_BY_ID.get(id);
  if (!def || !knows(p, id)) throw new Error(`${p.name} has not bought ${id}`);
  if (p.passives.includes(id)) return p;
  if (passivePoints(p) + def.points > passiveBudget(p, extra)) throw new Error(`no room for ${id} in the passive budget`);
  return { ...p, passives: [...p.passives, id] };
}

export const unequipPassive = (p: Person, id: string): Person => ({ ...p, passives: p.passives.filter((x) => x !== id) });

/** The secondary set: any other Job with at least one active bought (§12.1). */
export function setSecondary(p: Person, job: JobId | undefined): Person {
  if (job === undefined) return { ...p, secondary: undefined };
  if (job === p.job) throw new Error("the secondary set must be another Job");
  const actives = ABILITY_SET_BY_JOB.get(job)?.actives ?? [];
  if (!actives.some((a) => knows(p, a.id))) throw new Error(`${p.name} knows no ${job} actives`);
  return { ...p, secondary: job };
}

/** Actives a Scion brings to battle: bought ones of the primary Job and the secondary set, minus those whose system is not built yet. */
export function battleActives(p: Person): ActiveDef[] {
  const jobs = [p.job, p.secondary].filter((j): j is JobId => !!j);
  return jobs.flatMap((j) => (ABILITY_SET_BY_JOB.get(j)?.actives ?? []).filter((a) => !a.later && knows(p, a.id)));
}

/** Battle mods of the equipped passives. */
export function passiveMods(p: Person): Record<string, number>[] {
  return p.passives.flatMap((id) => (JOB_PASSIVE_BY_ID.get(id)?.mods ? [JOB_PASSIVE_BY_ID.get(id)!.mods!] : []));
}
