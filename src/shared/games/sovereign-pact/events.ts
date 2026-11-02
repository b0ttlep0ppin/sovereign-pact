// Expedition events (§9.4): met at an Event node, from the card's own pools half the time and the
// general pool the rest. Every House in the party votes on the option; a tie costs Accord and goes to
// the Leader's House. The option's rule names its subject, the Scion or House it happens to; its
// outcome is drawn by weight and its effects land (§9.4's catalogue, the parts built so far).
import { loseAccord } from "./commons.ts";
import { caps, scionCombatant } from "./combat/build.ts";
import { gearTotals } from "./items.ts";
import { roll } from "./combat/injury.ts";
import { TRIP_EVENT_BY_ID, TRIP_EVENTS, type TripEffect, type TripEventDef, type TripOption } from "./content.ts";
import { battle, die, home, marching, person, succeed } from "./journey.ts";
import { gainJp, gainXp, jobStats } from "./progression.ts";
import { ascendancy } from "./score.ts";
import { LOCATIONS, type HistKey, type ScoreCategory, type SovState } from "./state.ts";
import { TUNING } from "./tuning.ts";
import { log, withRng } from "./year.ts";

const flagged = (s: SovState, req: string): boolean => (req.startsWith("!") ? !s.flags.includes(req.slice(6)) : s.flags.includes(req.slice(5)));

/** Events that may meet this party: in the band, their requirements met, not met before this expedition. */
export function eligible(s: SovState, pools: (p: string[]) => boolean): TripEventDef[] {
  const e = s.expedition!;
  return TRIP_EVENTS.filter((d) => pools(d.pools) && d.band[0] <= e.card.level && e.card.level <= d.band[1] && !e.seen.includes(d.id) && (d.requires ?? []).every((r) => flagged(s, r)));
}

/** Draws the node's event (§9.3): the card's pools 50% (its pool or its type), else the general pool. */
export function drawEvent(s: SovState): TripEventDef | undefined {
  const card = s.expedition!.card;
  const own = eligible(s, (p) => p.includes(card.pool) || p.includes(card.type));
  const general = eligible(s, (p) => p.includes("general"));
  return withRng(s, (rng) => {
    const from = own.length && (!general.length || rng.int(100) < TUNING.journey.ownEventPct) ? own : general;
    if (!from.length) return undefined;
    let r = rng.int(from.reduce((n, d) => n + d.weight, 0));
    return from.find((d) => (r -= d.weight) < 0);
  });
}

/** The Houses with Scions still marching: they decide the party's events. */
export const present = (s: SovState): number[] => [...new Set(marching(s).map((id) => person(s, id).host))].sort((a, b) => a - b);

/** An Event node: the event is drawn and put to the party. */
export function meet(s: SovState): void {
  const e = s.expedition!;
  const def = drawEvent(s);
  if (!def) return log(s, "The party passes through a quiet stretch.");
  e.seen.push(def.id);
  e.event = { id: def.id, votes: s.houses.map((_, i) => (present(s).includes(i) ? null : -1)) };
  log(s, `${def.title}: ${def.text}`);
}

export function cannotDecide(s: SovState, house: number, option: unknown): string | null {
  const ev = s.expedition?.event;
  if (!ev) return "No event waits on the party.";
  if (ev.votes[house] !== null) return ev.votes[house] === -1 ? "Your House has no one in the party." : "Your House has already chosen.";
  const def = TRIP_EVENT_BY_ID.get(ev.id)!;
  return Number.isInteger(option) && (option as number) >= 0 && (option as number) < def.options.length ? null : "That is not one of the choices.";
}

/** A House's vote; the last one resolves the event. */
export function decide(s: SovState, house: number, option: number): void {
  const e = s.expedition!;
  const ev = e.event!;
  ev.votes[house] = option;
  if (ev.votes.some((v) => v === null)) return;
  const def = TRIP_EVENT_BY_ID.get(ev.id)!;
  const tally = def.options.map((_, i) => ev.votes.filter((v) => v === i).length);
  const top = Math.max(...tally);
  const tied = tally.flatMap((n, i) => (n === top ? [i] : []));
  let pick = tied[0]!;
  if (tied.length > 1) {
    // §9.4: a tied vote costs Accord and goes to the Leader.
    loseAccord(s, TUNING.tracks.tieCost);
    const lead = ev.votes[person(s, e.leader!).host]!;
    pick = tied.includes(lead) ? lead : pick;
  }
  delete e.event;
  resolve(s, def.options[pick]!);
}

/** The Scions an option's rule makes its subject (§9.4); a `house:` rule makes that House's Scions present the subject. */
export function subjects(s: SovState, rule: string): { scions: number[]; house: number | null } {
  const e = s.expedition!;
  const ids = marching(s);
  const one = (id: number) => ({ scions: [id], house: person(s, id).host });
  if (rule === "vote") return { scions: ids, house: null };
  if (rule === "leader") return one(e.leader!);
  if (rule === "scion:random") return one(withRng(s, (rng) => rng.pick(ids)));
  const [, a, b] = rule.split(":");
  if (rule.startsWith("house:")) {
    const houses = present(s);
    const by = (h: number) => ascendancy(s, h);
    const h = houses.reduce((x, y) => ((a === "lowest_standing" ? by(y) < by(x) : by(y) > by(x)) ? y : x));
    return { scions: ids.filter((id) => person(s, id).host === h), house: h };
  }
  const score = (id: number): number => {
    const p = person(s, id);
    if (b) return b === "sanity" ? p.sanity : jobStats(p)[b as keyof ReturnType<typeof jobStats>];
    const [, key] = a!.split("_") as [string, string];
    return p.hist[key as HistKey] ?? 0;
  };
  const high = a === "highest" || a!.startsWith("most_");
  // Ties go to the first fielded.
  return one(ids.reduce((x, y) => ((high ? score(y) > score(x) : score(y) < score(x)) ? y : x)));
}

