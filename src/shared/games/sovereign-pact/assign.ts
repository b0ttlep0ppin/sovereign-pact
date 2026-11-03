// Year assignments (§8.3): every person in town is given one thing to do with the Year, by slots the
// House's buildings open. They take effect at the Reckoning (§8.10 steps 3–4) and carry over to the
// next Year until changed; a slot that no longer exists (a ruined building) leaves its person idle.
import { built } from "./commons.ts";
import { BUILDING_BY_ID, INJURY_TABLE_BY_ID, SORTIE_BY_ID } from "./content.ts";
import { caps } from "./combat/build.ts";
import { econ, houseEffects } from "./houses.ts";
import { gainJp, gainXpUpTo } from "./progression.ts";
import type { Assignment, AssignmentKind, JobId, Person, SovState } from "./state.ts";
import { TUNING } from "./tuning.ts";
import { barred, changeOf } from "./change.ts";

const A = TUNING.assignments;

export interface AssignMove {
  person: number;
  to: AssignmentKind | "idle";
  at?: string;
  mentor?: number;
  job?: JobId;
}

const lvl = (s: SovState, house: number, b: string): number => s.houses[house]!.buildings[b] ?? 0;
const at = <T>(table: readonly T[], level: number): T | 0 => (level ? table[level - 1]! : 0);

/** How many of `house`'s people may take `to` (at producer `where`) this Year. */
export function slots(s: SovState, house: number, to: AssignmentKind, where?: string): number {
  switch (to) {
    case "rest":
      return Infinity;
    case "chapel":
      return at(A.chapelSlots, lvl(s, house, "chapel")) + (built(s, "cathedral") ? TUNING.commons.cathedralChapelSlots : 0);
    case "infirmary":
      // The Aqueduct raises every House's Infirmary a level (§8.5).
      return at(A.infirmarySlots, Math.min(3, lvl(s, house, "infirmary") + (built(s, "aqueduct") ? 1 : 0)));
    case "teach":
      return at(A.mentorSeats, lvl(s, house, "training_ground"));
    case "train":
      return at(A.mentorSeats, lvl(s, house, "training_ground")) * A.studentsPerSeat;
    case "study":
      return built(s, "university") ? Infinity : lvl(s, house, "scriptorium") ? A.studySlots : 0;
    case "guard":
      return A.guardSlots;
    case "sortie":
      return A.sortieSlots;
    case "oversee":
      return A.overseeSlots;
    case "work":
      return where && BUILDING_BY_ID.get(where)?.produces && lvl(s, house, where) ? 1 : 0;
  }
}

/** The assignment a person holds, if it is still theirs to hold. */
const holding = (s: SovState, p: Person): Assignment | undefined => (p.status === "lost" ? undefined : s.assign[p.id]);

/** People of `house` holding `to` (at `where`), in roster order. */
export function holders(s: SovState, house: number, to: AssignmentKind, where?: string): Person[] {
  return s.people.filter((p) => p.host === house && holding(s, p)?.to === to && (to !== "work" || s.assign[p.id]!.at === where));
}

const students = (s: SovState, mentor: number) => s.people.filter((p) => holding(s, p)?.to === "train" && s.assign[p.id]!.mentor === mentor);

/** May this person teach: Retired, or any Scion with a mastered Job (§8.3). */
const mayTeach = (p: Person) => p.status !== "recruit" && p.status !== "lost" && (p.status === "retired" || p.mastered.length > 0);

