// The expedition's chain (§9.3) and its walk: N nodes then the boss, rolled at departure and hidden
// beyond the next. The Leader's House presses on or turns back. Battles are fought by gambits here
// (playing them by hand comes later); Durability, Sanity and MP carry from node to node, injuries
// last, the dead go to the Chronicle. What the party finds rides home in the haul (loot.ts).
import { BOSSES, INJURY_BY_ID, type TripEffect } from "./content.ts";
import { bossBattle } from "./combat/bosses.ts";
import { scionCombatant } from "./combat/build.ts";
import { encounterBattle } from "./combat/encounter.ts";
import { LOADOUTS } from "./combat/roster.ts";
import { simulate } from "./combat/sim.ts";
import { meta } from "./combat/status.ts";
import type { Battle, Combatant } from "./combat/types.ts";
import { meet } from "./events.ts";
import { roster } from "./expedition.ts";
import { gearTotals } from "./items.ts";
import { bossLoot, cache, encounterLoot, shareOut } from "./loot.ts";
import { gainJp, gainXp, xpAt } from "./progression.ts";
import { LOCATIONS, type Expedition, type NodeKind, type Person, type SovState } from "./state.ts";
import { devastate } from "./timeline.ts";
import { TUNING } from "./tuning.ts";
import { creditWard } from "./wards.ts";
import { ARC, arcDoom, arcResult, bastionFallBack, bastionShields, withRaid } from "./arc.ts";
import { divided, gate, partyGone, rally } from "./split.ts";
import { endCampaign, log, mandatoryYears, withRng } from "./year.ts";

const J = TUNING.journey;
const P = TUNING.progression;

/** The chain for the card (§9.3): N = 4 + level/2 nodes (+2 mandatory), each rolled by weight, then the boss. */
export function rollChain(s: SovState): NodeKind[] {
  const card = s.expedition!.card;
  const n = 4 + Math.floor(card.level / 2) + (card.type === "mandatory" ? J.mandatoryExtra : 0);
  return withRng(s, (rng) => {
    const nodes = Array.from({ length: n }, () => {
      let roll = rng.int(100);
      return J.nodes.find(([, w]) => (roll -= w) < 0)![0];
    });
    return withRaid(s, [...nodes, "boss"]);
  });
}

/** The boss a card ends in: the arc's, else one of its pool's (not the arc's) nearest its level, if any. */
export function bossFor(s: SovState): string | undefined {
  const card = s.expedition!.card;
  if (card.boss) return card.boss;
  const near = (b: (typeof BOSSES)[number]) => (card.level < b.levels[0] ? b.levels[0] - card.level : Math.max(0, card.level - b.levels[1]));
  const fits = BOSSES.filter((b) => b.pool === card.pool && !b.tags.includes("arc") && !b.id.match(/_(risen|ascendant|final)$/) && near(b) <= J.bossReach);
  if (!fits.length) return undefined;
  const best = Math.min(...fits.map(near));
  return withRng(s, (rng) => rng.pick(fits.filter((b) => near(b) === best)).id);
}

export const person = (s: SovState, id: number): Person => s.people.find((p) => p.id === id)!;
/** Scions still with the party: not dead, not Lost, not out of the fight for good. */
export const marching = (s: SovState): number[] => walkers(s).filter((id) => s.people.some((p) => p.id === id && p.status === "scion") && !s.expedition!.out.includes(id));

/** Who set out on the way being walked: the whole roster, or a 2×4 card's walking party (split.ts). */
export const walkers = (s: SovState): number[] => {
  const e = s.expedition!;
  return divided(e) ? e.split!.teams[e.split!.turn] : roster(s);
};

/** The party as combatants: each in their Job's column, carrying the Durability they came in with. */
const party = (s: SovState): Combatant[] => partyOf(s, marching(s), s.expedition!.carry);

