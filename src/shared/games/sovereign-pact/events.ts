// Expedition events (§9.4): met at an Event node, from the card's own pools half the time and the
// general pool the rest. Every House in the party votes on the option; a tie goes to the Leader's
// House at no cost (only settlement ties cost Accord). The option's rule names its subject, the
// Scion or House it happens to; its outcome is drawn by weight and its effects land (§9.4's
// catalogue; transformation and secret events come later).
import { loseAccord } from "./commons.ts";
import { caps, scionCombatant } from "./combat/build.ts";
import { rollRecruit } from "./generate.ts";
import { gearTotals } from "./items.ts";
import { SHOPS, stockTier } from "./market.ts";
import { found } from "./loot.ts";
import { isWard } from "./wards.ts";
import { roll } from "./combat/injury.ts";
import { BUILDING_BY_ID, HOUSE_TRAIT_BY_ID, INJURY_TABLE_BY_ID, TAROT, TAROT_BY_ID, TRAIT_BY_ID, TRAITS, TRIP_EVENT_BY_ID, TRIP_EVENTS, type InjuryTableId, type TripEffect, type TripEventDef, type TripOption } from "./content.ts";
import { battle, die, home, lose, marching, person, succeed } from "./journey.ts";
import { gainJp, gainXp, jobStats } from "./progression.ts";
import { ascendancy } from "./score.ts";
import { GEAR_SLOTS, LOCATIONS, STATS, type HistKey, type Person, type ScoreCategory, type SovState } from "./state.ts";
import { TUNING } from "./tuning.ts";
import { log, withRng } from "./year.ts";
import { change, unchange } from "./change.ts";

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

/** Whether every Scion's owner picks for them (§9.4 `each_scion`) instead of the party voting. */
export const eachScion = (id: string): boolean => TRIP_EVENT_BY_ID.get(id)!.options.every((o) => o.rule === "each_scion");

/** Whether each House picks secretly for its own Scions (§9.4 `secret`; Josh, Q91). */
export const secretEvent = (id: string): boolean => TRIP_EVENT_BY_ID.get(id)!.options.every((o) => o.rule === "secret");

/** An Event node: the event is drawn and put to the party (or, for `each_scion`, to every Scion's House). */
export function meet(s: SovState): void {
  const e = s.expedition!;
  const def = drawEvent(s);
  if (!def) return log(s, "The party passes through a quiet stretch.");
  e.seen.push(def.id);
  e.event = { id: def.id, votes: s.houses.map((_, i) => (present(s).includes(i) ? null : -1)) };
  if (eachScion(def.id)) e.event.picks = Object.fromEntries(marching(s).map((id) => [id, null]));
  log(s, `${def.title}: ${def.text}`);
}

export function cannotDecide(s: SovState, house: number, option: unknown, who?: unknown): string | null {
  const ev = s.expedition?.event;
  if (!ev) return "No event waits on the party.";
  if (ev.votes[house] !== null) return ev.votes[house] === -1 ? "Your House has no one in the party." : "Your House has already chosen.";
  const def = TRIP_EVENT_BY_ID.get(ev.id)!;
  if (!(Number.isInteger(option) && (option as number) >= 0 && (option as number) < def.options.length)) return "That is not one of the choices.";
  if (!ev.picks) return null;
  const id = who as number;
  if (!(id in ev.picks) || person(s, id).host !== house) return "Choose for one of your own Scions in the party.";
  return ev.picks[id] === null ? null : "That Scion has already chosen.";
}

/** A House's vote (or its pick for one of its Scions); the last one resolves the event. */
export function decide(s: SovState, house: number, option: number, who?: number): void {
  const e = s.expedition!;
  const ev = e.event!;
  const def = TRIP_EVENT_BY_ID.get(ev.id)!;
  if (ev.picks) {
    ev.picks[who!] = option;
    if (Object.entries(ev.picks).every(([id, v]) => v !== null || person(s, +id).host !== house)) ev.votes[house] = option;
    if (ev.votes.some((v) => v === null)) return;
    // Resolved together: each Scion meets what their House chose for them.
    const picks = Object.entries(ev.picks).map(([id, v]) => [+id, v!] as const);
    delete e.event;
    for (const [id, v] of picks) {
      if (e.result) return;
      if (marching(s).includes(id)) land(s, def.options[v]!, { scions: [id], house: person(s, id).host });
    }
    return after(s);
  }
  ev.votes[house] = option;
  if (ev.votes.some((v) => v === null)) return;
  if (secretEvent(ev.id)) return revealSecret(s);
  const tally = def.options.map((_, i) => ev.votes.filter((v) => v === i).length);
  const top = Math.max(...tally);
  const tied = tally.flatMap((n, i) => (n === top ? [i] : []));
  let pick = tied[0]!;
  if (tied.length > 1) {
    // A tie goes to the Leader's House, at no cost: only settlement ties cost Accord (Josh, 2026-11-02).
    const lead = ev.votes[person(s, e.leader!).host]!;
    pick = tied.includes(lead) ? lead : pick;
  }
  delete e.event;
  resolve(s, def.options[pick]!);
}

