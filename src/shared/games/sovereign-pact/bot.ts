// The settlement bot (HANDOFF §3.4): cautious. It never spends the Gold it needs for next Year's
// upkeep, and it builds along a fixed plan: food first if the House cannot feed itself, then
// materials, then the buildings that keep Scions alive and growing.
import { cannotAssign, slots, type AssignMove } from "./assign.ts";
import { cannotPledge, projectCost, stillNeeded } from "./commons.ts";
import { cannotPropose } from "./votes.ts";
import { BUILDING_BY_ID, SORTIES, TOWN_EVENT_BY_ID } from "./content.ts";
import { cannotAfford, cautious } from "./omens.ts";
import { fallen } from "./lifecycle.ts";
import { caps } from "./combat/build.ts";
import { barred } from "./change.ts";
import { cannotAccept } from "./deals.ts";
import { type BASE_JOBS, type Assignment, type Deal, type Person, type SovMove, type SovState } from "./state.ts";
import { bestJob, cannotPromote } from "./promotion.ts";
import { buildCost, cannotBuild, levelOf, upkeepDue } from "./town.ts";
import { forHouses, TUNING } from "./tuning.ts";

/** Building and level, in the order the bot wants them. */
const PLAN: readonly (readonly [string, number])[] = [
  ["lumber_camp", 1],
  ["quarry", 1],
  ["infirmary", 1],
  ["lumber_camp", 2],
  ["chapel", 1],
  ["training_ground", 1],
  ["scriptorium", 1],
  ["mine", 1],
  ["forge", 1],
  ["quarry", 2],
  ["infirmary", 2],
  ["chapel", 2],
  ["mine", 2],
  ["vault", 1],
  ["shrine", 1],
  ["training_ground", 2],
  ["scriptorium", 2],
  ["forge", 2],
  ["watchtower", 1],
  ["workshop", 1],
  ["hall_of_petitions", 1],
  ["quarry", 3],
  ["mine", 3],
  ["infirmary", 3],
  ["chapel", 3],
  ["vault", 2],
  ["training_ground", 3],
  ["scriptorium", 3],
  ["forge", 3],
  ["crypt", 1],
  ["kennels", 1],
];

/** Gold a House pays in upkeep a Year (§6.2), the bot's reserve. */
export const upkeepGold = (s: SovState, house: number): number => upkeepDue(s, house).gold;

const grainNeed = (s: SovState, house: number): number => upkeepDue(s, house).grain;

/** The building the bot starts next for `house`, or null. */
export function botBuild(s: SovState, house: number): string | null {
  const h = s.houses[house]!;
  const reserve = upkeepGold(s, house);
  // Food first while the Year's Grain falls short of the House's mouths and the stock will not cover two Years.
  const farm = levelOf(h, "farm");
  const grainIn = (TUNING.economy.income.grain * forHouses(TUNING.economy.incomeScale, s.houses.length) + (farm ? TUNING.town.produce[farm - 1]! : 0)) * (1 - TUNING.economy.tithe);
  const short = grainIn < grainNeed(s, house) && (h.stores.grain ?? 0) < 2 * grainNeed(s, house);
  const wants = short ? [["farm", farm + 1] as const, ...PLAN] : PLAN;
  for (const [id, level] of wants) {
    if (levelOf(h, id) + 1 !== level) continue;
    if (cannotBuild(s, house, id)) continue;
    if (h.gold - (buildCost(id, level, h)!.gold ?? 0) < reserve) continue;
    return id;
  }
  return null;
}

/**
 * The bot's Year plan for `house`, from who its people are (never from what they are doing now, so the
 * plan holds still while it is carried out): the hurt to the Infirmary, the shaken to the Chapel, those
 * who can teach to the Training Ground with the rest as their students, recruits to the producers.
 */
