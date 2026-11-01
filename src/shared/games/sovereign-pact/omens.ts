// The Omens (§3.1 step 1, §8.8): one settlement-wide event every Year (a Crisis about 40% of the time,
// by weight) and, for each House, a House event at 50%. An event's rule names who chooses: the Houses
// by vote, one House picked by the fiction (the richest, the hungriest, a random one…), or every House
// for itself, openly or in secret. Choices are made in the Settlement Phase; whoever has not chosen when
// the Year is sealed takes the cautious option.
import type { Rng } from "../../rng.ts";
import { TOWN_EVENT_BY_ID, TOWN_EVENTS, type TownEventDef, type TownOption } from "./content.ts";
import { eligible, openCrisis } from "./crisis.ts";
import { applyEffects } from "./effects.ts";
import { dueEvents } from "./timeline.ts";
import type { PendingEvent, SovState } from "./state.ts";
import { TUNING } from "./tuning.ts";
import { log, withRng } from "./year.ts";

function draw(rng: Rng, pool: readonly TownEventDef[]): TownEventDef | undefined {
  let roll = rng.int(Math.max(1, pool.reduce((n, e) => n + e.weight, 0)));
  return pool.find((e) => (roll -= e.weight) < 0);
}

export function drawOmens(s: SovState): void {
  s.events = [];
  // The "calm" flag stills the Omens, for tests and tuning runs that measure the economy alone.
  if (s.flags.includes("calm")) return;
  // Consequences come due first, and take the draws they stand in for (§8.7).
  const queued = dueEvents(s).map((t) => ({ ev: TOWN_EVENT_BY_ID.get(t.id)!, house: t.house ?? 0 }));
  const fromTimeline = queued.find((q) => q.ev.scope !== "house")?.ev;
  const settlement = fromTimeline ?? withRng(s, (rng) => draw(rng, TOWN_EVENTS.filter((e) => e.scope === "settlement" && eligible(s, e))));
  if (settlement?.crisis) openCrisis(s, settlement);
  else if (settlement) openEvent(s, settlement);
  s.houses.forEach((_, i) => {
    const owed = queued.find((q) => q.ev.scope === "house" && q.house === i);
    if (owed) return void openEvent(s, owed.ev, i);
    const ev = withRng(s, (rng) => (rng.int(100) < TUNING.omens.houseEventPct ? draw(rng, TOWN_EVENTS.filter((e) => e.scope === "house" && eligible(s, e, i))) : undefined));
    if (ev) openEvent(s, ev, i);
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
  log(s, house === undefined ? `Omen: ${ev.title}.` : `House ${s.houses[house]!.name}: ${ev.title}.`);
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

export function cannotChoose(s: SovState, house: number, key: string, option: number): string | null {
  const pe = s.events.find((e) => e.key === key);
  if (!pe || !pe.deciders.includes(house)) return "That choice is not yours to make.";
  if (pe.choices[house] !== null) return "You have already chosen.";
  if (!Number.isInteger(option) || option < 0 || option >= TOWN_EVENT_BY_ID.get(pe.id)!.options!.length) return "That is not one of the choices.";
  return null;
}

export function choose(s: SovState, house: number, key: string, option: number): void {
  const pe = s.events.find((e) => e.key === key)!;
  pe.choices[house] = option;
  if (pe.deciders.every((d) => pe.choices[d] !== null)) settleEvent(s, pe);
}

/** Draws one outcome of an option and applies it. */
export function outcome(s: SovState, ev: TownEventDef, opt: TownOption, subject: number | null): void {
  const total = opt.outcomes.reduce((n, o) => n + o.w, 0);
  const out = withRng(s, (rng) => {
    let roll = rng.int(total);
    return opt.outcomes.find((o) => (roll -= o.w) < 0)!;
  });
  log(s, `${ev.title}: ${subject === null ? "" : `House ${s.houses[subject]!.name} — `}${opt.label} ${out.text}`);
  applyEffects(s, out.effects, subject);
}

function settleEvent(s: SovState, pe: PendingEvent): void {
  s.events = s.events.filter((e) => e !== pe);
  const ev = TOWN_EVENT_BY_ID.get(pe.id)!;
  for (const d of pe.deciders) outcome(s, ev, ev.options![pe.choices[d]!]!, d);
  for (const t of ev.together ?? []) {
    const i = ev.options!.findIndex((o) => o.id === t.option);
    const picked = pe.deciders.filter((d) => pe.choices[d] === i).length;
    if ((t.when === "none" && picked === 0) || (t.when === "all" && picked === pe.deciders.length)) {
      log(s, `${ev.title}: ${t.text}`);
      applyEffects(s, t.effects, null);
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

/** What the viewer may see of pending events: secret choices only their own. */
export function eventsFor(s: SovState, viewer: number | null): PendingEvent[] {
  return s.events.map((pe) =>
    TOWN_EVENT_BY_ID.get(pe.id)!.rule === "secret" ? { ...pe, choices: pe.choices.map((c, i) => (i === viewer ? c : c === null ? null : -1)) } : pe,
  );
}