type Subjects = { scions: number[]; house: number | null };

/**
 * The Scions an option's rule makes its subject (§9.4); a `house:` rule makes that House's Scions
 * present the subject. `a|b` tries `b` when nobody fits `a`; when nobody fits any, the whole party is.
 */
export function subjects(s: SovState, rule: string): Subjects {
  for (const r of rule.split("|")) {
    const got = subjectOf(s, r);
    if (got) return got;
  }
  return { scions: marching(s), house: null };
}

const tagged = (tag: string, ids: readonly string[], byId: ReadonlyMap<string, { tags?: string[] }>) =>
  ids.some((id) => id === tag || byId.get(id)?.tags?.includes(tag));

function subjectOf(s: SovState, rule: string): Subjects | null {
  const e = s.expedition!;
  const ids = marching(s);
  const one = (id: number | undefined) => (id === undefined ? null : { scions: [id], house: person(s, id).host });
  const [kind, a, b] = rule.split(":") as [string, string?, string?];
  if (rule === "vote") return { scions: ids, house: null };
  if (rule === "leader") return one(e.leader);
  if (rule === "scion:random") return one(withRng(s, (rng) => rng.pick(ids)));
  if (kind === "house") {
    const houses = present(s);
    const of = (h: number | undefined) => (h === undefined ? null : { scions: ids.filter((id) => person(s, id).host === h), house: h });
    if (a === "random") return of(withRng(s, (rng) => rng.pick(houses)));
    if (a === "trait") return of(houses.find((h) => tagged(b!, s.houses[h]!.traits, HOUSE_TRAIT_BY_ID)));
    const by = (h: number) => ascendancy(s, h);
    return of(houses.reduce((x, y) => ((a === "lowest_standing" ? by(y) < by(x) : by(y) > by(x)) ? y : x)));
  }
  // Ties go to the first fielded.
  const find = (test: (p: Person) => boolean) => one(ids.find((id) => test(person(s, id))));
  if (a === "tarot") return find((p) => p.tarot === b);
  if (a === "trait") return find((p) => tagged(b!, p.traits, TRAIT_BY_ID));
  if (a === "retired_once") return find((p) => (p.hist.retired ?? 0) > 0);
  // A Changed Scion is one of a kind to the things out there (§9.6).
  if (a === "changed") return find((p) => !!p.change);
  if (a === "change") return find((p) => p.change?.id === b);
  if (a === "injured") return find((p) => p.injuries.some((i) => b === "any" || INJURY_TABLE_BY_ID.get(b as InjuryTableId)?.results.some((r) => r.id === i.id)));
  const score = (id: number): number => {
    const p = person(s, id);
    if (a === "heaviest_gear") return gearTotals(s, p).weight;
    if (a === "most_open_slots") return GEAR_SLOTS.filter((k) => p.gear[k] === undefined).length;
    if (b) return b === "sanity" ? p.sanity : jobStats(p)[b as keyof ReturnType<typeof jobStats>];
    return p.hist[a!.split("_")[1] as HistKey] ?? 0;
  };
  const high = a === "highest" || a!.startsWith("most_") || a === "heaviest_gear";
  return one(ids.reduce((x, y) => ((high ? score(y) > score(x) : score(y) < score(x)) ? y : x)));
}

/**
 * A secret event's reveal (Q91, Josh 2026-11-02): each House's pick happens to its own Scions, and
 * an outcome may turn on what the others chose (`when`: another House picked that option, or none did).
 */
