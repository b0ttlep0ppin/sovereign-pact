// The opening recruit draft (Josh, 2026-11-02, decision card: a shared draft, taking turns). When every
// House has sworn, the city's first volunteers stand in one pool: a few more than the Houses can take.
// The Houses pick in a random order, then snake order, each pick promoted at once into the base Job its
// House chooses. When the last pick is made, Year 1 opens. The rest of each House's recruits are born
// with its own blood, as before.
import { caps } from "./combat/build.ts";
import { promote, rollRecruit } from "./generate.ts";
import { equipStarter } from "./items.ts";
import { snake } from "./loot.ts";
import { bestJob } from "./promotion.ts";
import { gainJp } from "./progression.ts";
import { BASE_JOBS, type Person, type SovState } from "./state.ts";
import { forHouses, TUNING } from "./tuning.ts";
import { log, openYear, withRng } from "./year.ts";

export type BaseJob = (typeof BASE_JOBS)[number];

/** The draft in progress: the pool, whose pick each turn is, and how many picks are made. */
export interface Muster {
  pool: Person[];
  order: number[];
  at: number;
}

/** Fills the pool and deals the order; called once every House has sworn. */
export function openMuster(s: SovState): void {
  const H = s.houses.length;
  const picks = forHouses(TUNING.houses.startScions, H);
  const size = H * (picks + TUNING.founding.musterExtra);
  // The city's volunteers carry no House's blood.
  const pool = withRng(s, (rng) => Array.from({ length: size }, () => rollRecruit(rng, s.nextId++, -1)));
  s.muster = { pool, order: snake(s, s.houses.map((_, i) => i), H * picks), at: 0 };
  log(s, "The city's volunteers gather before the Houses.");
}

/** Whose pick it is, or null outside the draft. */
export const musterTurn = (s: SovState): number | null => (s.muster ? (s.muster.order[s.muster.at] ?? null) : null);

export function cannotMuster(s: SovState, house: number, person: unknown, job: unknown): string | null {
  if (!s.muster) return "There is no draft now.";
  if (musterTurn(s) !== house) return "It is another House's pick.";
  if (!s.muster.pool.some((p) => p.id === person)) return "Choose someone from the volunteers.";
  if (!BASE_JOBS.includes(job as BaseJob)) return "Choose a base Job for them.";
  return null;
}

/** The House takes a volunteer and raises them to a Scion; the last pick opens Year 1. */
export function muster(s: SovState, house: number, person: number, job: BaseJob): void {
  const m = s.muster!;
  const recruit = m.pool.find((p) => p.id === person)!;
  m.pool = m.pool.filter((p) => p.id !== person);
  const scion = gainJp(promote({ ...recruit, house, host: house }, job), TUNING.progression.startJp, job);
  s.people.push(scion);
  equipStarter(s, scion);
  // Start full, by the caps their traits and gear set (a Brittle Mind starts at its lower cap).
  Object.assign(scion, caps(s, scion));
  log(s, `House ${s.houses[house]!.name} takes ${scion.name} as a ${job.replace(/_/g, " ")}.`);
  m.at += 1;
  if (m.at < m.order.length) return;
  delete s.muster;
  for (const h of s.houses) h.sealed = false;
  openYear(s);
}

/** A bot takes the volunteer with the best stats and growths, in the Job they suit. */
/** The order a bot fills its House's missing Jobs in. */
const BOT_ROLES: BaseJob[] = ["knight", "soothsayer", "magus", "soldier", "vagabond", "minstrel", "pugilist", "gambler"];

export function botMuster(s: SovState): { person: number; job: BaseJob } {
  const worth = (p: Person) => p.base.reduce((a, b) => a + b, 0) + p.growth.reduce((a, b) => a + b, 0) / 20;
  const best = [...s.muster!.pool].sort((a, b) => worth(b) - worth(a) || a.id - b.id)[0]!;
  // A Job the House doesn't field yet, so a bot's party has a healer and a caster as well as blades.
  const house = musterTurn(s)!;
  const fielded = new Set(s.people.filter((p) => p.host === house && p.status === "scion").map((p) => p.job));
  const job = bestJob(best.base);
  return { person: best.id, job: fielded.has(job) ? (BOT_ROLES.find((j) => !fielded.has(j)) ?? job) : job };
}