/** The option is taken: its subject found, its outcome drawn, its effects applied in order. */
export function resolve(s: SovState, option: TripOption): void {
  const { scions, house } = subjects(s, option.rule);
  const outcome = withRng(s, (rng) => {
    let r = rng.int(option.outcomes.reduce((n, o) => n + o.w, 0));
    return option.outcomes.find((o) => (r -= o.w) < 0)!;
  });
  const who = option.rule === "vote" ? "" : `${scions.map((id) => person(s, id).name).join(" and ")}: `;
  log(s, `${option.label} ${who}${outcome.text}`);
  for (const fx of outcome.effects) {
    if (s.expedition!.result) return;
    apply(s, fx, fx.to === "party" ? marching(s) : scions, option.rule === "vote" ? null : house);
  }
  if (s.expedition!.result) return;
  // An event can kill: with no one left the party is gone; a dead Leader is replaced.
  if (!marching(s).length) return home(s, "wiped");
  succeed(s);
}

const pctOf = (max: number, pct: number) => Math.round((max * pct) / 100);

/** One effect on `ids` (Scions) and `house` (the subject's House; null: the Commons, or every House present). */
function apply(s: SovState, fx: TripEffect, ids: number[], house: number | null): void {
  const e = s.expedition!;
  for (const id of ids) {
    const at = s.people.findIndex((p) => p.id === id);
    if (at < 0) continue;
    let p = s.people[at]!;
    const cap = caps(s, p);
    if (fx.sanity) p.sanity = Math.max(0, Math.min(cap.sanity, p.sanity + pctOf(cap.sanity, fx.sanity)));
    if (fx.mp) p.mp = Math.max(0, Math.min(cap.mp, p.mp + pctOf(cap.mp, fx.mp)));
    if (fx.durability) {
      const c = (e.carry[id] ??= { dur: {}, broken: [] });
      const max = fullDurability(s, id);
      for (const loc of fx.loc ? [fx.loc] : LOCATIONS) {
        c.dur[loc] = Math.max(0, Math.min(max[loc], (c.dur[loc] ?? max[loc]) + pctOf(max[loc], fx.durability)));
        if (c.dur[loc] === 0 && !c.broken.includes(loc)) c.broken.push(loc);
        if (c.dur[loc]! > 0) c.broken = c.broken.filter((l) => l !== loc);
      }
    }
    if (fx.xp) p = gainXp(p, fx.xp);
    if (fx.jp) p = gainJp(p, fx.jp);
    s.people[at] = p;
    if (fx.injury) {
      const r = withRng(s, (rng) => roll(rng, fx.injury!, 0)).result;
      log(s, `${p.name}: ${r.name}.`);
      if (r.death || r.mortal) die(s, p, r.id);
      else if (r.lasting) p.injuries.push({ id: r.id, years: r.lasting.years });
    }
  }
  const houses = house === null ? present(s) : [house];
  for (const [k, n] of Object.entries(fx.resources ?? {})) {
    // §9.10: finds go to the subject's House; a party's finds to the Commons.
    if (house === null) {
      if (k === "gold") s.commons.gold = Math.max(0, s.commons.gold + n!);
      else s.commons.stores[k] = Math.max(0, (s.commons.stores[k] ?? 0) + n!);
    } else if (k === "gold") s.houses[house]!.gold = Math.max(0, s.houses[house]!.gold + n!);
    else s.houses[house]!.stores[k] = Math.max(0, (s.houses[house]!.stores[k] ?? 0) + n!);
  }
  for (const [k, n] of Object.entries(fx.score ?? {})) for (const h of houses) s.houses[h]!.score[k as ScoreCategory] += n!;
  if (fx.accord) {
    if (fx.accord < 0) loseAccord(s, -fx.accord);
    else s.accord = Math.min(100, s.accord + fx.accord);
  }
  if (fx.doom) s.doom = Math.max(0, Math.min(100, s.doom + fx.doom));
  if (fx.flag && !s.flags.includes(fx.flag)) s.flags.push(fx.flag);
  // Passed by, never the boss.
  if (fx.skip) e.at = Math.min(e.chain.length - 1, e.at + fx.skip);
  if (fx.encounter) battle(s, false, fx.encounter);
  else if (fx.retreat) home(s, "retreated");
}

/** A Scion's full Durability by location, as a battle would build it. */
function fullDurability(s: SovState, id: number): Record<(typeof LOCATIONS)[number], number> {
  const p = person(s, id);
  return scionCombatant(p, { id: 1, col: 0, row: 0, gear: gearTotals(s, p), house: s.houses[p.house] }).maxDur!;
}

/** The bot's choice: a cautious option if there is one, else the first. */
export function botDecide(s: SovState): number {
  const def = TRIP_EVENT_BY_ID.get(s.expedition!.event!.id)!;
  const safe = def.options.findIndex((o) => o.tags?.includes("cautious"));
  return safe >= 0 ? safe : 0;
}