/** Scions as combatants (ids 1–8: enemies number from 101), each in their Job's column, with what they carry if anything. */
export function partyOf(s: SovState, ids: number[], carried: Expedition["carry"] = {}): Combatant[] {
  const rows: Record<number, number> = { 0: 0, 1: 0, 2: 0 };
  return ids.map((id, i) => {
    const p = person(s, id);
    const col = LOADOUTS[p.job!]?.col ?? 1;
    const row = rows[col]!;
    rows[col] = row + 1;
    const u = scionCombatant(p, { id: i + 1, col, row: row % 8, gear: gearTotals(s, p), house: s.houses[p.house] });
    const c = carried[id];
    if (c && u.dur && u.maxDur) {
      for (const loc of LOCATIONS) u.dur[loc] = Math.min(u.maxDur[loc], c.dur[loc] ?? u.maxDur[loc]);
      u.broken = c.broken.filter((l) => u.dur![l] === 0);
      for (const [k, v] of Object.entries(c.mods ?? {})) u.mods[k] = (u.mods[k] ?? 0) + v;
      // An event's ailment, for this battle only.
      for (const id of c.start ?? []) if (!u.statuses.some((x) => x.id === id)) u.statuses.push({ id, ticks: meta(id).ticks });
    }
    return u;
  });
}

/** The Chronicle takes the dead (§6.13): they leave the House, their gear back in its stash. */
export function die(s: SovState, p: Person, cause: string): void {
  s.houses[p.house]!.chronicle.push({ name: p.name, year: s.year, cause, level: p.level });
  s.people = s.people.filter((x) => x.id !== p.id);
  delete s.assign[p.id];
  log(s, `${p.name} of House ${s.houses[p.house]!.name} dies in the otherworld.`);
}

/** A Scion is Lost (§9.9): left behind in the otherworld, their gear with them, until a Rescue. */
export function lose(s: SovState, p: Person): void {
  p.status = "lost";
  const card = s.expedition?.card;
  if (card) p.lost = { year: s.year, pool: card.pool, level: card.level };
  p.gear = {};
  delete s.assign[p.id];
  log(s, `${p.name} of House ${s.houses[p.host]!.name} is left behind in the otherworld.`);
}

/** At the Reckoning: a Scion Lost two Years ago and never found is dead (§9.9). */
export function lostClock(s: SovState): void {
  for (const p of s.people.filter((x) => x.status === "lost" && x.lost && s.year - x.lost.year >= TUNING.journey.lostYears)) {
    s.houses[p.house]!.chronicle.push({ name: p.name, year: s.year, cause: "lost", level: p.level });
    s.people = s.people.filter((x) => x.id !== p.id);
    log(s, `${p.name} of House ${s.houses[p.house]!.name} was never found. The Chronicle counts them among the dead.`);
  }
}

/** What a battle leaves on the people: Sanity, MP and Durability carry; injuries last; the dead die; victory pays. */
function settle(s: SovState, b: Battle, cause: string): void {
  const e = s.expedition!;
  const won = b.outcome === "victory";
  for (const u of b.units) {
    if (u.side !== "party" || u.person === undefined || u.owner !== undefined) continue;
    let p = person(s, u.person);
    const mods: Record<string, number> = { ...e.carry[p.id]?.mods };
    for (const ev of b.events) {
      if (ev.t !== "injury" || ev.target !== u.id) continue;
      const res = INJURY_BY_ID.get(ev.result);
      if (res?.lasting) p.injuries.push({ id: res.id, years: res.lasting.years });
      for (const [k, v] of Object.entries(res?.expedition ?? {})) mods[k] = (mods[k] ?? 0) + v;
    }
    if (u.dead) {
      die(s, p, cause);
      continue;
    }
    p.sanity = u.sanity;
    p.mp = u.mp;
    e.carry[p.id] = { dur: { ...u.dur! }, broken: [...u.broken], ...(Object.keys(mods).length ? { mods } : {}) };
    if (u.catatonic && !e.out.includes(p.id)) e.out.push(p.id);
    if (won) p = gainJp(gainXp(p, xpAt(p, P.battleXp, e.card.level)), P.battleJp);
    s.people[s.people.findIndex((x) => x.id === p.id)] = p;
  }
}

