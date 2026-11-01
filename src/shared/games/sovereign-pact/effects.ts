// Town event effects (§9.4's catalogue, the parts that touch the town): the tracks, resources, ruined
// buildings, lost recruits, Sanity, score, flags and the timeline. Each effect names whom it touches;
// without a subject House, an effect with no `to` falls on one random House.
import { loseAccord } from "./commons.ts";
import type { TownEffect } from "./content.ts";
import { maxSanity } from "./formulas.ts";
import { rollRecruit } from "./generate.ts";
import type { ScoreCategory, SovState } from "./state.ts";
import { log, withRng } from "./year.ts";

/** The Houses an effect touches. */
function targets(s: SovState, e: TownEffect, subject: number | null): number[] {
  const to = e.to ?? (subject === null ? "random" : "house");
  if (to === "all") return s.houses.map((_, i) => i);
  if (to === "house" && subject !== null) return [subject];
  if (to === "commons") return [];
  return [withRng(s, (rng) => rng.int(s.houses.length))];
}

export function applyEffects(s: SovState, effects: readonly TownEffect[], subject: number | null): void {
  for (const e of effects) {
    if (e.accord) {
      if (e.accord < 0) loseAccord(s, -e.accord);
      else s.accord = Math.min(100, s.accord + e.accord);
    }
    if (e.doom) s.doom = Math.max(0, Math.min(100, s.doom + e.doom));
    if (e.flag && !s.flags.includes(e.flag)) s.flags.push(e.flag);
    if (e.timeline) s.timeline.push({ year: s.year + e.timeline.years, id: e.timeline.event, ...(subject === null ? {} : { house: subject }) });
    if (e.resources && e.to === "commons") {
      for (const [k, n] of Object.entries(e.resources)) {
        if (k === "gold") s.commons.gold = Math.max(0, s.commons.gold + (n ?? 0));
        else s.commons.stores[k] = Math.max(0, (s.commons.stores[k] ?? 0) + (n ?? 0));
      }
    }
    const hit = e.resources || e.ruin || e.recruits_lost || e.sanity || e.score || e.recruit_gain ? targets(s, e, subject) : [];
    for (const i of hit) touch(s, e, i);
  }
}

function touch(s: SovState, e: TownEffect, i: number): void {
  const h = s.houses[i]!;
  for (const [k, n] of Object.entries(e.resources ?? {})) {
    if (k === "gold") h.gold = Math.max(0, h.gold + (n ?? 0));
    else h.stores[k] = Math.max(0, (h.stores[k] ?? 0) + (n ?? 0));
  }
  for (const [k, n] of Object.entries(e.score ?? {})) h.score[k as ScoreCategory] += n ?? 0;
  for (let n = 0; n < (e.ruin ?? 0); n++) {
    const standing = Object.keys(h.buildings).filter((b) => h.buildings[b]);
    if (!standing.length) break;
    const b = withRng(s, (rng) => rng.pick(standing));
    h.buildings[b] = h.buildings[b]! - 1;
    if (!h.buildings[b]) delete h.buildings[b];
    log(s, `House ${h.name}'s ${b.replace(/_/g, " ")} is damaged.`);
  }
  for (let n = 0; n < (e.recruits_lost ?? 0); n++) {
    const pool = s.people.filter((p) => p.host === i && p.status === "recruit");
    if (!pool.length) break;
    const gone = withRng(s, (rng) => rng.pick(pool));
    s.people = s.people.filter((p) => p !== gone);
    delete s.assign[gone.id];
  }
  for (let n = 0; n < (e.recruit_gain ?? 0); n++) {
    const id = s.nextId++;
    s.people.push(withRng(s, (rng) => rollRecruit(rng, id, i)));
  }
  if (e.sanity) {
    for (const p of s.people) {
      if (p.host !== i || (p.status !== "scion" && p.status !== "retired")) continue;
      p.sanity = Math.max(0, Math.min(maxSanity(p), p.sanity + Math.round((maxSanity(p) * e.sanity) / 100)));
    }
  }
}
