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
    maxHp: { base: 20, might: 1, resilience: 3, level: 2 },
    maxMp: { base: 10, acuity: 2, sagacity: 2, level: 1 },
    /** Durability per location: base + coefficient × stat (§7.3), plus `durabilityPerLevel` × level (0 in the spec). */
    durabilityPerLevel: 0,
    durability: {
      head: { base: 10, stat: "acuity", per: 1.5 },
      body: { base: 15, stat: "resilience", per: 2 },
      arms: { base: 10, stat: "might", per: 1.5 },
      legs: { base: 10, stat: "guile", per: 1.5 },
    },
    evasion: { base: 5, guile: 1 },
    accuracy: { guile: 0.5 },
    resist: { physical: 1.5, mental: 1.5 },
    sanity: { base: 20, sagacity: 2, resilience: 0.5 },
  },

  /** §10–11 combat. */
  combat: {
    /** Each clock step every combatant gains CT equal to its Speed; durations count 10 ticks a step (§10.4, DECISIONS). */
    ticksPerStep: 10,
    turnAt: 100,
    cost: { action: 100, wait: 60, defend: 60 },
    /** §7.3: 20 CT a cell, −1 per 5 Guile, at least 10; up to 2 cells a turn (§10.4). */
    move: { perCell: 20, guilePer: 5, min: 10, maxCells: 2 },
    hitClamp: [5, 95] as const,
    crit: { base: 5, mult: 1.5, headBonus: 10 },
    /** Item property numbers (§13.4): Executioner's below 25% HP, Hungry's cap, Charged's first hit, a biased weapon on a weak point, Multi-hit's second strike. */
    props: { executeBelow: 0.25, hungryMax: 25, chargedMult: 2, biasWeakMult: 1.25, multiHitPower: 0.6 },
    /** Unaimed hits: Body 40 / Arms 25 / Legs 20 / Head 15 (§7.4). An enemy's locationBias takes this share. */
    locations: { body: 40, arms: 25, legs: 20, head: 15 },
    locationBias: 60,
    /** Column and status modifiers in % (§10.3, §10.6, §10.8). */
    frontMelee: 10,
    middleMelee: -10,
    bowFromFront: -10,
    blind: -30,
    chargingHitBonus: 20,
    chargingDamageTaken: 10,
    knockdownEvasion: -30,
    frozenEvasion: -20,
    protect: 30,
    shell: 30,
    defend: 50,
    marked: 20,
    /** Berserk and Enrage: physical / all damage +30% (§10.8). Frozen shatters for +50% on a crit. */
    berserk: 30,
    enrage: 30,
    frozenShatter: 50,
    /** Guard (shields): block chance % from gear, +25 with Guard Up; a block halves the hit (§10.6 step 6). */
    guardUp: 25,
    block: 50,
    /** Spells: accuracy 90 + 0.5 × Sagacity (no Evasion); damage reduced by the target's 0.5 × Sagacity % (§7.3). */
    spellAccuracy: { base: 90, sagacity: 0.5 },
    spellReduction: 0.5,
    acuityDivisor: 25,
    sagacityDivisor: 25,
    /** Enemy melee: Might-free damage = power × atk × (1 + 2L/25) (§14.2). */
    enemyLevelFactor: 2 / 25,
    mightDivisor: 25,
    tp: { max: 100, gainBase: 10, gainPer: 20 },
    /** §11.1: a step is 2 points; +1 step per 15 Resilience. */
    injury: { step: 2, resiliencePerStep: 15, hpZero: -1, broken: -1, telegraph: -1, defend: 1 },
    /** §7.4: after a roll, 2 × Resilience % (max 60) to refill the location to 25%. */
    steel: { perPoint: 2, cap: 60, refill: 25 },
    /** §10.9. */
    reviveHp: 20,
    getUpHp: 10,
    lastStand: { damage: 25, tp: 20 },
    /** Damage-over-time per 50 ticks, % of max HP (§10.8); Bleed also takes Durability. */
    pulse: 50,
    /** Per-100-tick regeneration from passives (Meditation, Wellspring). */
    regenEvery: 100,
    /** A Scion's spell power at 1.0× is the power block at level ÷ this (party level 3L fights expedition level L, §14.2). */
    spellLevelDivisor: 3,
    poison: 3,
    bleed: 2,
    bleedDurability: 2,
    burn: 3,
    regen: 3,
    /** Bosses take Readiness damage at half (§10.4). */
    bossReadiness: 0.5,
    /** Enemies' ailment resist: base + per level, % (enemies have no Resilience or Acuity). */
    enemyResist: { base: 5, perLevel: 3 },
  },

  /** §6.6 and §12.1: levels, XP and JP. XP per level is flat (FFT-like); a Scion on most expeditions reaches 20–30 by Year 20. */
  progression: {
    levelCap: 30,
    xpPerLevel: 100,
    /** XP and JP per battle won and per expedition finished (§6.6, §12.1: ~100 JP a battle, ~300 an expedition). */
    battleXp: 15,
    expeditionXp: 60,
    battleJp: 100,
    expeditionJp: 300,
    sortieJp: 25,
    /** Passive budget: 5 at level 1, +1 every 6 levels (10 at 30). */
    passiveBase: 5,
    passiveEvery: 6,
  },

  /** §13: item scaling. Weapon power = index/100 × the enemy power block at the item level; armor defense likewise from the defense block. */
  items: {
    /** Speed a Scion's gear may add: Quickening counts once (§13.4). */
    maxSpeedFromGear: 1,
    /** Crude −10%, Common, Fine +10%, Masterwork +20%, Relic +30% (§13.4). */
    tierMult: [0.9, 1, 1.1, 1.2, 1.3],
    /** Defense of a full set by class, × (1 + L + 0.08L²), shared out by slot. */
    armorDefense: { light: 0.5, medium: 1, heavy: 1.5 },
    slotShare: { head: 0.2, body: 0.4, arms: 0.2, legs: 0.2 },
    /** §13.3: Durability bonus to the slot's location, Evasion per slot, weight per slot. */
    armorDurabilityPct: { light: 10, medium: 25, heavy: 50 },
    armorEvasion: { light: 0, medium: -3, heavy: -6 },
    armorWeight: { light: 1, medium: 2, heavy: 3 },
    /** Weapon weight by hands (the spec gives shields only). */
    weaponWeight: [1, 2],
    /** §13.1: carry = 10 + Might/2; each point over costs Evasion −1% and movement +1 CT. */
    carry: { base: 10, mightDiv: 2 },
  },

  /** §14.2 enemy base block at expedition level L: a + b·L + c·L², then role and `stats` multipliers. */
  enemies: {
    hp: [30, 22, 0.5],
    power: [6, 3, 0.1],
    accuracy: [65, 5, 0],
    evasion: [8, 2, 0],
    defense: [0, 1, 0.08],
    speed: [9, 1 / 3, 0],
    roles: {
      fodder: { hp: 0.7, atk: 0.8, def: 0.8, eva: 1.0 },
      swarm: { hp: 0.35, atk: 0.6, def: 0.5, eva: 1.3 },
      bruiser: { hp: 1.6, atk: 1.2, def: 1.3, eva: 0.6 },
      caster: { hp: 0.8, atk: 1.3, def: 0.7, eva: 1.0 },
      support: { hp: 0.9, atk: 0.6, def: 1.0, eva: 1.0 },
      lurker: { hp: 0.8, atk: 1.3, def: 0.7, eva: 1.5 },
      artillery: { hp: 1.0, atk: 1.1, def: 0.9, eva: 0.8 },
      horror: { hp: 1.0, atk: 0.8, def: 1.0, eva: 1.1 },
      elite: { hp: 2.5, atk: 1.4, def: 1.4, eva: 1.0 },
      colossus: { hp: 6, atk: 1.5, def: 1.5, eva: 0.3 },
      boss: { hp: 15, atk: 1.6, def: 1.5, eva: 0.8 },
    },
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
