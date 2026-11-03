// Town event effects (§9.4's catalogue, the parts that touch the town): the tracks, resources, ruined
// buildings, lost recruits, Sanity, score, flags and the timeline. Each effect names whom it touches;
// without a subject House, an effect with no `to` falls on one random House.
import { holders } from "./assign.ts";
import { loseAccord } from "./commons.ts";
import type { TownEffect, TownScionEffect } from "./content.ts";
import { caps } from "./combat/build.ts";
import { befall } from "./events.ts";
import { jobStat } from "./formulas.ts";
import { rollRecruit } from "./generate.ts";
import { STATS, type Person, type ScoreCategory, type SovState, type Stat } from "./state.ts";
import { TUNING } from "./tuning.ts";
import { log, withRng } from "./year.ts";

/** The Houses an effect touches. */
function targets(s: SovState, e: TownEffect, subject: number | null): number[] {
  const to = e.to ?? (subject === null ? "random" : "house");
  if (to === "all") return s.houses.map((_, i) => i);
  if (to === "house" && subject !== null) return [subject];
  if (to === "commons") return [];
  return [withRng(s, (rng) => rng.int(s.houses.length))];
}

/**
 * How much of an event's harm a House's guards turn aside (§8.3 Guard: "theft, haunting and sabotage
 * events against the House are weakened"): `guardPct`% a Scion on the walls, 0 to 1.
 */
export function guarded(s: SovState, house: number): number {
  const on = holders(s, house, "guard").filter((p) => p.status === "scion" || p.status === "retired").length;
  return Math.min(1, (on * TUNING.assignments.guardPct) / 100);
}

/**
 * Applies a town event's effects. Harm aimed at one House (not at every House alike) is softened by its
 * guards, unless `guard` is false: a bargain or a temptation the House chose is not fought off at the walls.
 */
export function applyEffects(s: SovState, effects: readonly TownEffect[], subject: number | null, guard = true): void {
  for (const e of effects) {
    if (e.accord) {
      if (e.accord < 0) loseAccord(s, -e.accord);
      else s.accord = Math.min(100, s.accord + e.accord);
    }
    if (e.doom) s.doom = Math.max(0, Math.min(100, s.doom + e.doom));
    if (e.flag && !s.flags.includes(e.flag)) s.flags.push(e.flag);
    if (e.timeline) s.timeline.push({ year: s.year + e.timeline.years, id: e.timeline.event, ...(subject === null ? {} : { house: subject }), ...(e.timeline.hidden ? { hidden: true as const } : {}) });
    if (e.resources && e.to === "commons") {
      for (const [k, n] of Object.entries(e.resources)) {
        if (k === "gold") s.commons.gold = Math.max(0, s.commons.gold + (n ?? 0));
        else s.commons.stores[k] = Math.max(0, (s.commons.stores[k] ?? 0) + (n ?? 0));
      }
    }
    const hit = e.resources || e.ruin || e.recruits_lost || e.sanity || e.score || e.recruit_gain || e.scion ? targets(s, e, subject) : [];
    for (const i of hit) touch(s, e, i, guard && (e.to ?? (subject === null ? "random" : "house")) !== "all" ? guarded(s, i) : 0);
    for (const i of e.scion ? hit : []) befallAtHome(s, e.scion!, i);
  }
}

/** A House building loses a level; at 0 it is gone. */
export function damage(s: SovState, house: number, building: string): void {
  const h = s.houses[house]!;
  h.buildings[building] = (h.buildings[building] ?? 1) - 1;
  if (!h.buildings[building]) delete h.buildings[building];
  log(s, `House ${h.name}'s ${building.replace(/_/g, " ")} is damaged.`);
}

function touch(s: SovState, e: TownEffect, i: number, guard = 0): void {
  const h = s.houses[i]!;
  // A loss shrinks by the guard's share; a gain is untouched.
  const soften = (n: number) => (n < 0 ? Math.round(n * (1 - guard)) : n);
  let turned = false;
  const averted = () => {
    if (guard <= 0 || withRng(s, (rng) => rng.int(100)) >= Math.round(guard * 100)) return false;
    turned = true;
    return true;
  };
  for (const [k, raw] of Object.entries(e.resources ?? {})) {
    const n = soften(raw ?? 0);
    if (n !== (raw ?? 0)) turned = true;
    if (k === "gold") h.gold = Math.max(0, h.gold + n);
    else h.stores[k] = Math.max(0, (h.stores[k] ?? 0) + n);
  }
  for (const [k, n] of Object.entries(e.score ?? {})) h.score[k as ScoreCategory] += n ?? 0;
  for (let n = 0; n < (e.ruin ?? 0); n++) {
    const standing = Object.keys(h.buildings).filter((b) => h.buildings[b]);
    if (!standing.length) break;
    if (averted()) continue;
    damage(s, i, withRng(s, (rng) => rng.pick(standing)));
  }
  for (let n = 0; n < (e.recruits_lost ?? 0); n++) {
    const pool = s.people.filter((p) => p.host === i && p.status === "recruit");
    if (!pool.length) break;
    if (averted()) continue;
    const gone = withRng(s, (rng) => rng.pick(pool));
    s.people = s.people.filter((p) => p !== gone);
    delete s.assign[gone.id];
  }
  for (let n = 0; n < (e.recruit_gain ?? 0); n++) {
    const id = s.nextId++;
    s.people.push(withRng(s, (rng) => rollRecruit(rng, id, i, s.houses[i])));
  }
  if (e.sanity) {
    const pct = soften(e.sanity);
    if (pct !== e.sanity) turned = true;
    for (const p of s.people) {
      if (p.host !== i || (p.status !== "scion" && p.status !== "retired")) continue;
      const max = caps(s, p).sanity;
      p.sanity = Math.max(0, Math.min(max, p.sanity + Math.round((max * pct) / 100)));
    }
  }
  if (turned) log(s, `House ${h.name}'s guards on the walls turn aside some of the harm.`);
}

/** The Scion (or Retired) of House `house` that `who` names; ties go to the earliest sworn. */
export function pickAtHome(s: SovState, house: number, who = "random"): Person | undefined {
  const pool = s.people.filter((p) => p.host === house && (p.status === "scion" || p.status === "retired"));
  if (!pool.length) return undefined;
  if (who === "random") return withRng(s, (rng) => rng.pick(pool));
  const [how, stat] = who.split(":") as [string, Stat | undefined];
  const score = (p: Person): number => {
    if (how === "eldest") return p.age;
    if (how === "youngest") return -p.age;
    if (how === "veteran") return p.level;
    if (how === "greenest") return -p.level;
    if (how === "sanest") return p.sanity;
    if (how === "maddest") return -p.sanity;
    const v = stat && STATS.includes(stat) ? jobStat(p, stat) : 0;
    return how === "lowest" ? -v : v;
  };
  return pool.reduce((best, p) => (score(p) > score(best) ? p : best));
}

/** What befalls one of a House's own at home: picked by the effect's `who`, then changed as on the road. */
function befallAtHome(s: SovState, fx: TownScionEffect, house: number): void {
  const p = pickAtHome(s, house, fx.who);
  if (!p) return;
  if (fx.age) p.age = Math.max(14, p.age + fx.age);
  befall(s, s.people.indexOf(p), fx, "at home");
}