export function assignPlan(s: SovState, house: number): Map<number, Assignment | undefined> {
  const h = s.houses[house]!;
  const left = new Map<string, number>();
  const take = (to: Assignment["to"], at?: string): boolean => {
    const key = `${to}:${at ?? ""}`;
    const n = left.get(key) ?? slots(s, house, to, at);
    if (n <= 0) return false;
    left.set(key, n - 1);
    return true;
  };
  const producers = Object.keys(h.buildings).filter((b) => BUILDING_BY_ID.get(b)?.produces);
  const mine = s.people.filter((p) => p.host === house && p.status !== "lost");
  const plan = new Map<number, Assignment | undefined>();
  const mentors: { id: number; job: Assignment["job"]; room: number }[] = [];
  for (const p of mine) {
    if (p.status === "recruit") continue;
    if (p.injuries.some((x) => x.years > 0) && take("infirmary")) plan.set(p.id, { to: "infirmary" });
    else if (p.sanity * 2 < caps(s, p).sanity && !barred(p, "chapel") && take("chapel")) plan.set(p.id, { to: "chapel" });
    else if ((p.status === "retired" || p.mastered.length) && take("teach")) {
      plan.set(p.id, { to: "teach" });
      if (p.mastered.length) mentors.push({ id: p.id, job: p.mastered[0], room: TUNING.assignments.studentsPerSeat });
    }
  }
  for (const p of mine) {
    if (plan.has(p.id)) continue;
    const work = p.status === "recruit" ? producers.find((b) => take("work", b)) : undefined;
    if (work) {
      plan.set(p.id, { to: "work", at: work });
      continue;
    }
    if (take("train")) {
      const m = mentors.find((x) => x.room > 0 && x.id !== p.id);
      if (m) m.room -= 1;
      plan.set(p.id, m ? { to: "train", mentor: m.id, job: m.job } : { to: "train" });
    } else if (p.status === "scion" && !p.injuries.some((x) => x.years > 0) && take("sortie")) {
      // A Scion with nothing better to do goes on the House's Sortie (the safest, §6.11); one fielded for the expedition goes there instead.
      plan.set(p.id, { to: "sortie", at: SORTIES[0]!.id });
    } else plan.set(p.id, p.status === "recruit" ? undefined : { to: "rest" });
  }
  // A Sortie of one is driven back more often than not: a lone Scion rests instead (tuning pass).
  const sortie = [...plan].filter(([, a]) => a?.to === "sortie");
  if (sortie.length < TUNING.sortie.botMin) for (const [id] of sortie) plan.set(id, { to: "rest" });
  return plan;
}

const sameAs = (a: Assignment | undefined, b: Assignment | undefined) => JSON.stringify(a ?? null) === JSON.stringify(b ?? null);

/**
 * The recruit the bot promotes, or null: while it has fewer Scions than its target and can pay for the
 * ceremony and two Years of upkeep, its recruit with the best stats and growths, in the Job they suit.
 */
export function botPromote(s: SovState, house: number): { person: number; job: (typeof BASE_JOBS)[number] } | null {
  const scions = s.people.filter((p) => p.host === house && p.status === "scion").length;
  if (scions >= forHouses(TUNING.promotion.botScions, s.houses.length)) return null;
  if (s.houses[house]!.gold - TUNING.promotion.gold < 2 * upkeepGold(s, house) + TUNING.economy.upkeep.scionGold) return null;
  const worth = (p: Person) => p.base.reduce((a, b) => a + b, 0) + p.growth.reduce((a, b) => a + b, 0) / 20;
  const best = s.people.filter((p) => p.host === house && p.status === "recruit").sort((a, b) => worth(b) - worth(a))[0];
  if (!best) return null;
  const job = bestJob(best.base);
  return cannotPromote(s, house, best.id, job) ? null : { person: best.id, job };
}

/** The next assignment the bot changes for `house`, or null when its plan is in place. */
export function botAssign(s: SovState, house: number): AssignMove | null {
  const diffs = [...assignPlan(s, house)].filter(([id, a]) => !sameAs(s.assign[id], a));
  for (const [person, a] of diffs) {
    const m: AssignMove = a ? { person, ...a } : { person, to: "idle" };
    if (!cannotAssign(s, house, m)) return m;
  }
  // Every change waits on a slot someone else holds: free one (never loop on someone already idle).
  const held = diffs.find(([id]) => s.assign[id]);
  return held ? { person: held[0], to: "idle" } : null;
}

/** Shared projects in the order the bot funds them (§8.5). */
const PROJECT_PLAN = ["granary", "great_market", "walls", "cathedral", "court_of_peers", "beacon", "aqueduct", "apothecary", "armorer", "weaponsmith", "university", "rift_observatory", "arena", "bastion_of_the_gate"];

/** What the bot keeps back for its own buildings before pledging. */
const KEEP: Partial<Record<string, number>> = { timber: 20, stone: 30, iron: 20, essence: 10 };

/**
 * The bot's pledge, or null: to the first project in its plan still open, up to twice its fair share (the cost over
 * the Houses) at most, from what it has beyond two Years of upkeep and its building stock.
 */
