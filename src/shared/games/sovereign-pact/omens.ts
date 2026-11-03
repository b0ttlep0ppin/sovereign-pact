// The Omens (§3.1 step 1, §8.8): one settlement-wide event every Year (a Crisis about 40% of the time,
// by weight) and, for each House, a House event at 50%. An event's rule names who chooses: the Houses
// by vote, one House picked by the fiction (the richest, the hungriest, a random one…), or every House
// for itself, openly or in secret. Choices are made in the Settlement Phase; whoever has not chosen when
// the Year is sealed takes the cautious option.
import type { Rng } from "../../rng.ts";
import { CONSUMABLE_BY_ID, HOUSE_TRAIT_BY_ID, TOWN_EVENT_BY_ID, TOWN_EVENTS, type TownEventDef, type TownOption } from "./content.ts";
import { itemName } from "./loot.ts";
import { eligible, openCrisis } from "./crisis.ts";
import { applyEffects } from "./effects.ts";
import { econ } from "./houses.ts";
import { fallen } from "./lifecycle.ts";
import { dueEvents } from "./timeline.ts";
import type { PendingEvent, SovState, Told } from "./state.ts";
import { snap, tell } from "./told.ts";
import { TUNING } from "./tuning.ts";
import { log, note, trackName, withRng } from "./year.ts";

/** One event by weight, passing by those drawn in the last few Years while any others remain. */
function draw(s: SovState, rng: Rng, pool: readonly TownEventDef[], house?: number): TownEventDef | undefined {
  const stale = new Set((s.omensSeen ?? []).map((x) => x.key));
  const fresh = pool.filter((e) => !stale.has(house === undefined ? e.id : `${e.id}@${house}`));
  const from = fresh.length ? fresh : pool;
  let roll = rng.int(Math.max(1, from.reduce((n, e) => n + e.weight, 0)));
  return from.find((e) => (roll -= e.weight) < 0);
}

export function drawOmens(s: SovState): void {
  s.events = [];
  s.omensSeen = (s.omensSeen ?? []).filter((x) => s.year - x.year < TUNING.omens.fresh);
  s.omensTold = (s.omensTold ?? []).filter((x) => s.year - x.year <= 1);
  // The "calm" flag stills the Omens, for tests and tuning runs that measure the economy alone.
  if (s.flags.includes("calm")) return;
  // Consequences come due first, and take the draws they stand in for (§8.7).
  const queued = dueEvents(s).map((t) => ({ ev: TOWN_EVENT_BY_ID.get(t.id)!, house: t.house ?? 0 }));
  const fromTimeline = queued.find((q) => q.ev.scope !== "house")?.ev;
  const settlement = fromTimeline ?? withRng(s, (rng) => draw(s, rng, TOWN_EVENTS.filter((e) => e.scope === "settlement" && eligible(s, e))));
  const seen = (key: string) => s.omensSeen!.push({ key, year: s.year });
  if (settlement) seen(settlement.id);
  if (settlement?.crisis) openCrisis(s, settlement);
  else if (settlement) openEvent(s, settlement);
  s.houses.forEach((_, i) => {
    const owed = queued.find((q) => q.ev.scope === "house" && q.house === i);
    if (owed) {
      seen(`${owed.ev.id}@${i}`);
      return openEvent(s, owed.ev, i);
    }
    // Haunted Halls and the like draw House events more often (§5.7).
    const pct = TUNING.omens.houseEventPct + econ(s.houses[i]!, "houseEventPct");
    const ev = withRng(s, (rng) => (rng.int(100) < pct ? draw(s, rng, TOWN_EVENTS.filter((e) => e.scope === "house" && eligible(s, e, i)), i) : undefined));
    if (ev) {
      seen(`${ev.id}@${i}`);
      openEvent(s, ev, i);
    }
  });
}

