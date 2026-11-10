// House creation (§5.1): before Year 1 every seat founds its House. Each starts from a themed Random
// House as its draft; the player changes any part of it (one screen per step in the client, each with
// its dice), keeps one of two Ambitions dealt in secret, and swears the Pact. When every House has
// sworn, its recruits are born with its blood, the Houses draft their first Scions from the city's
// volunteers (muster.ts), and Year 1 opens.
import type { Rng } from "../../rng.ts";
import { HERALDRY, HOUSE_TRAIT_BY_ID, HOUSE_TRAITS, SEAT_BY_ID, SEATS, type HouseTraitDef } from "./content.ts";
import { dealAmbition, namesTaken, randomHouse, rollRecruit } from "./generate.ts";
import { econ } from "./houses.ts";
import { openMuster } from "./muster.ts";
import { ELEMENTS, type Ambition, type Element, type House, type SovMove, type SovState } from "./state.ts";
import { forHouses, TUNING } from "./tuning.ts";
import { withRng } from "./year.ts";

/** The parts of a House its founder chooses (§5.1 steps 1–6 and 9). */
export type HouseDesign = Partial<Pick<House, "name" | "motto" | "colors" | "emblem" | "seat" | "element" | "traits" | "bane" | "theme">>;

/** What a step's dice reroll; none rerolls the whole House. */
export type FoundingStep = "name" | "colors" | "emblem" | "seat" | "element" | "traits";

const KINDS = ["major", "minor", "major_flaw", "minor_flaw", "bloodline"] as const;
type Kind = (typeof KINDS)[number];
/** §5.7 [DECIDED]: 2 Majors, 2 Minors, a Major and a Minor Flaw; or a Bloodline in place of a Major and the Major Flaw. */
const SHAPES: readonly Record<Kind, number>[] = [
  { major: 2, minor: 2, major_flaw: 1, minor_flaw: 1, bloodline: 0 },
  { major: 1, minor: 2, major_flaw: 0, minor_flaw: 1, bloodline: 1 },
];

/** Two different Ambitions, dealt in secret; the founder keeps one (§3.4). */
export function dealTwo(rng: Rng): [Ambition, Ambition] {
  const first = dealAmbition(rng);
  let second = dealAmbition(rng);
  while (second.double === first.double && second.halve === first.halve) second = dealAmbition(rng);
  return [first, second];
}

/** A valid set of traits: a Bloodline about one House in four (`TUNING.founding.bloodlinePct`). */
export function randomTraits(rng: Rng, element: Element | null): Pick<House, "traits" | "bane"> {
  const shape = SHAPES[rng.int(100) < TUNING.founding.bloodlinePct ? 1 : 0]!;
  const traits = KINDS.flatMap((kind) => rng.shuffle(HOUSE_TRAITS.filter((t) => t.kind === kind)).slice(0, shape[kind]).map((t) => t.id));
  if (!traits.includes("elemental_bane")) return { traits };
  return { traits, bane: rng.pick(ELEMENTS.filter((el) => el !== element)) };
}

/** A themed Random House draft for seat `i`, its traits and two Ambitions dealt. */
export function draftHouse(rng: Rng, others: readonly House[], houses: number): House {
  const h = randomHouse(rng, others.map((o) => o.name), others.map((o) => o.colors[0]), houses);
  Object.assign(h, randomTraits(rng, h.element), { dealt: dealTwo(rng) });
  h.ambition = h.dealt![0];
  return h;
}

/** Rerolls one step of a draft, or all of it, from the state's RNG. */
export function reroll(s: SovState, house: number, step?: FoundingStep): void {
  const h = s.houses[house]!;
  const others = s.houses.filter((_, i) => i !== house);
  withRng(s, (rng) => {
    const fresh = randomHouse(rng, others.map((o) => o.name), others.map((o) => o.colors[0]), s.houses.length);
    const pick: Record<FoundingStep, HouseDesign> = {
      name: { name: fresh.name, motto: fresh.motto },
      colors: { colors: fresh.colors, emblem: { ...h.emblem, tinctures: [...fresh.colors] } },
      emblem: { emblem: { ...fresh.emblem, tinctures: [...h.colors] } },
      seat: { seat: fresh.seat },
      element: { element: fresh.element },
      traits: randomTraits(rng, h.element),
    };
    if (step) {
      if (step === "traits") delete h.bane;
      Object.assign(h, pick[step]);
    } else {
      delete h.bane;
      const traits = randomTraits(rng, fresh.element);
      Object.assign(h, { name: fresh.name, motto: fresh.motto, colors: fresh.colors, emblem: fresh.emblem, seat: fresh.seat, element: fresh.element, ...traits });
    }
  });
}

const swatch = (id: unknown) => HERALDRY.palette.some((p) => p.id === id);
const text = (v: unknown, lo: number, hi: number) => typeof v === "string" && v.trim().length >= lo && v.trim().length <= hi;

