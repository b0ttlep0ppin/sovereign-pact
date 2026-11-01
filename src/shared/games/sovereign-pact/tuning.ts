// Every number the spec marks "first pass" or "tune" lives here, in one place, so the simulator and
// playtests can move them without touching the rules (CLAUDE.md; HANDOFF §2, §9). Each entry names the
// spec section it comes from. Values the spec leaves unset are implementation defaults, logged in
// docs/DECISIONS.md; change them freely.

/** Indexed by House count H − 1 (H = 1…4). */
type ByHouses = readonly [number, number, number, number];

export const TUNING = {
  campaign: {
    /** §3.1: a full campaign is 20 Years; the Short campaign is 10. */
    years: { full: 20, short: 10 },
    /** §3.2, §14.7: the Years of the mandatory arc. Short campaign Years: implementation default. */
    mandatoryYears: { full: [5, 10, 15, 20], short: [3, 5, 8, 10] },
  },

  /** §6.2 [DECIDED as a starting point]. */
  houses: {
    startScions: [6, 3, 2, 2] as ByHouses,
    startRecruits: [9, 6, 5, 5] as ByHouses,
    /** % chance of a new recruit per House per Year. */
    arrivalChance: [100, 70, 55, 50] as ByHouses,
    recruitPoolCap: 8,
  },

  /** §8.1. */
  economy: {
    /** Base income per House per Year, before the House-count scale. */
    income: { gold: 30, grain: 10 },
    /** §4.3 "scaled by H so the kingdom's total is similar": multiplier per House. Implementation default. */
    incomeScale: [2, 1.4, 1.1, 1] as ByHouses,
    /** §8.1 [DECIDED]: the Commons' tithe on income and expedition materials. */
    tithe: 0.1,
    /** §6.2: upkeep per Year. Retired pay half (rounded up). Implementation default. */
    upkeep: { scionGold: 4, scionGrain: 1, recruitGrain: 1 },
  },

  /** §3.3. */
  tracks: {
    /** Starting Accord (H ≥ 2) or Unrest (H = 1). Implementation default. */
    accordStart: 60,
    doomStart: 0,
    /** Doom +2 each Year [DECIDED, numbers to tune]. */
    doomPerYear: 2,
    /** Every vote's tie costs this much Accord [DECIDED]. */
    tieCost: 3,
  },

  /** §7.3 derived pools [DECIDED as first pass]: pool = base + Σ coefficient × stat (+ per level). */
  formulas: {
    maxMp: { base: 10, acuity: 2, sagacity: 2, level: 1 },
    sanity: { base: 20, sagacity: 2, resilience: 0.5 },
  },

  /** §6.3 recruit generation. */
  recruits: {
    /** Base stats roll in this range before House modifiers. */
    baseRoll: [8, 12] as const,
    /** Speed is "mostly static, baseline 10" (§7.1). */
    speedBase: 10,
    /** Potential tiers: chance in % and growth range in hundredths per level (§7.2: 0.4–1.6). */
    potential: {
      common: { chance: 60, growth: [40, 90] },
      promising: { chance: 30, growth: [60, 115] },
      gifted: { chance: 9, growth: [80, 140] },
      prodigy: { chance: 1, growth: [100, 160] },
    },
    /** Individual traits rolled at generation (§6.3: 1–3). */
    traits: [1, 3] as const,
    age: [16, 40] as const,
  },

  /** §3.4 Standing tiers: a House's Ascendancy over the kingdom's mean. PROPOSED, see DECISIONS Q85. */
  standing: { steady: 0.75, rising: 1.0, ascendant: 1.25 },

  /** The public log kept in state for the host to show; older lines are dropped. */
  logLines: 40,
} as const;

/** The House-count row of a {@link ByHouses} table. */
export const forHouses = (table: ByHouses, houses: number): number => table[Math.min(Math.max(houses, 1), 4) - 1]!;