/** Why `house` cannot give that assignment now, or null. */
export function cannotAssign(s: SovState, house: number, m: AssignMove): string | null {
  const p = s.people.find((x) => x.id === m.person);
  if (!p || p.host !== house || p.status === "lost") return "That person is not yours to assign.";
  // An overseer stays at the works they let the House start (Josh 2026-11-03).
  const current = s.assign[p.id];
  if (current?.to === "oversee" && m.to !== "oversee" && s.houses[house]!.works.length > TUNING.town.buildsPerYear + holders(s, house, "oversee").length - 1)
    return `${p.name} is overseeing a build going up this Year.`;
  if (m.to === "idle") return null;
  if (p.status === "recruit" && !["rest", "train", "work"].includes(m.to)) return "A recruit can only rest, train or work.";
  if (barred(p, m.to)) return `A ${changeOf(p)!.name} cannot take that assignment.`;
  const same = (x: Assignment | undefined) => x?.to === m.to && (m.to !== "work" || x.at === m.at);
  if (!same(current) && holders(s, house, m.to, m.at).length >= slots(s, house, m.to, m.at)) return "There is no free slot for that.";
  if (m.to === "sortie") {
    if (p.status !== "scion" && p.status !== "retired") return "Only Scions and the Retired go on Sorties.";
    if (!SORTIE_BY_ID.has(m.at ?? "")) return "Choose one of the Sorties.";
  }
  if (m.to === "teach" && !mayTeach(p)) return "Only the Retired, or a Scion who has mastered a Job, can teach.";
  if (m.to === "train" && m.mentor !== undefined) {
    const mentor = s.people.find((x) => x.id === m.mentor);
    if (!mentor || mentor.host !== house || holding(s, mentor)?.to !== "teach") return "That Mentor is not teaching this Year.";
    if (mentor.id === p.id) return "No one can teach themselves.";
    if (!m.job || !mentor.mastered.includes(m.job)) return "A Mentor teaches a Job they have mastered.";
    if (!students(s, mentor.id).some((x) => x.id === p.id) && students(s, mentor.id).length >= A.studentsPerSeat) return "That Mentor's students are all chosen.";
  }
  return null;
}

export function assign(s: SovState, m: AssignMove): void {
  if (m.to === "idle") {
    delete s.assign[m.person];
  } else {
    const a: Assignment = { to: m.to };
    if (m.to === "work" || m.to === "sortie") a.at = m.at;
    if (m.to === "train" && m.mentor !== undefined) Object.assign(a, { mentor: m.mentor, job: m.job });
    s.assign[m.person] = a;
    // One Sortie a House a Year (§6.11): choosing another sends everyone on it there instead.
    if (m.to === "sortie") {
      const house = s.people.find((p) => p.id === m.person)!.host;
      for (const p of holders(s, house, "sortie")) s.assign[p.id] = { to: "sortie", at: m.at };
    }
  }
  // A Mentor who stops teaching leaves their students training alone.
  for (const [id, x] of Object.entries(s.assign)) if (x.mentor !== undefined && s.assign[x.mentor]?.to !== "teach") s.assign[Number(id)] = { to: "train" };
}

/** Workers on a producer this Year (§8.3): each adds `work` output. */
export const workers = (s: SovState, house: number, building: string): number =>
  Math.min(holders(s, house, "work", building).length, slots(s, house, "work", building));

/**
 * Recruits nobody gave a task work the House's producers on their own (DECISIONS 8ae): each free work
 * slot, buildings in the order they were built, recruits in roster order. Person id -> building.
 */
export function recruitsAtWork(s: SovState, house: number): Map<number, string> {
  const out = new Map<number, string>();
  const h = s.houses[house]!;
  const producers = Object.keys(h.buildings).filter((b) => BUILDING_BY_ID.get(b)?.produces && h.buildings[b]);
  const free = new Map(producers.map((b) => [b, slots(s, house, "work", b) - holders(s, house, "work", b).length]));
  for (const p of s.people) {
    if (p.host !== house || p.status !== "recruit" || s.assign[p.id]) continue;
    const b = producers.find((x) => free.get(x)! > 0);
    if (!b) break;
    free.set(b, free.get(b)! - 1);
    out.set(p.id, b);
  }
  return out;
}

/** Sets every House's idle recruits to work for the Reckoning; returns them, to be stood down after it. */
export function setRecruitsToWork(s: SovState): number[] {
  const set: number[] = [];
  s.houses.forEach((_, i) => {
    for (const [id, at] of recruitsAtWork(s, i)) {
      s.assign[id] = { to: "work", at };
      set.push(id);
    }
  });
  return set;
}