/** A Camp (§9.3): the party rests, each location back by a share of its Durability, Sanity a little. */
function camp(s: SovState): void {
  const e = s.expedition!;
  for (const u of party(s)) {
    const p = person(s, u.person!);
    const c = e.carry[p.id];
    if (c) {
      for (const loc of LOCATIONS) c.dur[loc] = Math.min(u.maxDur![loc], u.dur![loc] + Math.round((u.maxDur![loc] * J.camp.durabilityPct) / 100));
      c.broken = [];
    }
    p.sanity = Math.min(u.maxSanity, p.sanity + Math.round((u.maxSanity * J.camp.sanityPct) / 100));
  }
  log(s, "The party makes camp and rests.");
}

/** A battle at the next node: an Encounter from the card's pool, or the boss. */
export type FightOpts = NonNullable<TripEffect["encounter"]> & { raid?: true };

function fight(s: SovState, boss: boolean, o: FightOpts): Battle {
  const card = s.expedition!.card;
  const seed = withRng(s, (rng) => rng.int(2 ** 31));
  const id = boss ? card.boss : undefined;
  const level = Math.max(1, Math.min(10, card.level + (o.level ?? 0) + (boss ? 1 : 0)));
  const scions = party(s);
  bastionShields(s, scions);
  const pool = o.raid ? TUNING.arc.raidPool : card.pool;
  const b = id
    ? bossBattle(seed, scions, id, card.level)
    : // A pool with no boss near the level ends in a fight a level above the card's (reading, see DECISIONS).
      encounterBattle(seed, scions, { pool, level, year: s.year, spread: s.flags.includes(ARC.nestLost), ...(o.modifier ? { modifier: o.modifier } : {}), ...(o.template ? { template: o.template } : {}) }).battle;
  simulate(b);
  return b;
}

/** A battle now: an Encounter (a node's, or an event's) or the boss. True if the party won; a loss sends it home wiped. */
export function battle(s: SovState, boss: boolean, o: FightOpts = {}): boolean {
  const e = s.expedition!;
  const b = fight(s, boss, o);
  settle(s, b, boss ? (e.card.boss ?? "boss") : `${e.card.pool}_encounter`);
  if (b.outcome === "victory") {
    log(s, boss ? "The party defeats the boss." : "The party wins a battle.");
    for (const id of marching(s)) creditWard(s, person(s, id), "valor", boss ? J.valor.boss : J.valor.battle);
    if (boss) {
      bossLoot(s);
      home(s, "won");
    } else {
      encounterLoot(s);
      succeed(s);
    }
    return true;
  }
  log(s, `The party falls before ${boss ? "the boss" : "an encounter"}.`);
  // The Bastion of the Gate (§8.4): once, the final assault falls back and regroups instead; the boss waits.
  if (marching(s).length && bastionFallBack(s)) {
    if (boss) e.at -= 1;
    camp(s);
    return false;
  }
  home(s, "wiped");
  return false;
}

/** The Leader's House presses on: the next node resolves. */
export function pressOn(s: SovState): void {
  const e = s.expedition!;
  const kind = e.chain[e.at]!;
  e.at += 1;
  if (kind === "camp") return camp(s);
  if (kind === "event") return meet(s);
  if (kind === "cache") return cache(s);
  if (kind === "gate") return gate(s);
  if (kind === "rally") return rally(s);
  if (kind === "raid") log(s, "The Cursed King's knights ride against the party.");
  battle(s, kind === "boss", kind === "raid" ? { raid: true } : {});
}

/** A Leader who falls is replaced by the most travelled Scion still marching (§9.2's tie rule). */
export function succeed(s: SovState): void {
  const e = s.expedition!;
  const left = marching(s);
  if (!left.length || left.includes(e.leader!)) return;
  const runs = (id: number) => person(s, id).hist.expeditions ?? 0;
  e.leader = left.reduce((a, b) => (runs(b) > runs(a) ? b : a));
  const p = person(s, e.leader);
  log(s, `${p.name} of House ${s.houses[p.host]!.name} takes command.`);
}