/** The House a single-chooser rule picks (seat order breaks ties). */
function chooser(s: SovState, rule: string): number | null {
  const H = s.houses.length;
  const by = (f: (i: number) => number, most: boolean) =>
    s.houses.map((_, i) => i).reduce((best, i) => ((most ? f(i) > f(best) : f(i) < f(best)) ? i : best));
  const scions = (i: number) => s.people.filter((p) => p.host === i && (p.status === "scion" || p.status === "retired")).length;
  if (rule === "most_gold") return by((i) => s.houses[i]!.gold, true);
  if (rule === "least_gold") return by((i) => s.houses[i]!.gold, false);
  if (rule === "least_grain") return by((i) => s.houses[i]!.stores.grain ?? 0, false);
  if (rule === "most_scions") return by(scions, true);
  if (rule.startsWith("tarot:")) {
    const bearer = s.people.find((p) => p.status !== "recruit" && p.status !== "lost" && p.tarot === rule.slice(6));
    if (bearer) return bearer.host;
  }
  if (rule.startsWith("house:trait:")) {
    const i = s.houses.findIndex((h) => h.traits.includes(rule.slice(12)));
    return i >= 0 ? i : null;
  }
  // random_house, led_last (until expeditions name a Leader), a Tarot nobody bears.
  return withRng(s, (rng) => rng.int(H));
}

export function openEvent(s: SovState, ev: TownEventDef, house?: number): void {
  const all = s.houses.map((_, i) => i);
  const pending = (deciders: number[]) =>
    s.events.push({ key: house === undefined ? ev.id : `${ev.id}@${house}`, id: ev.id, ...(house === undefined ? {} : { house }), deciders, choices: s.houses.map(() => null) });
  // A House event is the House's own (Q89): the others learn only that something stirs there.
  if (house === undefined) log(s, `Omen: ${ev.title}.`);
  else {
    log(s, `House ${s.houses[house]!.name} has troubles at home.`);
    note(s, house, `${ev.title}.`);
  }
  if (house !== undefined || ev.rule === "house") return void pending([house ?? 0]);
  if (ev.rule === "each_house" || ev.rule === "secret") return void pending(all);
  const one = ev.rule === "vote" ? null : chooser(s, ev.rule);
  // A vote (or a trait no House bears) goes to the Houses; solo, the House decides.
  if (one !== null || s.houses.length === 1) return void pending([one ?? 0]);
  s.vote = { kind: "event", subject: ev.id, options: ev.options!.map((o) => o.id), by: s.houses.map(() => null), proposer: -1 };
}

/** The option a cautious House takes: the first tagged cautious, else the last. */
export function cautious(ev: TownEventDef): number {
  const i = ev.options!.findIndex((o) => o.tags?.includes("cautious"));
  return i >= 0 ? i : ev.options!.length - 1;
}

/** Why House `house` cannot pay an option's price (Josh 2026-11-03: trade-offs), or null. */
export function cannotAfford(s: SovState, house: number, opt: TownOption): string | null {
  const h = s.houses[house]!;
  for (const [k, n] of Object.entries(opt.cost?.resources ?? {})) {
    if ((k === "gold" ? h.gold : (h.stores[k] ?? 0)) < (n ?? 0)) return `That asks ${n} ${k[0]!.toUpperCase()}${k.slice(1)}, and you have not got it.`;
  }
  const recruits = s.people.filter((p) => p.host === house && p.status === "recruit").length;
  if ((opt.cost?.recruits ?? 0) > recruits) return `That asks ${opt.cost!.recruits} recruit${opt.cost!.recruits! > 1 ? "s" : ""}, and you have not got them.`;
  return null;
}

export function cannotChoose(s: SovState, house: number, key: string, option: number, target?: number): string | null {
  const pe = s.events.find((e) => e.key === key);
  if (!pe || !pe.deciders.includes(house)) return "That choice is not yours to make.";
  if (pe.choices[house] !== null) return "You have already chosen.";
  const opt = Number.isInteger(option) ? TOWN_EVENT_BY_ID.get(pe.id)!.options![option] : undefined;
  if (!opt) return "That is not one of the choices.";
  if (opt.target && (!Number.isInteger(target) || target === house || !s.houses[target!] || fallen(s, target!))) return "Name another House.";
  return cannotAfford(s, house, opt);
}

