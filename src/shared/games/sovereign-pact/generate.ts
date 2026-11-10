// Making new Houses and new people (§5, §6.3). House creation's screens (Milestone 5) replace the
// random House; recruit generation grows House trait modifiers and individual traits then.
import type { Rng } from "../../rng.ts";
import { HERALDRY, NAMES, SEATS, TAROT, TRAIT_BY_ID, TRAITS } from "./content.ts";
import { maxMp, maxSanity } from "./formulas.ts";
import { houseEffects } from "./houses.ts";
import {
  BASE_JOBS,
  ELEMENTS,
  SCORE_CATEGORIES,
  STATS,
  type Ambition,
  type House,
  type Person,
  type PotentialTier,
  type Score,
  type Six,
  type SovState,
} from "./state.ts";
import { forHouses, TUNING } from "./tuning.ts";

/**
 * A recruit's individual traits (§6.3, §6.7): first the innate ones the House's blood gives by chance
 * (Fleet of Foot: 30% Fleet), then 1–3 in all from the table by weight, a trait of the House's element
 * more often, one per group (never Fleet and Sluggish).
 */
export function rollTraits(rng: Rng, blood?: Pick<House, "traits" | "element" | "bane">): string[] {
  const fx = blood ? houseEffects(blood) : undefined;
  const T = TUNING.recruits.traits;
  const out: string[] = [];
  const fits = (id: string) => {
    const def = TRAIT_BY_ID.get(id);
    return !!def && !out.includes(id) && !(def.group && out.some((o) => TRAIT_BY_ID.get(o)?.group === def.group));
  };
  for (const [id, chance] of Object.entries(fx?.innate ?? {})) if (rng.int(100) < chance && fits(id)) out.push(id);
  let roll = rng.int(100);
  const count = 1 + T.count.findIndex((w) => (roll -= w) < 0);
  while (out.length < count) {
    const pool = TRAITS.filter((t) => t.weight > 0 && fits(t.id));
    const weight = (t: (typeof pool)[number]) => t.weight * (blood?.element && t.element === blood.element ? T.alignedWeight : 1);
    let r = rng.int(pool.reduce((n, t) => n + weight(t), 0));
    out.push(pool.find((t) => (r -= weight(t)) < 0)!.id);
  }
  return out;
}

/** An integer in [lo, hi], both included. */
export const between = (rng: Rng, lo: number, hi: number): number => lo + rng.int(hi - lo + 1);

const POTENTIALS: readonly PotentialTier[] = ["common", "promising", "gifted", "prodigy"];

function rollPotential(rng: Rng): PotentialTier {
  let roll = rng.int(100);
  for (const tier of POTENTIALS) {
    roll -= TUNING.recruits.potential[tier].chance;
    if (roll < 0) return tier;
  }
  return "common";
}

export const emptyScore = (): Score => Object.fromEntries(SCORE_CATEGORIES.map((c) => [c, 0])) as Score;

/** Two different categories: one doubled, one halved (§3.4). */
export function dealAmbition(rng: Rng): Ambition {
  const [double, halve] = rng.shuffle(SCORE_CATEGORIES);
  return { double: double!, halve: halve! };
}

/**
 * A new recruit for House `house` (§6.3). Speed starts at its baseline and barely grows (§7.1). The
 * House's traits scale each rolled growth rate by their % (§5.3), after the roll, so the draws match.
 */
