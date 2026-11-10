// Expedition events (§9.4): met at an Event node, from the card's own pools half the time and the
// general pool the rest. Every House in the party votes on the option; a tie goes to the Leader's
// House at no cost (only settlement ties cost Accord). The option's rule names its subject, the
// Scion or House it happens to; its outcome is drawn by weight and its effects land (§9.4's
// catalogue; transformation and secret events come later).
import { loseAccord } from "./commons.ts";
import { caps, scionCombatant } from "./combat/build.ts";
import { namesTaken, rollRecruit } from "./generate.ts";
import { addProperty, baseOf, gearTotals, itemById, liftProperty } from "./items.ts";
import { SHOPS, stockTier } from "./market.ts";
import { found } from "./loot.ts";
import { isWard } from "./wards.ts";
import { carriedRoll } from "./combat/injury.ts";
import { BUILDING_BY_ID, HOUSE_TRAIT_BY_ID, INJURY_BY_ID, INJURY_TABLE_BY_ID, TAROT, TAROT_BY_ID, TRAIT_BY_ID, TRAITS, TRIP_EVENT_BY_ID, TRIP_EVENTS, type InjuryTableId, type TripEffect, type TripEventDef, type TripOption } from "./content.ts";
import { battle, die, halt, home, lose, marching, person, succeed } from "./journey.ts";
import { gainJp, gainXp, jobStats, passiveBudget, passiveMods, passivePoints } from "./progression.ts";
import { jobStat } from "./formulas.ts";
import { ascendancy } from "./score.ts";
import { GEAR_SLOTS, LOCATIONS, STATS, type HistKey, type NodeKind, type Person, type ScoreCategory, type SovState, type Then, type Told } from "./state.ts";
import { TUNING } from "./tuning.ts";
import { log, note, withRng } from "./year.ts";
import { change, unchange } from "./change.ts";
import { effectLines, snap, tell, type Snap } from "./told.ts";

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
export function meet(s: SovState, id?: string): void {
  const e = s.expedition!;
  const def = id ? TRIP_EVENT_BY_ID.get(id) : drawEvent(s);
  if (!def) return log(s, "The party passes through a quiet stretch.");
  e.seen.push(def.id);
  e.event = { id: def.id, votes: s.houses.map((_, i) => (present(s).includes(i) ? null : -1)) };
  if (eachScion(def.id)) e.event.picks = Object.fromEntries(marching(s).map((id) => [id, null]));
  log(s, `${def.title}: ${def.text}`);
}

/**
 * Whether an option is on offer: one marked `only` is there only when someone in the party fits its
 * rule's first choice (a Magus to read the runes, a Scion in plate to wade in), so it is never a dud.
 */
export function offered(s: SovState, o: TripOption): boolean {
  return !o.only || subjectOf(s, o.rule.split("|")[0]!) !== null;
}

export function cannotDecide(s: SovState, house: number, option: unknown, who?: unknown): string | null {
  const ev = s.expedition?.event;
  if (!ev) return "No event waits on the party.";
  if (ev.votes[house] !== null) return ev.votes[house] === -1 ? "Your House has no one in the party." : "Your House has already chosen.";
  const def = TRIP_EVENT_BY_ID.get(ev.id)!;
  if (!(Number.isInteger(option) && (option as number) >= 0 && (option as number) < def.options.length)) return "That is not one of the choices.";
  if (!offered(s, def.options[option as number]!)) return "No one in the party can do that.";
  if (!ev.picks) {
    if (who === undefined) return null;
    if (!nominable(def.options[option as number]!.rule)) return "That choice does not fall on a Scion you can name.";
    return marching(s).includes(who as number) && person(s, who as number).host === house ? null : "Name one of your own Scions in the party.";
  }
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
  if (who !== undefined) (ev.nominees ??= {})[house] = who;
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
  // Who steps up (Josh, 2026-11-02): the Leader's House's nominee if it voted for the choice, then the
  // first other House's that did; with none, the option's rule decides.
  const lead = e.leader === undefined ? -1 : person(s, e.leader).host;
  const named = [lead, ...ev.votes.keys()].filter((h) => h >= 0 && ev.votes[h] === pick).map((h) => ev.nominees?.[h]).find((id) => id !== undefined && marching(s).includes(id));
  resolve(s, def.options[pick]!, named);
}

/**
 * Whether a House may name the Scion an option falls on (Josh, 2026-11-02, "per player nominate our
 * pawns"): a choice that asks for someone to step up (the strongest, the quickest, anyone). Where the
 * otherworld itself singles someone out (the most laden, the Changed, the one who killed least) the rule stands.
 */