/** The price is paid as the choice is made: the recruits walk away with it, last sworn first. */
function pay(s: SovState, house: number, opt: TownOption): void {
  const h = s.houses[house]!;
  for (const [k, n] of Object.entries(opt.cost?.resources ?? {})) {
    if (k === "gold") h.gold -= n ?? 0;
    else h.stores[k] = (h.stores[k] ?? 0) - (n ?? 0);
  }
  for (let n = 0; n < (opt.cost?.recruits ?? 0); n++) {
    const gone = s.people.filter((p) => p.host === house && p.status === "recruit").at(-1);
    if (!gone) break;
    s.people = s.people.filter((p) => p !== gone);
    delete s.assign[gone.id];
  }
}

export function choose(s: SovState, house: number, key: string, option: number, target?: number): void {
  const pe = s.events.find((e) => e.key === key)!;
  const opt = TOWN_EVENT_BY_ID.get(pe.id)!.options![option]!;
  pay(s, house, opt);
  pe.choices[house] = option;
  if (opt.target) (pe.targets ??= s.houses.map(() => null))[house] = target!;
  if (pe.deciders.every((d) => pe.choices[d] !== null)) settleEvent(s, pe);
}

/** Draws one outcome of an option and applies it; a House event's outcome only its House reads. */
export function outcome(s: SovState, ev: TownEventDef, opt: TownOption, subject: number | null, home?: number, target?: number): void {
  const total = opt.outcomes.reduce((n, o) => n + o.w, 0);
  const out = withRng(s, (rng) => {
    let roll = rng.int(total);
    return opt.outcomes.find((o) => (roll -= o.w) < 0)!;
  });
  if (home !== undefined) note(s, home, `${ev.title}: ${opt.label} ${out.text}`);
  else log(s, `${ev.title}: ${subject === null ? "" : `House ${s.houses[subject]!.name} — `}${opt.label} ${out.text}`);
  const named = target === undefined ? "" : ` (House ${s.houses[target]!.name})`;
  recordOmen(s, ev.id, home, subject, opt.label + named, out.text, () => applyEffects(s, out.effects, subject, true, target));
}

/** Runs an outcome's effects and keeps the account of what they changed, for the Omens' card (Josh's
 *  playtest, 2026-11-02: "explain what it did"). The tracks and buildings are open to all; the rest
 *  as told.ts tells it. */