const SANITY_RESULTS = new Set(INJURY_TABLE_BY_ID.get("sanity")?.results.map((r) => r.id));

/**
 * §8.10 steps 3–4: injuries tick down (an Infirmary slot heals the longest Moderate one a Year faster),
 * then each person recovers and grows by assignment. People past a slot's capacity idle.
 */
export function yearOfAssignments(s: SovState): void {
  const seen = new Map<string, number>();
  const top = s.houses.map((_, i) => Math.max(1, ...s.people.filter((p) => p.host === i && p.status === "scion").map((p) => p.level)));
  for (let i = 0; i < s.people.length; i++) {
    let p = s.people[i]!;
    if (p.status === "lost") continue;
    const a = s.assign[p.id];
    const key = `${p.host}:${a?.to}:${a?.at ?? ""}`;
    const fits = a && (seen.get(key) ?? 0) < slots(s, p.host, a.to, a.at);
    if (a) seen.set(key, (seen.get(key) ?? 0) + 1);
    const to = fits ? a.to : undefined;
    let injuries = p.injuries.map((inj) => (inj.years > 0 ? { ...inj, years: inj.years - 1 } : inj));
    if (to === "infirmary") {
      const worst = injuries.filter((x) => x.years > 0).sort((x, y) => y.years - x.years)[0];
      if (worst) worst.years -= 1;
    }
    if (to === "chapel") injuries = injuries.filter((x) => !(SANITY_RESULTS.has(x.id) && x.years > 0));
    p = { ...p, injuries: injuries.filter((x) => x.years !== 0) };
    const max = caps(s, p).sanity;
    const pct =
      (to === "rest" ? A.restSanityPct : A.idleSanityPct) +
      (lvl(s, p.host, "chapel") ? A.chapelBuildingSanityPct : 0) +
      (built(s, "cathedral") ? TUNING.commons.cathedralSanityPct : 0) +
      // Fond of Wine: a House's blood recovers faster in town (§5.7).
      econ(s.houses[p.house]!, "townSanityPct");
    p.sanity = to === "chapel" ? max : Math.min(max, p.sanity + Math.ceil((max * pct) / 100));
    if (to === "train") p = train(s, p, a!, top[p.host]!);
    if (to === "study") p = jpFor(s, p, A.studyJp);
    if (built(s, "university") && p.status === "scion") p = jpFor(s, p, TUNING.commons.universityJp);
    s.people[i] = p;
  }
}

/** gainXpUpTo stops below the level it is given: under a Mentor, below the Mentor; alone, at most `aloneBelow` under the House's best; never past `trainCap`. */
function train(s: SovState, p: Person, a: Assignment, top: number): Person {
  const mentor = a.mentor === undefined ? undefined : s.people.find((x) => x.id === a.mentor && s.assign[x.id]?.to === "teach");
  const jpBoost = 1 + (lvl(s, p.host, "training_ground") >= 2 ? A.tg2JpPct / 100 : 0);
  if (mentor && a.job) {
    const q = gainXpUpTo(p, (A.expeditionXpRef * A.mentorXpPct) / 100, Math.min(A.trainCap + 1, mentor.level));
    return jpFor(s, q, A.mentorJp * jpBoost, a.job);
  }
  const q = gainXpUpTo(p, (A.expeditionXpRef * A.aloneXpPct) / 100, Math.min(A.trainCap, top - A.aloneBelow) + 1);
  return jpFor(s, q, A.aloneJp * jpBoost);
}

/** JP into `job` at the rate the Scion's blood gives it (Martial Lineage: Soldier +15%…, §5.7). */
export function jpFor(s: Pick<SovState, "houses">, p: Person, jp: number, job: JobId | null = p.job): Person {
  const pct = job ? (houseEffects(s.houses[p.house]!).jobXp[job] ?? 0) : 0;
  return gainJp(p, (jp * (100 + pct)) / 100, job);
}