function revealSecret(s: SovState): void {
  const e = s.expedition!;
  const ev = e.event!;
  const def = TRIP_EVENT_BY_ID.get(ev.id)!;
  delete e.event;
  const picks = ev.votes.flatMap((v, h) => (v !== null && v >= 0 ? [[h, v] as const] : []));
  log(s, `The choices are revealed: ${picks.map(([h, v]) => `House ${s.houses[h]!.name}, ${def.options[v]!.label}`).join("; ")}`);
  for (const [h, v] of picks) {
    if (e.result) return;
    const others = picks.filter(([x]) => x !== h).map(([, o]) => def.options[o]!.id);
    const scions = marching(s).filter((id) => person(s, id).host === h);
    if (scions.length) land(s, def.options[v]!, { scions, house: h }, others);
  }
  after(s);
}

/** The option is taken: its subject found, its outcome drawn, its effects applied in order. */
export function resolve(s: SovState, option: TripOption): void {
  land(s, option, subjects(s, option.rule));
  after(s);
}

function land(s: SovState, option: TripOption, { scions, house }: Subjects, others: string[] = []): void {
  // Outcomes that turn on the other Houses' secret picks; with none of them fitting, the plain ones.
  const fits = option.outcomes.filter((o) => !o.when || (o.when.any ? others.includes(o.when.any) : !others.includes(o.when.none!)));
  const pool = fits.length ? fits : option.outcomes.filter((o) => !o.when);
  const outcome = withRng(s, (rng) => {
    let r = rng.int(pool.reduce((n, o) => n + o.w, 0));
    return pool.find((o) => (r -= o.w) < 0)!;
  });
  const who = option.rule === "vote" ? "" : option.rule === "secret" ? `House ${s.houses[house!]!.name}: ` : `${scions.map((id) => person(s, id).name).join(" and ")}: `;
  log(s, `${option.label} ${who}${outcome.text}`);
  for (const fx of outcome.effects) {
    if (s.expedition!.result) return;
    apply(s, fx, fx.to === "party" ? marching(s) : scions, option.rule === "vote" ? null : house);
  }
}

/** After an event: with no one left the party is gone; a dead Leader is replaced. */
function after(s: SovState): void {
  if (s.expedition!.result) return;
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
    person_(s, p, fx);
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
  // §9.10: an item goes to the subject's House; one the party chose together goes to the draft.
  if (fx.item) found(s, fx.item.tier, house);
  if (fx.house_improvement) improve(s, fx.house_improvement, house ?? withRng(s, (rng) => rng.pick(present(s))));
  if (fx.timeline) s.timeline.push({ year: s.year + fx.timeline.years, id: fx.timeline.id, ...(house === null ? {} : { house }) });
  // Passed by, never the boss.
  if (fx.skip) e.at = Math.min(e.chain.length - 1, e.at + fx.skip);
  // A Fork (§9.3): the way ahead changes, some places dropped, others put next; never the boss.
  if (fx.fork) {
    const rest = e.chain.slice(e.at, -1).slice(fx.fork.drop ?? 0);
    e.chain = [...e.chain.slice(0, e.at), ...(fx.fork.add ?? []), ...rest, "boss"];
  }
  if (fx.encounter) battle(s, false, fx.encounter);
  else if (fx.retreat) home(s, "retreated");
}

/** The effects that change one person for good: stats, growths, traits, Curses, the Tarot, a Ward's Loyalty, being Lost. */
function person_(s: SovState, p: Person, fx: TripEffect): void {
  STATS.forEach((k, i) => {
    if (fx.stat?.[k]) p.base[i] = Math.max(1, p.base[i]! + fx.stat[k]);
    const g = (fx.growth?.[k] ?? 0) + (k === "speed" ? 0 : (fx.growth?.all ?? 0));
    if (g) p.growth[i] = Math.max(0, p.growth[i]! + g);
  });
  if (fx.trait) gainTrait(s, p, fx.trait.slice(1), fx.trait[0] === "+");
  if (fx.curse) {
    const open = TRAITS.filter((t) => t.tags?.includes("cursed") && !p.traits.includes(t.id));
    if (open.length) gainTrait(s, p, withRng(s, (rng) => rng.pick(open)).id, true);
  }
  if (fx.tarot) {
    p.tarot = withRng(s, (rng) => rng.pick(TAROT.filter((t) => t.id !== p.tarot))).id;
    delete p.reversed;
    log(s, `${p.name} now walks under ${TAROT_BY_ID.get(p.tarot)!.name}.`);
  }
  if (fx.status) (s.expedition!.carry[p.id] ??= { dur: {}, broken: [] }).start = [...(s.expedition!.carry[p.id]?.start ?? []), fx.status];
  if (fx.blessing && !p.traits.includes(fx.blessing.trait)) {
    p.traits.push(fx.blessing.trait);
    (p.blessed ??= []).push({ id: fx.blessing.trait, years: fx.blessing.years });
    log(s, `${p.name} is blessed: ${TRAIT_BY_ID.get(fx.blessing.trait)?.name}.`);
  }
  if (fx.loyalty && isWard(p)) p.loyalty = Math.max(0, Math.min(100, (p.loyalty ?? 0) + fx.loyalty));
  if (fx.change) change(s, p, fx.change);
  if (fx.unchange) unchange(s, p);
  if (fx.scion_lost && p.status === "scion") lose(s, p);
}