export function rollRecruit(rng: Rng, id: number, house: number, blood?: Pick<House, "traits" | "element" | "bane">, taken?: Set<string>): Person {
  const sex = rng.int(2) === 0 ? "f" : "m";
  // No two living people share a given name while the list lasts (Josh saw two Ursulas in one muster), nor
  // the living and the Chronicled dead; the list is long enough for a whole campaign (Josh 2026-11-10).
  const free = NAMES.given[sex].filter((x) => !taken?.has(x));
  const [lo, hi] = TUNING.recruits.baseRoll;
  const potential = rollPotential(rng);
  const [glo, ghi] = TUNING.recruits.potential[potential].growth;
  const base: Six = [between(rng, lo, hi), between(rng, lo, hi), between(rng, lo, hi), between(rng, lo, hi), between(rng, lo, hi), TUNING.recruits.speedBase];
  const growth: Six = [between(rng, glo, ghi), between(rng, glo, ghi), between(rng, glo, ghi), between(rng, glo, ghi), between(rng, glo, ghi), 0];
  const pct = blood ? houseEffects(blood).growth : {};
  STATS.forEach((stat, i) => (growth[i] = Math.max(0, Math.round(growth[i]! * (1 + (pct[stat] ?? 0) / 100)))));
  const person: Person = {
    id,
    status: "recruit",
    house,
    host: house,
    name: rng.pick(free.length ? free : NAMES.given[sex]),
    sex,
    look: [],
    age: between(rng, TUNING.recruits.age[0], TUNING.recruits.age[1]),
    base,
    growth,
    carry: [0, 0, 0, 0, 0, 0],
    potential,
    level: 1,
    xp: 0,
    job: null,
    jp: {},
    mastered: [],
    learned: [],
    passives: [],
    traits: rollTraits(rng, blood),
    tarot: rng.pick(TAROT).id,
    injuries: [],
    sanity: 0,
    mp: 0,
    gear: {},
    hist: {},
  };
  // Superstitious: a share of the line's cards are dealt Reversed (§6.8).
  const reversed = blood ? (houseEffects(blood).economy.reversedPct ?? 0) : 0;
  if (reversed && rng.int(100) < reversed) person.reversed = true;
  person.sanity = maxSanity(person);
  person.mp = maxMp(person);
  taken?.add(person.name);
  return person;
}

/** Promotes a recruit to a level-1 Scion in a base Job (§6.5). Returns a new record. */
export function promote(person: Person, job: (typeof BASE_JOBS)[number]): Person {
  const scion: Person = { ...person, status: "scion", job, jp: { ...person.jp, [job]: person.jp[job] ?? 0 } };
  return { ...scion, sanity: maxSanity(scion), mp: maxMp(scion) };
}

/** A themed random House: what the Random House button fills in until House creation exists (§5.1). */
export function randomHouse(rng: Rng, takenNames: readonly string[], takenColors: readonly string[], houses: number): House {
  const names = NAMES.houses.filter((n) => !takenNames.includes(n));
  const swatches = HERALDRY.palette.filter((s) => !takenColors.includes(s.id));
  const primary = rng.pick(swatches).id;
  const secondary = rng.pick(HERALDRY.palette.filter((s) => s.id !== primary)).id;
  const scale = forHouses(TUNING.economy.incomeScale, houses);
  const elementRoll = rng.int(ELEMENTS.length + 1);
  return {
    name: rng.pick(names.length ? names : NAMES.houses),
    motto: rng.pick(NAMES.mottos),
    colors: [primary, secondary],
    emblem: {
      shield: rng.pick(HERALDRY.shields),
      division: rng.pick(HERALDRY.divisions),
      // The emblem is painted in the House's own colors (DECISIONS 8ab).
      tinctures: [primary, secondary],
      charge: rng.pick(HERALDRY.charges),
    },
    seat: rng.pick(SEATS).id,
    element: elementRoll < ELEMENTS.length ? ELEMENTS[elementRoll]! : null,
    traits: [],
    theme: "",
    ambition: dealAmbition(rng),
    score: emptyScore(),
    pactMarks: 0,
    // Implementation default: each House starts with one Year's income in hand.
    gold: Math.round(TUNING.economy.income.gold * scale),
    debt: 0,
    stores: {
      grain: Math.round(TUNING.economy.income.grain * scale),
      ...Object.fromEntries(Object.entries(TUNING.town.startStores).map(([m, n]) => [m, Math.round(n * scale)])),
    },
    buildings: {},
    works: [],
    chronicle: [],
    sealed: false,
  };
}

/** Every given name in use: the living, the muster's volunteers, and the dead in the Houses' Chronicles (so a fallen Scion's name is not worn again soon). */
export const namesTaken = (s: Pick<SovState, "people"> & Partial<Pick<SovState, "muster" | "houses">>): Set<string> =>
  new Set([...s.people, ...(s.muster?.pool ?? []), ...(s.houses ?? []).flatMap((h) => h.chronicle ?? [])].map((p) => p.name));
