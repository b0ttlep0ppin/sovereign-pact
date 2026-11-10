// Town event effects (§9.4's catalogue, the parts that touch the town): the tracks, resources, ruined
// buildings, lost recruits, Sanity, score, flags and the timeline. Each effect names whom it touches;
// without a subject House, an effect with no `to` falls on one random House.
import { holders, lapse } from "./assign.ts";
import { loseAccord } from "./commons.ts";
import type { TownEffect, TownScionEffect } from "./content.ts";
import { caps } from "./combat/build.ts";
import { befall } from "./events.ts";
import { jobStat } from "./formulas.ts";
import { namesTaken, rollRecruit } from "./generate.ts";
import { year20 } from "./crisis.ts";
import { give } from "./consumables.ts";
import { BUILDING_BY_ID, HOUSE_TRAIT_BY_ID, ITEM_BASES } from "./content.ts";
import { madeNamed, mintNamed, rollProps, stock } from "./items.ts";
import { itemName } from "./loot.ts";
import { STATS, type House, type Person, type ScoreCategory, type SovState, type Stat } from "./state.ts";
import { giveWard } from "./wards.ts";
import { TUNING } from "./tuning.ts";
import { log, withRng } from "./year.ts";

/** The Houses an effect touches. */
function targets(s: SovState, e: TownEffect, subject: number | null, named?: number): number[] {
  const to = e.to ?? (subject === null ? "random" : "house");
  if (to === "target") return named === undefined ? [] : [named];
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
export function applyEffects(s: SovState, effects: readonly TownEffect[], subject: number | null, guard = true, named?: number, champion?: number): void {
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
    const gives = e.item || e.consumable || e.house_trait || e.raze || e.raise;
    const hit = e.resources || e.ruin || e.recruits_lost || e.sanity || e.score || e.recruit_gain || e.scion || gives ? targets(s, e, subject, named) : [];
    for (const i of hit) touch(s, e, i, guard && (e.to ?? (subject === null ? "random" : "house")) !== "all" ? guarded(s, i) : 0);
    // The champion a House put forward (Josh 2026-11-03: "their scions should be imperiled at times").
    if (e.scion?.who === "champion") {
      const at = s.people.findIndex((p) => p.id === champion && p.status !== "lost");
      if (at >= 0) {
        if (e.scion.age) s.people[at]!.age = Math.max(14, s.people[at]!.age + e.scion.age);
        befall(s, at, e.scion, "at home");
      }
      continue;
    }
    for (const i of e.scion ? hit : []) {
      const done: number[] = [];
      for (let n = 0; n < (e.scion!.count ?? 1); n++) {
        const id = befallAtHome(s, e.scion!, i, done);
        if (id === undefined) break;
        done.push(id);
      }
    }
    for (const i of gives ? hit : []) bestow(s, e, i);
    // Between two Houses: the subject and the one its chooser named.
    const from = subject ?? undefined;
    if (e.gift && from !== undefined && named !== undefined) giftBuilding(s, from, named, e.gift);
    if (e.ward_swap && from !== undefined && named !== undefined) swapWards(s, from, named);
  }
}