/** Gains (one of a group replaces the other) or loses an individual trait. */
function gainTrait(s: SovState, p: Person, id: string, gain: boolean): void {
  const def = TRAIT_BY_ID.get(id);
  if (!def) return;
  const had = p.traits.includes(id);
  p.traits = p.traits.filter((t) => t !== id && !(gain && def.group && TRAIT_BY_ID.get(t)?.group === def.group));
  if (gain) p.traits.push(id);
  // Gained for good, a blessing of the same trait no longer fades; lost, it is gone with it.
  p.blessed = p.blessed?.filter((b) => b.id !== id);
  if (!p.blessed?.length) delete p.blessed;
  if (gain !== had) log(s, `${p.name} ${gain ? "is now" : "is no longer"} ${def.name}.`);
}

/** House improvements (§9.4): a recruit, a building's next level, or a Commons shop's next tier (for everyone). */
function improve(s: SovState, kind: "recruit" | "building" | "shop", h: number): void {
  const H = s.houses[h]!;
  if (kind === "recruit") {
    const id = s.nextId++;
    s.people.push(withRng(s, (rng) => rollRecruit(rng, id, h, H)));
    return log(s, `House ${H.name} gains a recruit.`);
  }
  if (kind === "building") {
    const up = Object.keys(H.buildings).filter((b) => (H.buildings[b] ?? 0) > 0 && H.buildings[b]! < (BUILDING_BY_ID.get(b)?.levels.length ?? 0));
    if (!up.length) return;
    const b = withRng(s, (rng) => rng.pick(up));
    H.buildings[b] = H.buildings[b]! + 1;
    return log(s, `House ${H.name}'s ${BUILDING_BY_ID.get(b)!.name} rises to level ${H.buildings[b]}.`);
  }
  const shops = SHOPS.filter((x) => stockTier(s, x) > 0 && stockTier(s, x) < 3);
  if (!shops.length) return;
  const shop = withRng(s, (rng) => rng.pick(shops));
  s.commons.shopTiers = { ...s.commons.shopTiers, [shop]: stockTier(s, shop) + 1 };
  log(s, `The settlement's ${shop.replace(/_/g, " ")} now stocks tier ${stockTier(s, shop)}.`);
}

/** At each Reckoning a blessing has a Year less; one with none left fades (§9.4 `blessing`). */
export function fadeBlessings(s: SovState): void {
  for (const p of s.people) {
    if (!p.blessed) continue;
    for (const b of p.blessed.filter((x) => x.years <= 0)) {
      p.traits = p.traits.filter((t) => t !== b.id);
      log(s, `${p.name}'s blessing fades: no longer ${TRAIT_BY_ID.get(b.id)?.name}.`);
    }
    p.blessed = p.blessed.filter((x) => x.years > 0).map((x) => ({ ...x, years: x.years - 1 }));
    if (!p.blessed.length) delete p.blessed;
  }
}

/** A Scion's full Durability by location, as a battle would build it. */
function fullDurability(s: SovState, id: number): Record<(typeof LOCATIONS)[number], number> {
  const p = person(s, id);
  return scionCombatant(p, { id: 1, col: 0, row: 0, gear: gearTotals(s, p), house: s.houses[p.house] }).maxDur!;
}

/** The bot's next pick in an `each_scion` event: its first Scion still to choose. */
export const botPicksFor = (s: SovState, house: number): number | undefined =>
  Object.entries(s.expedition!.event!.picks ?? {}).map(([id, v]) => [+id, v] as const).find(([id, v]) => v === null && person(s, id).host === house)?.[0];

/** The bot's choice: a cautious option if there is one, else the first. */
export function botDecide(s: SovState): number {
  const def = TRIP_EVENT_BY_ID.get(s.expedition!.event!.id)!;
  const safe = def.options.findIndex((o) => o.tags?.includes("cautious"));
  return safe >= 0 ? safe : 0;
}
