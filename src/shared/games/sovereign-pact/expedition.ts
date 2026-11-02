// The Expedition Phase (§9.2): the chosen card's seats are shared out among the Houses, each House
// fields its own Scions, the Houses vote a Leader, and the party departs. The chain itself (§9.3) is
// Milestone 6c on; until then the party departs and the Year goes on to the Reckoning.
import { POOL_BY_ID } from "./content.ts";
import type { ExpeditionCard, Person, SovState } from "./state.ts";
import { TUNING } from "./tuning.ts";
import { bossFor, home, rollChain } from "./journey.ts";
import { log, mandatoryYears } from "./year.ts";
import { divide } from "./split.ts";
import { awaited } from "./fight.ts";

export const seatsOf = (card: ExpeditionCard): number => (card.size === 4 ? 4 : 8);

/** A Scion the House can field: its own (a Ward is its host's), not Lost. The Retired return first (§6.12). */
export const able = (s: SovState, house: number): Person[] => s.people.filter((p) => p.host === house && p.status === "scion");

/**
 * The order spare seats go in (§9.2): the House with the fewest expeditions attended, then by rotation
 * from the Year (so a different House is first each Year).
 */
function order(s: SovState, houses: number[]): number[] {
  const H = s.houses.length;
  const turn = (i: number) => (i - (s.year % H) + H) % H;
  return [...houses].sort((a, b) => (s.houses[a]!.attended ?? 0) - (s.houses[b]!.attended ?? 0) || turn(a) - turn(b));
}

/**
 * Shares `n` seats among `houses` (§9.2): equally, the remainder by `order`; no House gets more seats
 * than it has able Scions, and what it cannot take passes on by the same order.
 */
export function share(s: SovState, n: number, houses: number[], room: (h: number) => number): Record<number, number> {
  const seats: Record<number, number> = Object.fromEntries(houses.map((h) => [h, 0]));
  let left = n;
  let open = order(s, houses).filter((h) => room(h) > 0);
  while (left > 0 && open.length) {
    const each = Math.max(1, Math.floor(left / open.length));
    for (const h of open) {
      if (left <= 0) break;
      const take = Math.min(each, room(h) - seats[h]!, left);
      seats[h]! += take;
      left -= take;
    }
    open = open.filter((h) => seats[h]! < room(h));
  }
  return seats;
}

/** The Expedition Phase opens on the chosen card: every House with able Scions is offered seats. */
export function muster(s: SovState, card: ExpeditionCard): void {
  const wanting = s.houses.flatMap((_, i) => (able(s, i).length ? [i] : []));
  const seats = share(s, seatsOf(card), wanting, (h) => able(s, h).length);
  s.expedition = {
    card,
    seats: s.houses.map((_, i) => seats[i] ?? 0),
    party: s.houses.map((_, i) => (seats[i] ? null : [])),
    declined: [],
    chain: [],
    at: 0,
    carry: {},
    out: [],
    seen: [],
  };
  log(s, `The Houses turn the Rift Gate toward ${POOL_BY_ID.get(card.pool)?.name ?? card.pool}, a level ${card.level} ${card.type} expedition for ${seatsOf(card)}.`);
}

/** Why House `house` cannot field `people`, or null. */
export function cannotField(s: SovState, house: number, people: unknown): string | null {
  const e = s.expedition;
  if (!e || e.leader !== undefined || e.votes || e.result) return "No seats are being filled.";
  if (e.party[house] !== null) return e.seats[house] ? "You have already fielded your Scions." : "Your House has no seats on this expedition.";
  if (!Array.isArray(people) || people.some((id) => typeof id !== "number")) return "Name the Scions you field.";
  if (new Set(people).size !== people.length) return "A Scion can take only one seat.";
  if (people.length > e.seats[house]!) return `Your House has ${e.seats[house]} seat${e.seats[house] === 1 ? "" : "s"}.`;
  const mine = new Set(able(s, house).map((p) => p.id));
  if (!people.every((id) => mine.has(id as number))) return "Field only your own Scions.";
  return null;
}

/**
 * House `house` fields `people`; seats it leaves empty are declined and pass on to the Houses that
 * filled theirs and have more able Scions. When every House has fielded, the Leader vote opens.
 */
export function field(s: SovState, house: number, people: number[]): void {
  const e = s.expedition!;
  e.party[house] = people;
  if (people.length < e.seats[house]!) {
    e.seats[house] = people.length;
    e.declined.push(house);
  }
  if (e.party.some((p) => p === null)) return;
  const filled = e.party.reduce((n, p) => n + p!.length, 0);
  const spare = seatsOf(e.card) - filled;
  const more = (h: number) => able(s, h).length - e.party[h]!.length;
  const takers = s.houses.flatMap((_, i) => (!e.declined.includes(i) && more(i) > 0 ? [i] : []));
  if (spare > 0 && takers.length) {
    const extra = share(s, spare, takers, more);
    for (const [h, n] of Object.entries(extra)) {
      if (!n) continue;
      e.seats[+h]! += n;
      e.party[+h] = null;
    }
    return;
  }
  openLeaderVote(s);
}

