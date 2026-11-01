// Ascendancy (§3.4): eight categories, an Ambition that doubles one and halves another, and the rough
// Standing tier other Houses see. Milestone 4 fills in what earns each category; for now the
// state-based ones are counted from what a House holds and the rest come from `house.score`.
import { SCORE_CATEGORIES, type Score, type ScoreCategory, type SovState, type StandingTier } from "./state.ts";
import { TUNING } from "./tuning.ts";

/** A House's points per category before its Ambition: earned points plus what it holds now. */
export function categories(state: SovState, house: number): Score {
  const h = state.houses[house]!;
  const mine = state.people.filter((p) => p.host === house && p.status !== "lost");
  const vault = h.buildings.vault ?? 0;
  const held: Partial<Score> = {
    // First pass, Milestone 4 replaces these: Lineage counts the living, Treasury the Gold held,
    // Holdings the building levels.
    lineage: mine.filter((p) => p.status !== "recruit").length * 2 + mine.filter((p) => p.status === "recruit").length,
    treasury: Math.floor((Math.max(0, h.gold - h.debt) / 10) * (1 + (vault ? TUNING.town.vaultTreasuryPct[vault - 1]! : 0) / 100)),
    holdings: Object.values(h.buildings).reduce<number>((sum, level) => sum + (level ?? 0) * TUNING.town.holdingsPerLevel, 0),
  };
  return Object.fromEntries(SCORE_CATEGORIES.map((c) => [c, h.score[c] + (held[c] ?? 0)])) as Score;
}

/** The multiplier a House's Ambition puts on a category. */
export function ambitionFactor(state: SovState, house: number, category: ScoreCategory): number {
  const { ambition } = state.houses[house]!;
  if (ambition.double === category) return 2;
  if (ambition.halve === category) return 0.5;
  return 1;
}

/** A House's exact total: visible only to that House. */
export function ascendancy(state: SovState, house: number): number {
  const score = categories(state, house);
  return Math.floor(SCORE_CATEGORIES.reduce((sum, c) => sum + score[c] * ambitionFactor(state, house, c), 0));
}

/**
 * The tier everyone sees for a House: its Ascendancy against the kingdom's mean (DECISIONS Q85,
 * PROPOSED). Solo, or while every House is at 0, a House is Steady.
 */
export function standing(state: SovState, house: number): StandingTier {
  const totals = state.houses.map((_, i) => ascendancy(state, i));
  const mean = totals.reduce((a, b) => a + b, 0) / totals.length;
  if (state.houses.length < 2 || mean <= 0) return "steady";
  const ratio = totals[house]! / mean;
  const t = TUNING.standing;
  if (ratio >= t.ascendant) return "ascendant";
  if (ratio >= t.rising) return "rising";
  if (ratio >= t.steady) return "steady";
  return "waning";
}

/** Final placements: the Sovereign (highest Ascendancy) is 1, ties share a place. */
export function placements(state: SovState): number[] {
  const totals = state.houses.map((_, i) => ascendancy(state, i));
  return totals.map((t) => 1 + totals.filter((other) => other > t).length);
}