/** Why a House's traits break §5.7's rules, or null. */
export function cannotTraits(traits: unknown, bane: unknown): string | null {
  if (!Array.isArray(traits) || traits.some((t) => typeof t !== "string" || !HOUSE_TRAIT_BY_ID.has(t))) return "Choose traits from the list.";
  if (new Set(traits).size !== traits.length) return "A House cannot take a trait twice.";
  if (traits.some((t) => HOUSE_TRAIT_BY_ID.get(t as string)!.kind === "mark")) return "A mark is laid on a House by what befalls it, never chosen.";
  const defs = traits.map((t) => HOUSE_TRAIT_BY_ID.get(t as string)!) as HouseTraitDef[];
  const count = (kind: Kind) => defs.filter((d) => d.kind === kind).length;
  if (!SHAPES.some((shape) => KINDS.every((k) => count(k) === shape[k])))
    return "Take 2 Major Traits, 2 Minor Traits, a Major Flaw and a Minor Flaw, or a Bloodline in place of one Major Trait and the Major Flaw.";
  const needs = defs.some((d) => d.choice === "element");
  if (needs && !ELEMENTS.includes(bane as Element)) return "Name the element that hates your House.";
  if (!needs && bane !== undefined) return "Only Elemental Bane names an element.";
  return null;
}

/** Why a draft with `design` applied cannot stand, or null. */
export function cannotDesign(s: SovState, house: number, design: HouseDesign): string | null {
  const d = { ...s.houses[house]!, ...design };
  // New traits without a bane drop the old one, as `design` does.
  if ("traits" in design && !("bane" in design)) delete d.bane;
  if (!text(d.name, 2, 24)) return "A House name is 2 to 24 letters.";
  if (typeof d.motto !== "string" || d.motto.length > 60) return "A motto is at most 60 letters.";
  if (!Array.isArray(d.colors) || d.colors.length !== 2 || !d.colors.every(swatch) || d.colors[0] === d.colors[1]) return "Choose two different House colors.";
  const e = d.emblem;
  if (
    !e ||
    !HERALDRY.shields.includes(e.shield) ||
    !HERALDRY.divisions.includes(e.division) ||
    !HERALDRY.charges.includes(e.charge) ||
    (e.secondary !== undefined && !HERALDRY.charges.includes(e.secondary)) ||
    (e.chargeColor !== undefined && !swatch(e.chargeColor)) ||
    !Array.isArray(e.tinctures) ||
    !e.tinctures.length ||
    !e.tinctures.every((t) => swatch(t) || HERALDRY.metals.includes(t))
  )
    return "That emblem is not one the heralds can paint.";
  if (!SEATS.some((x) => x.id === d.seat)) return "Choose a Seat.";
  if (d.element !== null && !ELEMENTS.includes(d.element)) return "Choose an element, or none.";
  if (typeof d.theme !== "string" || d.theme.length > 40) return "Choose a theme.";
  return cannotTraits(d.traits, d.bane);
}

export function design(s: SovState, house: number, patch: HouseDesign): void {
  const h = s.houses[house]!;
  if ("traits" in patch && !("bane" in patch)) delete h.bane;
  Object.assign(h, patch);
  // The emblem is always painted in the House's colors (DECISIONS 8ab).
  h.emblem = { ...h.emblem, tinctures: [...h.colors] };
}

export function cannotSwear(s: SovState, house: number, ambition: unknown): string | null {
  if (ambition !== 0 && ambition !== 1) return "Keep one of the two Ambitions.";
  const h = s.houses[house]!;
  if (s.houses.some((o, i) => i !== house && o.sealed && o.colors[0] === h.colors[0])) return "Another House has sworn under that color.";
  return cannotDesign(s, house, {});
}

/** The House swears the Pact with the Ambition it keeps; the last to swear begins the campaign. */
export function swear(s: SovState, house: number, ambition: 0 | 1): void {
  const h = s.houses[house]!;
  h.ambition = h.dealt![ambition];
  h.name = h.name.trim();
  h.sealed = true;
  if (s.houses.every((x) => x.sealed)) begin(s);
}

/** Year 1's eve: each House's starting debt and its own-blooded recruits; then the opening draft (muster.ts). */
function begin(s: SovState): void {
  const H = s.houses.length;
  withRng(s, (rng) => {
    s.houses.forEach((h, i) => {
      delete h.dealt;
      // Debt-Ridden: the creditors followed them through the rift (§5.7).
      h.debt += econ(h, "startDebt");
      // The Seat's head start (DECISIONS 8ah): a building, or another recruit.
      const seat = SEAT_BY_ID.get(h.seat);
      for (const [b, level] of Object.entries(seat?.start?.buildings ?? {})) h.buildings[b] = Math.max(h.buildings[b] ?? 0, level);
      const recruits = forHouses(TUNING.houses.startRecruits, H) + (seat?.start?.recruits ?? 0);
      const taken = namesTaken(s);
      for (let n = 0; n < recruits; n++) s.people.push(rollRecruit(rng, s.nextId++, i, h, taken));
    });
  });
  openMuster(s);
}

/** The bot swears its draft, rerolling its colors first if another House swore under them. */
export function botFounding(s: SovState, house: number): SovMove {
  const h = s.houses[house]!;
  if (s.houses.some((o, i) => i !== house && o.sealed && o.colors[0] === h.colors[0])) return { type: "random_house", step: "colors" };
  return { type: "swear", ambition: 0 };
}