export const nominable = (rule: string): boolean => /^scion:(highest:[a-z_]+|random)$/.test(rule.split("|")[0]!);

/** The Scion an option will fall on if nobody is named, or null when it is the party, a House, or chance. */
export function foresee(s: SovState, rule: string): number | null {
  if (rule.includes("random") || !rule.startsWith("scion:") && rule !== "leader") return null;
  const got = subjects(s, rule);
  return got.house !== null && got.scions.length === 1 ? got.scions[0]! : null;
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
  // The Job they are in, what they carry and wear (Josh 2026-11-03: "really engage with all the traits
  // all the gear the jobs"): an item's base id or kind ("shield"), and anyone in cursed gear.
  if (a === "job") return find((p) => p.job === b);
  const worn = (p: Person, slots: readonly string[]) => slots.flatMap((k) => itemById(s, p.gear[k as keyof Person["gear"]]) ?? []);
  const fits = (item: { base: string }) => item.base === b || baseOf(item).type === b;
  if (a === "wields") return find((p) => worn(p, ["main", "off"]).some(fits));
  if (a === "wears") return find((p) => worn(p, ["head", "body", "arms", "legs"]).some(fits));
  if (a === "cursed") return find((p) => worn(p, GEAR_SLOTS).some((i) => i.cursed));
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
export function resolve(s: SovState, option: TripOption, named?: number): void {
  if (land(s, option, named === undefined ? subjects(s, option.rule) : { scions: [named], house: person(s, named).host })) after(s);
}

function land(s: SovState, option: TripOption, { scions, house }: Subjects, others: string[] = []): boolean {
  // Outcomes that turn on the other Houses' secret picks; with none of them fitting, the plain ones.
  const fits = option.outcomes.filter((o) => !o.when || (o.when.any ? others.includes(o.when.any) : !others.includes(o.when.none!)));
  const pool = fits.length ? fits : option.outcomes.filter((o) => !o.when);
  // Fortune Favors (§12.7): a subject Gambler may tip it toward the outcome best for them.
  const lucky = scions.some((id) => passiveMods(person(s, id)).some((m) => m.fortuneFavors));
  const outcome = withRng(s, (rng) => {
    if (lucky && pool.length > 1 && rng.int(100) < TUNING.combat.gambler.fortunePct) return [...pool].sort((x, y) => goodness(y.effects) - goodness(x.effects))[0]!;
    let r = rng.int(pool.reduce((n, o) => n + o.w, 0));
    return pool.find((o) => (r -= o.w) < 0)!;
  });
  const who = option.rule === "vote" ? "" : option.rule === "secret" ? `House ${s.houses[house!]!.name}: ` : `${scions.map((id) => person(s, id).name).join(" and ")}: `;
  log(s, `${option.label} ${who}${outcome.text}`);
  const before = look(s);
  const said = [...effectLines(s, outcome.effects, scions, marching(s), option.rule === "vote" ? null : house), ...wholeLines(s, outcome.effects, scions, marching(s))];
  const done = effects(s, outcome.effects, scions, option.rule === "vote" ? null : house);
  const e = s.expedition!;
  if (e.told?.n !== e.seen.length) e.told = { id: e.seen.at(-1) ?? "", n: e.seen.length, parts: [] };
  // The one it fell on, for the card to name inside the choice's words (Josh 2026-11-10).
  const one = option.rule !== "vote" && option.rule !== "secret" && scions.length === 1 ? { person: scions[0]! } : {};
  e.told.parts.push({ label: option.label, who: who.replace(/: $/, ""), ...one, text: outcome.text, lines: [...said, ...tell(s, before)] });
  halt(s);
  return done;
}

/** Everyone the party set out with, and every House, as they stand now (for the outcome card). */
const look = (s: SovState): Snap => snap(s, s.expedition!.party.flatMap((x) => x ?? []), s.houses.map((_, h) => h));

/**
 * Effects in order. One that starts a battle takes the rest with it, to follow a victory (journey.ts
 * `concluded`); then this returns false, and the battle's end carries on instead.
 */
function effects(s: SovState, list: TripEffect[], scions: number[], house: number | null): boolean {
  for (const [i, fx] of list.entries()) {
    if (s.expedition!.result) return true;
    apply(s, fx, fx.to === "party" ? marching(s) : scions, house, { effects: list.slice(i + 1), scions, house });
    if (fx.encounter) return false;
  }
  return true;
}

/** The rest of an outcome after the battle it started was won. */
export function carryOn(s: SovState, then: Extract<Then, { effects: unknown }>): void {
  const before = look(s);
  const done = effects(s, then.effects, then.scions, then.house);
  const part = s.expedition!.told?.parts.at(-1);
  if (part) part.lines.push(...tell(s, before));
  if (done) after(s);
}

/** After an event: with no one left the party is gone; a dead Leader is replaced. */
function after(s: SovState): void {
  if (s.expedition!.result) return;
  if (!marching(s).length) return home(s, "wiped");
  succeed(s);
}

const pctOf = (max: number, pct: number) => Math.round((max * pct) / 100);
const gateAhead = (chain: NodeKind[], at: number): number | undefined => (chain.indexOf("gate", at) >= 0 ? chain.indexOf("gate", at) : undefined);

/** One effect on `ids` (Scions) and `house` (the subject's House; null: the Commons, or every House present). */
function apply(s: SovState, fx: TripEffect, ids: number[], house: number | null, rest?: Then): void {
  const e = s.expedition!;
  for (const id of ids) {
    const at = s.people.findIndex((p) => p.id === id);
    if (at < 0) continue;
    const p = s.people[at]!;
    if (shrugs(s, p, fx)) continue;
    if (fx.hp) {
      const c = (e.carry[id] ??= { dur: {}, broken: [] });
      const max = full(s, id).maxHp;
      const hurt = Math.max(0, Math.min(max - 1, (c.hurt ?? 0) - pctOf(max, fx.hp)));
      if (hurt) Object.assign(c, { hurt, hpMax: max });
      else delete c.hurt;
    }
    if (fx.tp) {
      const c = (e.carry[id] ??= { dur: {}, broken: [] });
      c.tp = Math.max(c.tp ?? 0, Math.min(100, fx.tp));
    }
    if (fx.durability) {
      const c = (e.carry[id] ??= { dur: {}, broken: [] });
      const max = fullDurability(s, id);
      for (const loc of fx.loc ? [fx.loc] : LOCATIONS) {
        c.dur[loc] = Math.max(0, Math.min(max[loc], (c.dur[loc] ?? max[loc]) + pctOf(max[loc], fx.durability)));
        if (c.dur[loc] === 0 && !c.broken.includes(loc)) c.broken.push(loc);
        if (c.dur[loc]! > 0) c.broken = c.broken.filter((l) => l !== loc);
      }
    }
    befall(s, at, fx);
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
  // The Gate's Reflection (§9.7): the House's own future as a number, its Ambition counted; only it sees.
  for (const h of fx.foresee ? houses : []) {
    const seen = `In the Gate you see your House's future: an Ascendancy of ${ascendancy(s, h)}.`;
    if (!s.notes[h]!.includes(seen)) note(s, h, seen);
  }
  if (fx.accord) {
    if (fx.accord < 0) loseAccord(s, -fx.accord);
    else s.accord = Math.min(100, s.accord + fx.accord);
  }
  if (fx.doom) s.doom = Math.max(0, Math.min(100, s.doom + fx.doom));
  if (fx.flag && !s.flags.includes(fx.flag)) s.flags.push(fx.flag);
  // §9.10: an item goes to the subject's House; one the party chose together goes to the draft.
  if (fx.item) found(s, fx.item.tier, house, fx.item.named);
  if (fx.house_improvement) improve(s, fx.house_improvement, house ?? withRng(s, (rng) => rng.pick(present(s))));
  if (fx.timeline) s.timeline.push({ year: s.year + fx.timeline.years, id: fx.timeline.id, ...(house === null ? {} : { house }) });
  // Passed by, never the boss.
  // Never past a Gate: it waits on the other party (§9.3).
  if (fx.skip) e.at = Math.min(gateAhead(e.chain, e.at) ?? e.chain.length - 1, e.at + fx.skip);
  // A Fork (§9.3): the way ahead changes, some places dropped, others put next; never the boss.
  // A 2×4 party's way keeps its Gate, and ends at the meeting place instead.
  if (fx.fork) {
    let drop = fx.fork.drop ?? 0;
    const rest = e.chain.slice(e.at, -1).filter((k) => k === "gate" || drop-- <= 0);
    e.chain = [...e.chain.slice(0, e.at), ...(fx.fork.add ?? []), ...rest, e.chain.at(-1)!];
  }
  if (fx.encounter) battle(s, false, fx.encounter, rest);
  else if (fx.retreat) home(s, "retreated");
  else if (fx.idol) {
    log(s, "The party kneels, and the Idol lets it go home.");
    home(s, "won");
  }
}

/**
 * Who a restore finds already whole, said before it lands (Josh 2026-11-03: "it just has to say they are
 * healed (full hp)"), so an outcome that mends nobody never reads as "Nothing you can see has changed".
 */
function wholeLines(s: SovState, effects: readonly TripEffect[], scions: number[], party: number[]): Told[] {
  const out: Told[] = [];
  const e = s.expedition!;
  for (const fx of effects) {
    const ids = (fx.to === "party" ? party : scions).filter((id) => s.people.some((p) => p.id === id));
    const full: string[] = [];
    if ((fx.hp ?? 0) > 0) full.push("HP");
    if ((fx.mp ?? 0) > 0) full.push("MP");
    if ((fx.sanity ?? 0) > 0) full.push("Sanity");
    if (!full.length || !ids.length) continue;
    const whole = ids.filter((id) => {
      const p = person(s, id);
      const cap = caps(s, p);
      return full.every((k) => (k === "HP" ? !e.carry[id]?.hurt : k === "MP" ? p.mp >= cap.mp : p.sanity >= cap.sanity));
    });
    if (!whole.length) continue;
    const what = `full ${full.join(" and ")}`;
    const all = whole.length === ids.length && ids.length > 1;
    const names = whole.map((id) => person(s, id).name);
    out.push({ text: all ? `The party is already at ${what}.` : `${names.join(" and ")} ${names.length > 1 ? "are" : "is"} already at ${what}.`, of: all ? null : person(s, whole[0]!).host, open: true });
  }
  return out;
}

/** What changes a person wherever they stand, on the road or at home (effects.ts): Sanity, MP, XP, JP,
 *  the lasting changes, an injury roll and a mending. `at` is the person's index in `s.people`. */
export function befall(s: SovState, at: number, fx: TripEffect, where = "in the otherworld"): void {
  let p = s.people[at]!;
  const cap = caps(s, p);
  if (fx.sanity) p.sanity = Math.max(0, Math.min(cap.sanity, p.sanity + pctOf(cap.sanity, fx.sanity)));
  if (fx.mp) p.mp = Math.max(0, Math.min(cap.mp, p.mp + pctOf(cap.mp, fx.mp)));
  if (fx.xp) p = gainXp(p, fx.xp);
  if (fx.jp) p = gainJp(p, fx.jp);
  s.people[at] = p;
  person_(s, p, fx);
  if (fx.injury) {
    const sat = s.expedition?.satchel;
    const carried = sat ? { has: (id: string) => sat.some((x) => x.id === id), spend: (id: string) => void sat.splice(sat.findIndex((x) => x.id === id), 1) } : undefined;
    const r = withRng(s, (rng) => carriedRoll(rng, fx.injury!, 0, carried)).result;
    log(s, `${p.name}: ${r.name}.`);
    if (r.death || r.mortal) die(s, p, r.id, where);
    else if (r.lasting) p.injuries.push({ id: r.id, years: r.lasting.years });
  }
  const healed = fx.mend ? p.injuries.findIndex((x) => INJURY_BY_ID.get(x.id)?.band === "moderate") : -1;
  if (healed >= 0) log(s, `${p.name}'s ${INJURY_BY_ID.get(p.injuries.splice(healed, 1)[0]!.id)!.name.toLowerCase()} is mended.`);
  if (fx.gear) alterGear(s, p, fx.gear);
}

/** An event's mark on one piece of the subject's gear (TripEffect `gear`); nothing if they wear nothing that fits. */
function alterGear(s: SovState, p: Person, g: NonNullable<TripEffect["gear"]>): void {
  const slots = g.on === "weapon" ? (["main", "off"] as const) : g.on === "armor" ? (["head", "body", "arms", "legs"] as const) : GEAR_SLOTS;
  let pieces = slots.flatMap((k) => {
    const item = itemById(s, p.gear[k]);
    return item && (g.on !== "weapon" || baseOf(item).slot === "main" || baseOf(item).hands) ? [item] : [];
  });
  // A lifting reaches for what needs it.
  if (g.lift === "curse") pieces = pieces.filter((i) => i.cursed);
  if (g.mend) pieces = pieces.filter((i) => i.dented);
  if (!pieces.length) return;
  const item = withRng(s, (rng) => rng.pick(pieces));
  if (g.lost) {
    s.items = s.items.filter((i) => i.id !== item.id);
    for (const k of GEAR_SLOTS) if (p.gear[k] === item.id) delete p.gear[k];
    return;
  }
  if (g.dent) item.dented = Math.min(item.tier - 1, (item.dented ?? 0) + g.dent);
  if (g.mend) delete item.dented;
  if (g.better && item.tier < 5) item.tier = (item.tier + 1) as typeof item.tier;
  if (g.add) withRng(s, (rng) => addProperty(rng, item, g.add!));
  if (g.lift) withRng(s, (rng) => liftProperty(rng, item, g.lift!));
}

/** How well an outcome goes for its subjects, roughly: gains count up, harms down, the worst ones most. */
function goodness(list: readonly TripEffect[]): number {
  let n = 0;
  for (const fx of list) {
    n += Math.sign(fx.hp ?? 0) + Math.sign(fx.sanity ?? 0) + Math.sign(fx.mp ?? 0) + Math.sign(fx.tp ?? 0) + Math.sign(fx.durability ?? 0) + (fx.xp ? 1 : 0) + (fx.jp ? 1 : 0) + (fx.item ? 1 : 0) + Math.sign(fx.resources?.gold ?? 0);
    n += Object.values(fx.stat ?? {}).reduce((a, v) => a + Math.sign(v!), 0) + Object.values(fx.growth ?? {}).reduce((a, v) => a + Math.sign(v!), 0);
    if (fx.injury || fx.curse) n -= 3;
    if (fx.scion_lost) n -= 5;
    if (fx.blessing) n += 2;
    const g = fx.gear;
    if (g) n += (g.add ? (g.add === "bad" || g.add === "curse" ? -2 : 1) : 0) + (g.lift ? 1 : 0) + (g.dent ? -1 : 0) + (g.mend ? 1 : 0) + (g.better ? 2 : 0) + (g.lost ? -2 : 0);
  }
  return n;
}

/** Whether an effect does a Scion harm: wounds, lost Sanity, MP or Durability, an injury, a Curse, a stat lost, being Lost. */
const harms = (fx: TripEffect): boolean =>
  (fx.hp ?? 0) < 0 || (fx.sanity ?? 0) < 0 || (fx.mp ?? 0) < 0 || (fx.durability ?? 0) < 0 || !!fx.injury || !!fx.curse || !!fx.scion_lost || Object.values(fx.stat ?? {}).some((n) => n! < 0);

/** Veteran (§12.5): once an expedition, a Guile % chance to shrug off a harm. */
function shrugs(s: SovState, p: Person, fx: TripEffect): boolean {
  const c = s.expedition?.carry[p.id];
  if (!harms(fx) || c?.shrugged || !passiveMods(p).some((m) => m.veteran)) return false;
  const guile = jobStat(p, "guile");
  if (withRng(s, (rng) => rng.int(100)) >= guile) return false;
  (s.expedition!.carry[p.id] ??= { dur: {}, broken: [] }).shrugged = true;
  log(s, `${p.name} has seen worse, and shrugs it off.`);
  return true;
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
    s.people.push(withRng(s, (rng) => rollRecruit(rng, id, h, H, namesTaken(s))));
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
    // A budget that shrank sheds passives, the last equipped first.
    while (p.passives.length && passivePoints(p) > passiveBudget(p)) p.passives = p.passives.slice(0, -1);
  }
}

/** A Scion as a battle would build them, whole. */
function full(s: SovState, id: number) {
  const p = person(s, id);
  return scionCombatant(p, { id: 1, col: 0, row: 0, gear: gearTotals(s, p), house: s.houses[p.house] });
}

/** A Scion's full Durability by location, as a battle would build it. */
const fullDurability = (s: SovState, id: number): Record<(typeof LOCATIONS)[number], number> => full(s, id).maxDur!;

/** The bot's next pick in an `each_scion` event: its first Scion still to choose. */
export const botPicksFor = (s: SovState, house: number): number | undefined =>
  Object.entries(s.expedition!.event!.picks ?? {}).map(([id, v]) => [+id, v] as const).find(([id, v]) => v === null && person(s, id).host === house)?.[0];

/** The bot's choice: a cautious option if there is one, else the first. */
export function botDecide(s: SovState): number {
  const def = TRIP_EVENT_BY_ID.get(s.expedition!.event!.id)!;
  const safe = def.options.findIndex((o) => o.tags?.includes("cautious") && offered(s, o));
  return safe >= 0 ? safe : def.options.findIndex((o) => offered(s, o));
}