export function botPledge(s: SovState, house: number): { project: string; give: Partial<Record<string, number>> } | null {
  const h = s.houses[house]!;
  const project = PROJECT_PLAN.find((id) => projectCost(s, id));
  if (!project) return null;
  const cost = projectCost(s, project)!;
  const share = Object.values(cost).reduce<number>((a, n) => a + (n ?? 0), 0) / s.houses.length;
  // Up to twice its fair share, since rivals may hold back what it cannot give in kind.
  let room = Math.ceil(2 * share) - (s.commons.funds[project]?.by[house] ?? 0);
  if (room <= 0) return null;
  const give: Partial<Record<string, number>> = {};
  for (const [k, need] of Object.entries(stillNeeded(s, project))) {
    const spare = k === "gold" ? h.gold - 2 * upkeepGold(s, house) : (h.stores[k] ?? 0) - (k === "grain" ? 2 * grainNeed(s, house) : (KEEP[k] ?? 0));
    const n = Math.min(spare, need ?? 0, room);
    if (n > 0) {
      give[k] = n;
      room -= n;
    }
  }
  return Object.keys(give).length && !cannotPledge(s, house, project, give) ? { project, give } : null;
}

/** The bot proposes spending the Commons on the first project of its plan the Commons can help (once a Year). */
export function botPropose(s: SovState, house: number): string | null {
  if (s.vote || s.proposers.includes(house)) return null;
  return PROJECT_PLAN.find((id) => !cannotPropose(s, id)) ?? null;
}

/** The bot votes for spending the Commons on any project of its plan, against the rest; on an event, as it would choose. */
export function botVote(s: SovState, house: number): number {
  const v = s.vote!;
  if (v.kind === "event") return botChoice(s, house, v.subject);
  return PROJECT_PLAN.includes(v.subject) ? v.options.indexOf("yes") : v.options.indexOf("no");
}

/** The House a bot names when an option asks for one: the most renowned other House still standing. */
export function botTarget(s: SovState, house: number): number | null {
  const others = s.houses.map((_, i) => i).filter((i) => i !== house && !fallen(s, i));
  return others.length ? others.reduce((a, b) => (s.houses[b]!.score.renown > s.houses[a]!.score.renown ? b : a)) : null;
}

/** A town event's option for the bot: a kind one it can afford (it is co-operative), else the cautious one. */
export function botChoice(s: SovState, house: number, id: string): number {
  const ev = TOWN_EVENT_BY_ID.get(id)!;
  const h = s.houses[house]!;
  const cost = (i: number) => -Math.min(0, ...ev.options![i]!.outcomes.flatMap((o) => o.effects.map((e) => (e.to ?? "house") === "house" ? (e.resources?.gold ?? 0) : 0)));
  const kind = ev.options!.findIndex((o, i) => o.tags?.includes("kind") && !cannotAfford(s, house, o) && (!o.target || botTarget(s, house) !== null) && h.gold - cost(i) - (o.cost?.resources?.gold ?? 0) >= 2 * upkeepGold(s, house));
  return kind >= 0 ? kind : cautious(ev);
}

/**
 * The bot's Crisis pledge, or null: its fair share of each needed resource (the Need over the Houses),
 * as far as it can give while keeping a Year's upkeep. It never gives in to a temptation.
 */
export function botCrisis(s: SovState, house: number): Partial<Record<string, number>> | null {
  const c = s.crisis;
  if (!c) return null;
  const h = s.houses[house]!;
  const give: Partial<Record<string, number>> = {};
  for (const [k, need] of Object.entries(c.need)) {
    const owed = Math.ceil((need ?? 0) / s.houses.length) - (c.pledges[house]![k] ?? 0);
    const spare = k === "gold" ? h.gold - upkeepGold(s, house) : (h.stores[k] ?? 0) - (k === "grain" ? grainNeed(s, house) : 0);
    const n = Math.min(owed, spare);
    if (n > 0) give[k] = n;
  }
  return Object.keys(give).length ? give : null;
}

/**
 * The bot answers a deal offered to it (cautiously): it accepts when it can pay and gets at least what
 * it gives, counting every unit of Gold or material and an item as 20, and declines otherwise.
 */
export function botDeal(s: SovState, house: number, d: Deal): SovMove {
  const worth = (x: Deal["give"]) => (x.gold ?? 0) + Object.values(x.stores ?? {}).reduce<number>((a, n) => a + (n ?? 0), 0) + 20 * (x.items?.length ?? 0) + 40 * (x.wards?.length ?? 0);
  // The bot keeps its own people: it never gives a Ward.
  const ok = !d.get.wards?.length && worth(d.give) >= worth(d.get) && !cannotAccept(s, house, d.id);
  return ok ? { type: "accept", deal: d.id } : { type: "decline", deal: d.id };
}
