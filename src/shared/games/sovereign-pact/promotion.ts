// Promotion (§6.5): a Settlement action that makes a recruit a Scion for Gold and a ceremony slot (one
// a Year, two with a Chapel). The new Scion takes a base Job, turns their Tarot face up and keeps any
// level training gave them; the House outfits them with plain starting gear.
import { equipStarter } from "./items.ts";
import { promote } from "./generate.ts";
import { gainJp } from "./progression.ts";
import { BASE_JOBS, type SovState } from "./state.ts";
import { TUNING } from "./tuning.ts";
import { log } from "./year.ts";

const T = TUNING.promotion;

/** Ceremony slots a House has this Year. */
export const ceremonies = (s: SovState, house: number): number => T.slots + ((s.houses[house]!.buildings.chapel ?? 0) >= 1 ? T.chapelSlots : 0);

export function cannotPromote(s: SovState, house: number, person: number, job: unknown): string | null {
  const p = s.people.find((x) => x.id === person);
  if (!p || p.host !== house || p.status !== "recruit") return "Only one of your recruits can be promoted.";
  if (!BASE_JOBS.includes(job as (typeof BASE_JOBS)[number])) return "A new Scion starts in a base Job.";
  if ((s.houses[house]!.promotions ?? 0) >= ceremonies(s, house)) return "There is no ceremony left this Year.";
  if (s.houses[house]!.gold < T.gold) return `A promotion costs ${T.gold} Gold.`;
  return null;
}

export function promoteRecruit(s: SovState, house: number, person: number, job: (typeof BASE_JOBS)[number]): void {
  const h = s.houses[house]!;
  const i = s.people.findIndex((x) => x.id === person);
  // A new Scion starts with a little JP in the Job, enough for a first ability (tuning pass).
  const scion = gainJp(promote(s.people[i]!, job), TUNING.progression.startJp, job);
  // The newest Scion goes to the end of the House's lists (Josh 2026-11-11), after those raised before.
  s.people.splice(i, 1);
  s.people.push(scion);
  h.gold -= T.gold;
  h.promotions = (h.promotions ?? 0) + 1;
  equipStarter(s, scion);
  log(s, `House ${h.name} raises ${scion.name} to Scion.`);
}

/** The Job a bot gives a recruit: the one its best stat suits (§12). */
export function bestJob(base: readonly number[]): (typeof BASE_JOBS)[number] {
  const by: (typeof BASE_JOBS)[number][] = ["soldier", "knight", "vagabond", "magus", "soothsayer"];
  const top = [0, 1, 2, 3, 4].reduce((a, i) => (base[i]! > base[a]! ? i : a), 0);
  return by[top]!;
}
