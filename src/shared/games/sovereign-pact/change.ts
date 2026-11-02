// Changes (§9.6; Josh 2026-11-02: a Scion's permanent transformation is a Change, Form stays the
// Alterer's). A Change replaces the Scion's stats, growths, traits, look and injuries with its record
// (content/changes.json) and keeps name, House, Tarot, level, JP, learned Jobs and Loyalty. It may fix
// the Job, take gear slots away, bar Year assignments and eat Stores at each Reckoning. An event can give
// the old body back.
import { CHANGE_BY_ID, type ChangeDef } from "./content.ts";
import { caps } from "./combat/build.ts";
import { cannotEquip, itemById } from "./items.ts";
import { GEAR_SLOTS, STATS, type AssignmentKind, type Body, type GearSlot, type Person, type Six, type SovState } from "./state.ts";
import { TUNING } from "./tuning.ts";
import { log } from "./year.ts";

export const changeOf = (p: Pick<Person, "change">): ChangeDef | undefined => (p.change ? CHANGE_BY_ID.get(p.change.id) : undefined);

/** Whether the Change keeps `p` from a Year assignment (a Barrow Knight from the Chapel). */
export const barred = (p: Pick<Person, "change">, kind: AssignmentKind): boolean => !!changeOf(p)?.barred?.includes(kind);

/** Whether the Change leaves `p` the use of a gear slot. */
export const hasSlot = (p: Pick<Person, "change">, slot: GearSlot): boolean => changeOf(p)?.slots.includes(slot) ?? true;

/** Takes off anything the new body cannot wear: a slot it lost, or a weapon its Job forbids. */
function strip(s: SovState, p: Person): void {
  for (const slot of GEAR_SLOTS) {
    const item = itemById(s, p.gear[slot]);
    if (item && cannotEquip(s, p, item, slot)) delete p.gear[slot];
  }
}

/** Sanity and MP no higher than the new body's ceilings; its Durability fresh if it is mid-expedition. */
function settle(s: SovState, p: Person): void {
  const cap = caps(s, p);
  p.sanity = Math.min(p.sanity, cap.sanity);
  p.mp = Math.min(p.mp, cap.mp);
  const c = s.expedition?.carry[p.id];
  if (c) {
    c.dur = {};
    c.broken = [];
  }
}

/** `base` and `carry` after `levels` levels of `growth`, as levelUp would grow them. */
function grown(base: Six, growth: Six, carry: Six, levels: number): { base: Six; carry: Six } {
  const b = [...base] as Six;
  const c = [...carry] as Six;
  for (let l = 0; l < levels; l++)
    for (let i = 0; i < 6; i++) {
      c[i]! += growth[i]!;
      b[i]! += Math.floor(c[i]! / 100);
      c[i]! %= 100;
    }
  return { base: b, carry: c };
}

/** `p` is Changed into `id`. A second Change replaces the first; the body kept is still the one they were born in. */
export function change(s: SovState, p: Person, id: string): void {
  const def = CHANGE_BY_ID.get(id);
  if (!def || p.change?.id === id) return;
  const was: Body = p.change?.was ?? {
    level: p.level,
    base: p.base,
    growth: p.growth,
    carry: p.carry,
    traits: p.traits,
    look: p.look,
    injuries: p.injuries,
    job: p.job,
    ...(p.secondary ? { secondary: p.secondary } : {}),
  };
  const growth = STATS.map((k) => def.growth[k]) as Six;
  const body = grown(STATS.map((k) => def.base[k]) as Six, growth, [0, 0, 0, 0, 0, 0], p.level - 1);
  p.base = body.base;
  p.carry = body.carry;
  p.growth = growth;
  p.traits = [];
  delete p.blessed;
  p.look = [...def.look];
  p.injuries = [];
  if (def.job) {
    p.job = def.job;
    p.jp = { ...p.jp, [def.job]: p.jp[def.job] ?? 0 };
    if (p.secondary === def.job) delete p.secondary;
  }
  p.change = { id, was };
  strip(s, p);
  settle(s, p);
  log(s, `${p.name} is Changed: a ${def.name} now.`);
}

/** The old body comes back, grown by the levels gained since, its old traits and injuries with it. */
export function unchange(s: SovState, p: Person): void {
  const def = changeOf(p);
  if (!def) return;
  const was = p.change!.was;
  const body = grown(was.base, was.growth, was.carry, Math.max(0, p.level - was.level));
  p.base = body.base;
  p.carry = body.carry;
  p.growth = was.growth;
  p.traits = was.traits;
  p.look = was.look;
  p.injuries = was.injuries;
  p.job = was.job;
  if (was.secondary && was.secondary !== p.job) p.secondary = was.secondary;
  delete p.change;
  strip(s, p);
  settle(s, p);
  log(s, `${p.name} is no longer a ${def.name}: their own body comes back.`);
}

/**
 * At the Reckoning each Changed person's House pays the Change's upkeep (Essence, Grain). Short of it,
 * the hunger costs Sanity instead (first pass: tuning.change.hungerSanityPct of the ceiling).
 */
export function changeUpkeep(s: SovState): void {
  for (const p of s.people) {
    const def = changeOf(p);
    if (!def?.upkeep || p.status === "lost") continue;
    const stores = s.houses[p.host]!.stores;
    const need = Object.entries(def.upkeep);
    if (need.every(([k, n]) => (stores[k] ?? 0) >= n!)) {
      for (const [k, n] of need) stores[k] = stores[k]! - n!;
      continue;
    }
    p.sanity = Math.max(0, p.sanity - Math.ceil((caps(s, p).sanity * TUNING.change.hungerSanityPct) / 100));
    log(s, `${p.name} goes hungry: the ${def.name} is not fed this Year.`);
  }
}