/** Everyone the Houses fielded, in House order. */
export const roster = (s: SovState): number[] => (s.expedition?.party ?? []).flatMap((p) => p ?? []);

function openLeaderVote(s: SovState): void {
  const e = s.expedition!;
  const party = roster(s);
  // §9.2: with the seats unfilled the card cannot depart (a mandatory one goes with whoever came).
  if (party.length < seatsOf(e.card) && e.card.type !== "mandatory") {
    log(s, `Too few Scions answer the Rift Gate: the expedition to ${POOL_BY_ID.get(e.card.pool)?.name ?? e.card.pool} cannot depart this Year.`);
    e.result = "stayed";
    return;
  }
  if (!party.length) return home(s, "unanswered");
  if (party.length === 1 || s.houses.length === 1) return depart(s, choose(s, party.map((id) => [id, 1])));
  e.votes = s.houses.map(() => null);
}

export function cannotLead(s: SovState, house: number, person: unknown): string | null {
  const e = s.expedition;
  if (!e?.votes) return "No Leader is being chosen.";
  if (e.votes[house] !== null) return "Your House has already voted.";
  return roster(s).includes(person as number) ? null : "Vote for a Scion in the party.";
}

/** House `house` votes for a Leader; the last vote names them. A tie goes to the most travelled, at no cost: only settlement ties cost Accord (Josh, 2026-11-02). */
export function voteLeader(s: SovState, house: number, person: number): void {
  const e = s.expedition!;
  e.votes![house] = person;
  if (e.votes!.some((v) => v === null)) return;
  const tally = new Map<number, number>();
  for (const v of e.votes!) tally.set(v!, (tally.get(v!) ?? 0) + 1);
  depart(s, choose(s, [...tally]));
}

/** The most votes; a tie goes to the Scion with the most expeditions, then the lowest id (the eldest record). */
function choose(s: SovState, tally: [number, number][]): number {
  const runs = (id: number) => s.people.find((p) => p.id === id)!.hist.expeditions ?? 0;
  return tally.reduce((a, b) => (b[1] > a[1] || (b[1] === a[1] && (runs(b[0]) > runs(a[0]) || (runs(b[0]) === runs(a[0]) && b[0] < a[0]))) ? b : a))[0];
}

/** The party departs (§9.2): the Leader's House gains Renown; Jobs, passives and gear lock until it returns. */
function depart(s: SovState, leader: number): void {
  const e = s.expedition!;
  e.leader = leader;
  delete e.votes;
  const lead = s.people.find((p) => p.id === leader)!;
  s.houses[lead.host]!.score.renown += TUNING.expedition.leaderRenown;
  lead.hist.led = (lead.hist.led ?? 0) + 1;
  for (const id of roster(s)) {
    const p = s.people.find((x) => x.id === id)!;
    p.hist.expeditions = (p.hist.expeditions ?? 0) + 1;
  }
  e.party.forEach((p, h) => {
    if (p?.length) s.houses[h]!.attended = (s.houses[h]!.attended ?? 0) + 1;
  });
  e.chain = rollChain(s);
  e.at = 0;
  // A 2×4 card's eight walk as two parties of four (§9.3).
  if (e.card.size === "2x4" && roster(s).length > 1) divide(s, roster(s), leader);
  // The boss is fixed at departure (the Observatory will show it).
  const boss = bossFor(s);
  if (boss) e.card.boss = boss;
  const n = roster(s).length;
  log(s, `${lead.name} of House ${s.houses[lead.host]!.name} leads ${n} Scion${n === 1 ? "" : "s"} through the Rift Gate${mandatoryYears(s).includes(s.year) ? ", and the settlement holds its breath" : ""}.`);
}

/** The Houses that must still act in the Expedition Phase. */
export function waiting(s: SovState): number[] {
  const e = s.expedition;
  if (e?.draft?.length) return [e.draft[0]!];
  if (!e || e.result) return [];
  if (e.fight) return e.fight.unit === undefined ? [] : [awaited(s)!];
  if (e.event) return e.event.votes.flatMap((v, i) => (v === null ? [i] : []));
  // The Gate's Reflection: the party waits on every House still answering its bargain.
  if (s.bargains.pending.length) return [...new Set(s.bargains.pending.map((b) => b.house))].sort((a, b) => a - b);
  if (e.leader !== undefined) return [s.people.find((p) => p.id === e.leader)!.host];
  if (e.votes) return e.votes.flatMap((v, i) => (v === null ? [i] : []));
  return e.party.flatMap((p, i) => (p === null ? [i] : []));
}

/** The bot fields its highest-level Scions (healthiest first among equals) and votes for its own best. */
export function botField(s: SovState, house: number): number[] {
  const best = [...able(s, house)].sort((a, b) => b.level - a.level || a.injuries.length - b.injuries.length || a.id - b.id);
  return best.slice(0, s.expedition!.seats[house]).map((p) => p.id);
}

export function botLeader(s: SovState, house: number): number {
  const party = roster(s).map((id) => s.people.find((p) => p.id === id)!);
  const own = party.filter((p) => p.host === house);
  return [...(own.length ? own : party)].sort((a, b) => b.level - a.level || a.id - b.id)[0]!.id;
}
