// Year assignments (§8.3): every person in town is given one thing to do with the Year, by slots the
// House's buildings open. They take effect at the Reckoning (§8.10 steps 3–4) and carry over to the
// next Year until changed; a slot that no longer exists (a ruined building) leaves its person idle.
import { BUILDING_BY_ID, INJURY_TABLE_BY_ID } from "./content.ts";
import { maxSanity } from "./formulas.ts";
import { gainJp, gainXpUpTo } from "./progression.ts";
import type { Assignment, AssignmentKind, JobId, Person, SovState } from "./state.ts";
import { TUNING } from "./tuning.ts";

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
      return at(A.chapelSlots, lvl(s, house, "chapel"));
    case "infirmary":
      return at(A.infirmarySlots, lvl(s, house, "infirmary"));
    case "teach":
      return at(A.mentorSeats, lvl(s, house, "training_ground"));
    case "train":
      return at(A.mentorSeats, lvl(s, house, "training_ground")) * A.studentsPerSeat;
    case "study":
      return lvl(s, house, "scriptorium") ? A.studySlots : 0;
    case "guard":
      return A.guardSlots;
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
  if (m.to === "idle") return null;
  if (p.status === "recruit" && !["rest", "train", "work"].includes(m.to)) return "A recruit can only rest, train or work.";
  const current = s.assign[p.id];
  const same = (x: Assignment | undefined) => x?.to === m.to && (m.to !== "work" || x.at === m.at);
  if (!same(current) && holders(s, house, m.to, m.at).length >= slots(s, house, m.to, m.at)) return "There is no free slot for that.";
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
    if (m.to === "work") a.at = m.at;
    if (m.to === "train" && m.mentor !== undefined) Object.assign(a, { mentor: m.mentor, job: m.job });
    s.assign[m.person] = a;
  }
  // A Mentor who stops teaching leaves their students training alone.
  for (const [id, x] of Object.entries(s.assign)) if (x.mentor !== undefined && s.assign[x.mentor]?.to !== "teach") s.assign[Number(id)] = { to: "train" };
}

/** Workers on a producer this Year (§8.3): each adds `work` output. */
export const workers = (s: SovState, house: number, building: string): number =>
  Math.min(holders(s, house, "work", building).length, slots(s, house, "work", building));

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
    const max = maxSanity(p);
    const pct = (to === "rest" ? A.restSanityPct : A.idleSanityPct) + (lvl(s, p.host, "chapel") ? A.chapelBuildingSanityPct : 0);
    p.sanity = to === "chapel" ? max : Math.min(max, p.sanity + Math.ceil((max * pct) / 100));
    if (to === "train") p = train(s, p, a!, top[p.host]!);
    if (to === "study") p = gainJp(p, A.studyJp);
    s.people[i] = p;
  }
}

/** gainXpUpTo stops below the level it is given: under a Mentor, below the Mentor; alone, at most `aloneBelow` under the House's best; never past `trainCap`. */
function train(s: SovState, p: Person, a: Assignment, top: number): Person {
  const mentor = a.mentor === undefined ? undefined : s.people.find((x) => x.id === a.mentor && s.assign[x.id]?.to === "teach");
  const jpBoost = 1 + (lvl(s, p.host, "training_ground") >= 2 ? A.tg2JpPct / 100 : 0);
  if (mentor && a.job) {
    const q = gainXpUpTo(p, (A.expeditionXpRef * A.mentorXpPct) / 100, Math.min(A.trainCap + 1, mentor.level));
    return gainJp(q, A.mentorJp * jpBoost, a.job);
  }
  const q = gainXpUpTo(p, (A.expeditionXpRef * A.aloneXpPct) / 100, Math.min(A.trainCap, top - A.aloneBelow) + 1);
  return gainJp(q, A.aloneJp * jpBoost);
}