/** What an event gives a House or takes from it outright: an item, consumables, a mark on the line, a building torn down or raised. */
function bestow(s: SovState, e: TownEffect, i: number): void {
  const h = s.houses[i]!;
  if (e.item) {
    const named = e.item.named && !madeNamed(s, e.item.named) ? e.item.named : undefined;
    const ilvl = Math.max(1, Math.ceil(year20(s) / 2));
    const item = named
      ? mintNamed(s, named, i, ilvl)
      : withRng(s, (rng) => rollProps(rng, { id: s.nextId++, base: rng.pick(ITEM_BASES).id, tier: e.item!.tier ?? 3, ilvl, house: i }, { negativeChance: TUNING.loot.negativePct }));
    stock(s, item);
    log(s, `House ${h.name} comes by ${named ? itemName(item) : `a ${itemName(item)}`}.`);
  }
  if (e.consumable) give(h, e.consumable.id, e.consumable.n ?? 1);
  if (e.house_trait) {
    const id = e.house_trait.slice(1);
    const has = h.traits.includes(id);
    if (e.house_trait[0] === "+" && !has && HOUSE_TRAIT_BY_ID.has(id)) {
      h.traits.push(id);
      log(s, `House ${h.name} is marked: ${HOUSE_TRAIT_BY_ID.get(id)!.name}.`);
    } else if (e.house_trait[0] === "-" && has) {
      h.traits = h.traits.filter((t) => t !== id);
      log(s, `House ${h.name} is free of ${HOUSE_TRAIT_BY_ID.get(id)?.name ?? id}.`);
    }
  }
  if (e.raze) {
    const b = pickBuilding(h, e.raze);
    if (b) {
      delete h.buildings[b];
      lapse(s, i);
      log(s, `House ${h.name}'s ${BUILDING_BY_ID.get(b)?.name ?? b} is torn down.`);
    }
  }
  if (e.raise) {
    // "any": one of the House's buildings below the top; with none standing, a new one (The Night Mason).
    const grow = Object.keys(h.buildings).filter((b) => (h.buildings[b] ?? 0) > 0 && h.buildings[b]! < 3);
    const fresh = [...BUILDING_BY_ID.keys()].filter((b) => !(h.buildings[b] ?? 0));
    const from = grow.length ? grow : fresh;
    const up = e.raise === "any" ? (from.length ? withRng(s, (rng) => rng.pick(from)) : undefined) : e.raise;
    if (up && BUILDING_BY_ID.has(up) && (h.buildings[up] ?? 0) < 3) {
      h.buildings[up] = (h.buildings[up] ?? 0) + 1;
      log(s, `House ${h.name}'s ${BUILDING_BY_ID.get(up)!.name} rises to level ${h.buildings[up]}.`);
    }
  }
}

/** A standing building of the House: `id` if it stands, or its highest ("best"; the first built breaks ties). */
function pickBuilding(h: House, id: string): string | undefined {
  const standing = Object.keys(h.buildings).filter((b) => (h.buildings[b] ?? 0) > 0);
  if (id !== "best") return standing.includes(id) ? id : undefined;
  return standing.reduce<string | undefined>((best, b) => (best === undefined || h.buildings[b]! > h.buildings[best]! ? b : best), undefined);
}

/** A level of a building passes between Houses: the giver's drops one, the receiver's rises one (never past 3). */
function giftBuilding(s: SovState, from: number, to: number, id: string): void {
  const b = pickBuilding(s.houses[from]!, id);
  if (!b || (s.houses[to]!.buildings[b] ?? 0) >= 3) return;
  damage(s, from, b);
  s.houses[to]!.buildings[b] = (s.houses[to]!.buildings[b] ?? 0) + 1;
  log(s, `House ${s.houses[to]!.name}'s ${BUILDING_BY_ID.get(b)?.name ?? b} rises to level ${s.houses[to]!.buildings[b]}, a gift of House ${s.houses[from]!.name}.`);
}

/** Two Houses give each other their youngest Scion as Wards (a marriage pact, hostages for a peace). */
function swapWards(s: SovState, a: number, b: number): void {
  const young = (h: number) => s.people.filter((p) => p.host === h && p.house === h && p.status === "scion").sort((x, y) => x.age - y.age || x.id - y.id)[0];
  const [pa, pb] = [young(a), young(b)];
  if (!pa || !pb) return;
  giveWard(s, a, b, pa.id);
  giveWard(s, b, a, pb.id);
  log(s, `Houses ${s.houses[a]!.name} and ${s.houses[b]!.name} exchange Wards: ${pa.name} and ${pb.name}.`);
}

/** A House building loses a level; at 0 it is gone. */
export function damage(s: SovState, house: number, building: string): void {
  const h = s.houses[house]!;
  h.buildings[building] = (h.buildings[building] ?? 1) - 1;
  if (!h.buildings[building]) delete h.buildings[building];
  lapse(s, house);
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
    s.people.push(withRng(s, (rng) => rollRecruit(rng, id, i, s.houses[i], namesTaken(s))));
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
export function pickAtHome(s: SovState, house: number, who = "random", except: readonly number[] = []): Person | undefined {
  const pool = s.people.filter((p) => p.host === house && (p.status === "scion" || p.status === "retired") && !except.includes(p.id));
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
function befallAtHome(s: SovState, fx: TownScionEffect, house: number, except: number[] = []): number | undefined {
  // Each of `count` is the next one `who` names, never the same Scion twice.
  const p = pickAtHome(s, house, fx.who, except);
  if (!p) return undefined;
  const id = p.id;
  if (fx.age) p.age = Math.max(14, p.age + fx.age);
  befall(s, s.people.indexOf(p), fx, "at home");
  return id;
}