export function recordOmen(s: SovState, id: string, house: number | undefined, by: number | null, label: string, text: string, run: () => void): void {
  const all = s.houses.map((_, i) => i);
  const before = snap(s, s.people.filter((p) => p.status === "scion" || p.status === "retired").map((p) => p.id), all);
  const was = {
    accord: s.accord,
    doom: s.doom,
    buildings: s.houses.map((h) => ({ ...h.buildings })),
    recruits: all.map((i) => recruits(s, i)),
    traits: s.houses.map((h) => [...h.traits]),
    items: new Set(s.items.map((i) => i.id)),
    consumables: s.houses.map((h) => ({ ...(h.consumables ?? {}) })),
  };
  run();
  const lines: Told[] = [];
  const signed = (n: number) => (n > 0 ? `+${n}` : `−${-n}`);
  if (s.accord !== was.accord) lines.push({ text: `${trackName(s)} ${signed(s.accord - was.accord)}.`, of: null, open: true });
  if (s.doom !== was.doom) lines.push({ text: `Doom ${signed(s.doom - was.doom)}.`, of: null, open: true });
  s.houses.forEach((h, i) => {
    for (const b of new Set([...Object.keys(was.buildings[i]!), ...Object.keys(h.buildings)])) {
      const from = was.buildings[i]![b] ?? 0;
      const to = h.buildings[b] ?? 0;
      const name = b.replace(/_/g, " ");
      if (to < from) lines.push({ text: to ? `House ${h.name}'s ${name} is damaged (level ${from} → ${to}).` : `House ${h.name}'s ${name} is destroyed.`, of: i, open: true });
    }
    for (const t of h.traits.filter((t) => !was.traits[i]!.includes(t))) lines.push({ text: `House ${h.name} is marked: ${HOUSE_TRAIT_BY_ID.get(t)?.name ?? t}.`, of: i, open: true });
    for (const t of was.traits[i]!.filter((t) => !h.traits.includes(t))) lines.push({ text: `House ${h.name} is free of ${HOUSE_TRAIT_BY_ID.get(t)?.name ?? t}.`, of: i, open: true });
    for (const it of s.items.filter((x) => x.house === i && !was.items.has(x.id))) lines.push({ text: `House ${h.name} gains ${it.named ? itemName(it) : `a ${itemName(it)}`}.`, of: i, open: true });
    for (const [c, n] of Object.entries(h.consumables ?? {})) {
      const more = (n ?? 0) - (was.consumables[i]![c] ?? 0);
      if (more > 0) lines.push({ text: `House ${h.name}: ${CONSUMABLE_BY_ID.get(c)?.name ?? c} ×${more}.`, of: i, open: false });
    }
    const d = recruits(s, i) - was.recruits[i]!;
    if (d) lines.push({ text: `House ${h.name}: ${d > 0 ? `${d} new recruit${d > 1 ? "s" : ""}` : `${-d} recruit${d < -1 ? "s" : ""} gone`}.`, of: i, open: false });
  });
  lines.push(...tell(s, before));
  (s.omensTold ??= []).push({ year: s.year, id, ...(house === undefined ? {} : { house }), by, label, text, lines });
}

const recruits = (s: SovState, house: number) => s.people.filter((p) => p.host === house && p.status === "recruit").length;

function settleEvent(s: SovState, pe: PendingEvent): void {
  s.events = s.events.filter((e) => e !== pe);
  const ev = TOWN_EVENT_BY_ID.get(pe.id)!;
  for (const d of pe.deciders) outcome(s, ev, ev.options![pe.choices[d]!]!, d, pe.house, pe.targets?.[d] ?? undefined);
  for (const t of ev.together ?? []) {
    const i = ev.options!.findIndex((o) => o.id === t.option);
    const picked = pe.deciders.filter((d) => pe.choices[d] === i).length;
    if ((t.when === "none" && picked === 0) || (t.when === "all" && picked === pe.deciders.length)) {
      log(s, `${ev.title}: ${t.text}`);
      recordOmen(s, ev.id, pe.house, null, "", t.text, () => applyEffects(s, t.effects, null));
    }
  }
}

/** A vote on an event settled: the chosen option's outcome falls on the settlement. */
export function settleEventVote(s: SovState, id: string, choice: number): void {
  const ev = TOWN_EVENT_BY_ID.get(id)!;
  outcome(s, ev, ev.options![choice]!, null);
}

/** At the seal: whoever has not chosen takes the cautious option. */
export function closeEvents(s: SovState): void {
  for (const pe of [...s.events]) {
    const ev = TOWN_EVENT_BY_ID.get(pe.id)!;
    for (const d of pe.deciders) if (pe.choices[d] === null) pe.choices[d] = cautious(ev);
    settleEvent(s, pe);
  }
}

/** What the viewer may see of pending events: another House's own events not at all (Q89), secret choices only their own. */
export function eventsFor(s: SovState, viewer: number | null): PendingEvent[] {
  return s.events
    .filter((pe) => pe.house === undefined || pe.house === viewer)
    .map((pe) => (TOWN_EVENT_BY_ID.get(pe.id)!.rule === "secret" ? { ...pe, choices: pe.choices.map((c, i) => (i === viewer ? c : c === null ? null : -1)) } : pe));
}