/** Why the Leader's House cannot turn back now, or null. */
export function cannotRetreat(s: SovState): string | null {
  const e = s.expedition!;
  return e.chain[e.at] === "boss" ? "There is no turning back before the boss." : null;
}

/** The party comes home: finished, turned back, or wiped (§9.9). */
export function home(s: SovState, how: NonNullable<Expedition["result"]>): void {
  const e = s.expedition!;
  // A 2×4 card (§9.3): one party turning back or falling leaves the other on its way.
  if (divided(e) && (how === "retreated" || how === "wiped")) {
    const party = marching(s);
    if (how === "retreated") {
      log(s, "The party turns back for home.");
      for (const h of new Set(party.map((id) => person(s, id).host))) s.houses[h]!.score.valor = Math.max(0, s.houses[h]!.score.valor - J.valor.retreat);
    } else log(s, "The party is overrun.");
    const end = partyGone(s, how, party);
    if (!end) return;
    how = end as typeof how;
  }
  e.result = how;
  const mandatory = e.card.type === "mandatory";
  if (how === "won") {
    for (const id of marching(s)) {
      const i = s.people.findIndex((p) => p.id === id);
      s.people[i] = gainJp(gainXp(s.people[i]!, xpAt(s.people[i]!, P.expeditionXp, e.card.level)), P.expeditionJp);
    }
    log(s, "The expedition returns in triumph.");
    // A Rescue card's Lost come home with the party (§9.9).
    for (const id of e.card.rescue ?? []) {
      const p = s.people.find((x) => x.id === id && x.status === "lost");
      if (!p) continue;
      p.status = "scion";
      delete p.lost;
      log(s, `${p.name} of House ${s.houses[p.house]!.name} is found alive and brought home.`);
    }
  }
  if (how === "retreated") {
    log(s, "The expedition turns back; whatever lay at its end stays there.");
    for (const h of new Set(marching(s).map((id) => person(s, id).host))) s.houses[h]!.score.valor = Math.max(0, s.houses[h]!.score.valor - J.valor.retreat);
  }
  // §9.9: a party that walks home brings what it carries; a wiped one loses it.
  if (how === "won" || how === "retreated") shareOut(s);
  if (how === "wiped") {
    if (e.haul) log(s, "Everything the party carried is lost with it.");
    delete e.haul;
    // §9.9: each falls; half are left behind, Lost, and the rest crawl home.
    withRng(s, (rng) => {
      for (const id of marching(s)) {
        const p = person(s, id);
        if (rng.int(100) < J.lostPct) lose(s, p);
      }
    });
  }
  if (how === "unanswered") log(s, "No one answers the Rift Gate's call.");
  if (mandatory) arcResult(s, how === "won");
  if (how !== "won" && mandatory) {
    if (s.year === mandatoryYears(s).at(-1)) return endCampaign(s, false, "The assault on the rift failed, and the otherworld takes the kingdom.");
    devastate(s, "mandatory", arcDoom(s));
  }
  // A forced expedition counts as the Year's mandatory one, with lesser stakes (§3.2).
  if (how !== "won" && e.card.type === "forced") devastate(s, "forced");
}

/**
 * The bot Leader presses on until half the party is out or badly broken, or a Scion is near
 * the end of their Sanity; it never turns back from a mandatory or forced expedition.
 */
export function botPress(s: SovState): boolean {
  const e = s.expedition!;
  if (e.card.type === "mandatory" || e.card.type === "forced" || cannotRetreat(s)) return true;
  const ids = marching(s);
  const all = walkers(s).length;
  if (ids.some((id) => person(s, id).sanity < J.botRetreatSanity)) return false;
  const hurt = all - ids.length + ids.filter((id) => (e.carry[id]?.broken.length ?? 0) >= J.botRetreatBroken).length;
  return hurt * 100 < all * J.botRetreatHurtPct;
}
