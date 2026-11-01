// Making new Houses and new people (§5, §6.3). House creation's screens (Milestone 5) replace the
// random House; recruit generation grows House trait modifiers and individual traits then.
import type { Rng } from "../../rng.ts";
import { HERALDRY, NAMES, SEATS, TAROT } from "./content.ts";
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
} from "./state.ts";
import { forHouses, TUNING } from "./tuning.ts";

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
export function rollRecruit(rng: Rng, id: number, house: number, blood?: Pick<House, "traits" | "element" | "bane">): Person {
  const sex = rng.int(2) === 0 ? "f" : "m";
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
    name: rng.pick(NAMES.given[sex]),
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
    traits: [],
    tarot: rng.pick(TAROT).id,
    injuries: [],
    sanity: 0,
    mp: 0,
    gear: {},
    hist: {},
  };
  person.sanity = maxSanity(person);
  person.mp = maxMp(person);
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
      tinctures: [primary, rng.pick(HERALDRY.metals)],
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
