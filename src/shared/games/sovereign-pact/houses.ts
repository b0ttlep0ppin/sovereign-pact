// What a House's blood gives its people (§5.3, §5.6, §5.7): its traits and its element, summed into
// one record each system reads. Battle mods ride with every person born to the House, wherever they
// are hosted; growth shapes each recruit as it is rolled. Economy, score and Job XP knobs are read by
// the systems that own them; tags wait on events and later systems.
import { HOUSE_TRAIT_BY_ID, SEAT_BY_ID } from "./content.ts";
import { ELEMENTS, STATS, type Element, type House, type JobId, type ScoreCategory, type Stat } from "./state.ts";
import { TUNING } from "./tuning.ts";

export interface HouseEffects {
  mods: Record<string, number>;
  /** Recruit growth rate in % of the rolled rate, per stat. */
  growth: Partial<Record<Stat, number>>;
  jobXp: Partial<Record<JobId, number>>;
  economy: Record<string, number>;
  score: Partial<Record<ScoreCategory, number>>;
  /** Chance in % that a recruit rolls each individual trait. */
  innate: Record<string, number>;
  tags: string[];
  look: string[];
}

/** The element across the pair: Holy/Dark, Fire/Water, Earth/Wind (§5.6). */
export const opposite = (el: Element): Element => ELEMENTS[ELEMENTS.indexOf(el) ^ 1]!;

const add = <K extends string>(into: Partial<Record<K, number>>, from: Partial<Record<K, number>> | undefined) => {
  for (const [k, v] of Object.entries(from ?? {}) as [K, number][]) into[k] = (into[k] ?? 0) + v;
};

/** What houseEffects reads of a House: its traits, element and bane, and its Seat when it has one. */
type Blood = Pick<House, "traits" | "element" | "bane"> & { seat?: string };

/** One economy knob of a House's traits and Seat (0 when none names it). */
export const econ = (h: Blood, key: string): number => houseEffects(h).economy[key] ?? 0;

/** The House's resources by trait under `prefix` ("start." at founding, "yield." each Year): [material or "gold", n]. */
export const econEach = (h: Blood, prefix: "start." | "yield."): [string, number][] =>
  Object.entries(houseEffects(h).economy)
    .filter(([k, n]) => k.startsWith(prefix) && n)
    .map(([k, n]) => [k.slice(prefix.length), n]);

/** `n` raised or lowered by `pct` %, rounded. */
export const byPct = (n: number, pct: number): number => Math.round((n * (100 + pct)) / 100);

export function houseEffects(h: Blood): HouseEffects {
  const fx: HouseEffects = { mods: {}, growth: {}, jobXp: {}, economy: {}, score: {}, innate: {}, tags: [], look: [] };
  const E = TUNING.houses.element;
  if (h.element) {
    add(fx.mods, { [`ward.${h.element}`]: E.aligned, [`ward.${opposite(h.element)}`]: -E.aligned, [`spellMp.${h.element}`]: -E.spellMpPct });
  } else add(fx.mods, { "resist.physical": E.unaligned, "resist.mental": E.unaligned });
  for (const id of h.traits) {
    const t = HOUSE_TRAIT_BY_ID.get(id);
    if (!t) continue;
    add(fx.mods, t.mods);
    const { all, ...each } = t.growth ?? {};
    add(fx.growth, each);
    if (all) for (const stat of STATS) if (stat !== "speed") fx.growth[stat] = (fx.growth[stat] ?? 0) + all;
    add(fx.jobXp, t.jobXp);
    add(fx.economy, t.economy);
    add(fx.score, t.score);
    add(fx.innate, t.innate);
    fx.tags.push(...(t.tags ?? []));
    fx.look.push(...(t.look ?? []));
    if (t.choice === "element" && h.bane) add(fx.mods, { [`ward.${h.bane}`]: -E.bane });
  }
  // The Seat's advantage and drawback (DECISIONS 8ah).
  const seat = h.seat ? SEAT_BY_ID.get(h.seat) : undefined;
  if (seat) {
    add(fx.mods, seat.mods);
    add(fx.economy, seat.economy);
  }
  return fx;
}
