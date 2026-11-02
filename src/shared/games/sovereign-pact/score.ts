// Ascendancy (§3.4): eight categories, an Ambition that doubles one and halves another, and the rough
// Standing tier other Houses see. Lineage, Treasury, Holdings and Relics are counted from what a House
// holds now; Valor, Lore, Renown and Intrigue are earned as they happen, into `house.score`.
import { NAMED_BY_ID, RARE_MATERIALS } from "./content.ts";
import { houseEffects } from "./houses.ts";
import { SCORE_CATEGORIES, type Score, type ScoreCategory, type SovState, type StandingTier } from "./state.ts";
import { TUNING } from "./tuning.ts";

const RARE = new Set(RARE_MATERIALS.map((m) => m.id));

/** A House's points per category before its Ambition: earned points plus what it holds now. */
export function categories(state: SovState, house: number): Score {
  const h = state.houses[house]!;
  const T = TUNING.scoring;
  const L = T.lineage;
  const mine = state.people.filter((p) => p.host === house && p.status !== "lost");
  const vault = h.buildings.vault ?? 0;
  const stores = Object.entries(h.stores).reduce((sum, [k, n]) => sum + (n ?? 0) * (RARE.has(k) ? T.rareGold : T.storeGold), 0);
  const owned = state.items.filter((i) => i.house === house);
  const held: Partial<Score> = {
    lineage: mine.reduce(
      (sum, p) =>
        sum +
        (p.status === "recruit" ? L.recruit : L.scion) +
        Math.floor(p.level / L.levelsPerPoint) +
        L.potential[p.potential] +
        (p.house !== house ? L.ward : 0),
      0,
    ),
    treasury: Math.floor((Math.max(0, h.gold - h.debt + stores) / T.goldPerPoint) * (1 + (vault ? TUNING.town.vaultTreasuryPct[vault - 1]! : 0) / 100)),
    holdings: Object.values(h.buildings).reduce<number>((sum, level) => sum + (level ?? 0) * TUNING.town.holdingsPerLevel, 0),
    relics: owned.reduce((sum, i) => sum + (i.tier === 5 ? T.relic : 0) + (i.named ? T.named : 0), 0),
  };
  // Artifacts score their own category for whoever holds them (§3.4, §9.10).
  for (const i of owned) {
    const a = i.named ? NAMED_BY_ID.get(i.named)?.artifact : undefined;
    if (a) held[a.category] = (held[a.category] ?? 0) + a.points;
  }
  // Old Blood of Kings, Silver Tongues, Craven Legacy: a House's traits move a category by % (§5.7).
  const pct = houseEffects(h).score;
  return Object.fromEntries(SCORE_CATEGORIES.map((c) => [c, Math.floor(((h.score[c] + (held[c] ?? 0)) * (100 + (pct[c] ?? 0))) / 100)])) as Score;
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
