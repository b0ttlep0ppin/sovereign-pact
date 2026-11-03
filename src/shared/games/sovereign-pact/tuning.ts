// Every number the spec marks "first pass" or "tune" lives here, in one place, so the simulator and
// playtests can move them without touching the rules (CLAUDE.md; HANDOFF §2, §9). Each entry names the
// spec section it comes from. Values the spec leaves unset are implementation defaults, logged in
// docs/DECISIONS.md; change them freely.
import type { Material } from "./state.ts";

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
  /**
   * §6.9 [DECIDED model, numbers to tune]: Loyalty's start (Bad Blood givers, Hound-Loyal hosts), the
   * Years before a Ward may go home, Sworn and Estranged, the leak below 50 (Hound-Loyal cuts it by 20%),
   * and the Estranged's chance to slip home each Year.
   */
  wards: { start: 40, badBlood: 20, houndLoyal: 60, noReturnYears: 3, sworn: 80, estranged: 10, leakBelow: 50, leakPct: 25, houndLeakCut: 20, defectPct: 50 },

  /**
   * §9.1: cards a Year (2–3), the level band by Year of 20, the mandatory arc in order (§14.7: its
   * boss names the pool), and party sizes by weight (first pass: mostly 4, sometimes 8, rarely 2×4).
   */
  gate: {
    cards: [2, 3] as const,
    bands: [
      { until: 4, levels: [1, 3] },
      { until: 9, levels: [3, 5] },
      { until: 14, levels: [5, 7] },
      { until: 19, levels: [7, 9] },
      { until: 20, levels: [10, 10] },
    ],
    arc: [
      { boss: "siege_beast", level: 3 },
      { boss: "cursed_king", level: 6 },
      { boss: "unknown_mother", level: 8 },
      { boss: "end_ruler", level: 10 },
    ],
    sizes: [[4, 70], [8, 20], ["2x4", 10]] as const,
    /**
     * Forced expeditions (§3.2, first pass): each Year from Year 2 on, this % chance that a forcing event
     * is queued, hidden, for next Year; at most `max` a campaign, never for a Year before `fromYear` or a mandatory Year.
     */
    forced: { pct: 10, max: 2, fromYear: 3 },
    /** The bot reckons its Scions can take expedition level ⌊(average level + this) ÷ 3⌋ (gate.ts fairLevel). */
    botLevelSlack: 2,
    /** The first card of each offer is for 4, at the band's lowest level (tuning pass, 2026-11-02). */
    floorCard: true,
  },

  /** §9.2: Renown the Leader's House gains (first pass). */
  expedition: { leaderRenown: 2 },

  /**
   * §9.3 [DECIDED mix]: node weights, the mandatory +2; a Camp's rest (first pass); a boss within this
   * many levels of the card; Valor per battle and boss won, lost per House on a retreat; §9.9's Lost 50%.
   */
  /** Sorties (§6.11, first pass): their battles a level under the Year's band, injuries no worse than Moderate. */
  /** `botMin`: the bot sends no Sortie of fewer Scions than this (tuning pass). */
  sortie: { levelBelow: 1, injuryCap: "moderate" as const, botMin: 2 },
  /** Loot (§9.8, §9.10, first pass). Drop tables are per pool in content/pools.json. */
  loot: {
    /** Each hit on a drop table: a common material 1 + level/3, Essence 1 + level/4, a rare material 1. */
    qtyDiv: { common: 3, essence: 4 },
    /** A won Encounter: one roll on the table, and this % chance of an item. */
    encounterGearPct: 10,
    /** Found items: Common, or Fine at finePct + finePerLevel × level %. */
    finePct: 20,
    finePerLevel: 5,
    /** A Cache: 1–2 items, Fine or Masterwork at masterworkPerLevel × level %, two rolls on the table; trapped trapPct %. */
    cache: { items: [1, 2], rolls: 2, masterworkPerLevel: 5, trapPct: 16 },
    /** A boss: one Masterwork item per House present plus extraItems, three rolls on the table. */
    boss: { extraItems: 1, rolls: 3 },
    /** Found gear's chance of one bad property (§13.4). */
    negativePct: 20,
    /** A Fine-or-better find's chance to be one of the pool's named items, while any is left to find. */
    namedPct: 15,
    /** How the bot values a share: an item by tier (Crude…Relic); materials 1 each, Essence and rare ones more. */
    botWorth: { tier: [1, 3, 6, 12, 30], essence: 2, rare: 6 },
  },
  /** Changes (§9.6): an unfed Change loses this % of its Sanity ceiling at the Reckoning. */
  change: { hungerSanityPct: 25 },
  journey: {
    nodes: [["encounter", 40], ["event", 45], ["camp", 10], ["cache", 5]] as const,
    mandatoryExtra: 2,
    camp: { durabilityPct: 50, sanityPct: 10, hpPct: 35 },
    bossReach: 2,
    valor: { battle: 1, boss: 5, retreat: 3 },
    lostPct: 50,
    /** A Lost Scion not found within this many Years is dead (§9.9). */
    lostYears: 2,
    /** §9.3: an Event node draws from the card's own pools this often, else the general pool. */
    ownEventPct: 50,
    /** The bot Leader turns back when a Scion's Sanity falls below this, or when this % of the party is out or has this many broken locations. */
    botRetreatSanity: 15,
    botRetreatHurtPct: 50,
    botRetreatBroken: 2,
    /** A Scion under this % of their HP counts as badly hurt for the bot Leader. */
    botRetreatHp: 30,
  },

  /** §6.5 [PROPOSED numbers]: a promotion's Gold, ceremony slots a Year, and the Chapel's extra slot; the bot promotes while under its target of Scions. */
  promotion: { gold: 20, slots: 1, chapelSlots: 1, botScions: [8, 5, 4, 4] as ByHouses },

  /** §5.1 [PROPOSED]: how often a Random House takes a Bloodline. */
  founding: { bloodlinePct: 25, /** Volunteers in the opening draft beyond the picks, per House. */ musterExtra: 1, /** Q94 (Josh): the muster is a public showing, every volunteer read in full (Insight 3, §6.4) by every House. */ musterInsight: 3 },

  houses: {
    /** §5.6: an aligned House's people resist its element by this % and take it from the opposite; its spells cost this % less MP. Unaligned: + to every ailment resistance. Elemental Bane (§5.7): −% to the named element. */
    element: { aligned: 25, spellMpPct: 10, unaligned: 5, bane: 50 },
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

  /** §8.3–8.4, first pass: building costs, limits and what buildings give. */
  town: {
    /**
     * Cost by class and level (L1, L2, L3). §8.4's example is the standard row; producers are cheap and
     * the Vault, Shrine and Crypt expensive. Implementation defaults beside it.
     */
    costs: {
      cheap: [{ timber: 10, gold: 10 }, { timber: 20, stone: 10, gold: 25 }, { stone: 25, iron: 10, gold: 50 }],
      standard: [{ timber: 20, gold: 20 }, { timber: 30, stone: 20, gold: 40 }, { stone: 40, iron: 20, gold: 80 }],
      expensive: [{ timber: 30, stone: 10, gold: 40 }, { timber: 40, stone: 30, gold: 80 }, { stone: 60, iron: 30, essence: 10, gold: 150 }],
    } as Record<"cheap" | "standard" | "expensive", readonly Partial<Record<"gold" | Material, number>>[]>,
    /** Builds or upgrades a House may start in a Year (§8.3), and one more for each Scion overseeing works. */
    buildsPerYear: 1,
    /** Producer output per Year by level (§8.4). */
    produce: [8, 16, 24],
    /** The Mine at L3 yields a random rare material every this many Years. */
    mineRareEvery: 3,
    /** Shrine Essence per Year from L1. */
    shrineEssence: 2,
    /** Vault: Treasury score % by level; Gold interest % a Year from L2. */
    vaultTreasuryPct: [10, 20, 30],
    vaultInterestPct: 5,
    /** Holdings points per building level (§3.4, first pass). */
    holdingsPerLevel: 3,
    /** Implementation default: materials each House starts with, scaled like income, so Year 1 can build. */
    startStores: { timber: 30, stone: 10 },
  },

  /** §8.3 Year assignments, first pass: slots by building level, and what a Year of each gives. */
  assignments: {
    /** Chapel slots by level; Infirmary slots by level; Training Ground Mentor seats (2 students each). */
    chapelSlots: [2, 4, 6],
    infirmarySlots: [1, 2, 4],
    mentorSeats: [1, 2, 3],
    studentsPerSeat: 2,
    /** Guard slots per House; Study slots from Scriptorium L1 (University: unlimited, with shared projects). */
    guardSlots: 2,
    /**
     * Each Scion on Guard (§8.3, PROPOSED reading, DECISIONS 8bu) softens a town event's harm aimed at the
     * House by this %: losses of stores and gold and of Sanity shrink, and each building ruined or recruit
     * lost is averted at this % a guard. Harm that falls on every House alike is not stopped at the walls.
     */
    guardPct: 25,
    /** One Sortie a House a Year, up to 4 Scions not on the expedition (§6.11). */
    sortieSlots: 4,
    /** Oversee works (Josh 2026-11-03: "let people construct multiple buildings if they have a scion to oversee extras"): each Scion on it lets the House start one more build this Year. */
    overseeSlots: 3,
    studySlots: 1,
    /** Sanity recovered in a Year, % of max: idle, Rest; the Chapel building adds its own for all in town (§8.4). */
    idleSanityPct: 10,
    restSanityPct: 25,
    chapelBuildingSanityPct: 25,
    /** §6.6: "a normal expedition's XP" (the finish plus ~5 battles), and training's share of it. */
    expeditionXpRef: 150,
    mentorXpPct: 60,
    aloneXpPct: 30,
    /** Without a Mentor, training stops this many levels below the House's highest Scion; never past 20. */
    aloneBelow: 3,
    trainCap: 20,
    /** JP a Year: under a Mentor (in a Job the Mentor mastered), alone (current Job), Study (current Job). */
    mentorJp: 300,
    aloneJp: 150,
    studyJp: 150,
    /** Training Ground L2: students +50% JP. */
    tg2JpPct: 50,
    /** Output a worker adds to a producer (§8.3). */
    work: 4,
  },

  /** §8.5 shared projects, first pass. */
  commons: {
    /** A project costs about 1.3× a House building of the same tier (§8.5 PROPOSED). */
    costMult: 1.3,
    /** Renown per this many units (Gold or materials) pledged. */
    renownPer: 10,
    /** Great Market: Gold per House per Year. Granary: Grain upkeep −%. Cathedral: Sanity +% in town, Chapel slots +. */
    marketGold: 10,
    granaryUpkeepPct: 20,
    cathedralSanityPct: 25,
    cathedralChapelSlots: 2,
    /** University: JP per Year for every Scion in town, in their current Job. */
    universityJp: 100,
    /** Beacon and Hall of Petitions L1: recruit arrival +25% each. */
    arrivalBoostPct: 25,
    /** Court of Peers: Accord losses −25%; solo, the track +10 when it stands. */
    courtAccordPct: 25,
    courtUnrest: 10,
  },

  /** §8.8 town events [DECIDED cadence]: one settlement event a Year; each House's own event at this % chance. */
  /** `fresh`: Years a drawn town event is passed by (Josh's playtest: "settlement events repeat far too much"). */
  omens: { houseEventPct: 50, fresh: 10 },

  /**
   * A champion put forward in a town event (Josh 2026-11-03), first pass: passes at `base`% plus `perPoint`%
   * for each point of the stat (+ half the level) over the event's `dc`, never below `min` or above `max`.
   */
  champion: { base: 50, perPoint: 5, min: 10, max: 90 },

  /**
   * §14.9 Hunts, first pass. A Hunt card's quarry is `levelUp` levels above the fight with `hpPct`% HP;
   * Enrage starts it enraged for `enrageTicks`, Call the Pack adds `pack` to its kin, Ambush opens the
   * Lair with an ambush. Its trophy is in its content; the first kill of any enemy adds `lorePerEntry`
   * Lore to each House in the fight (a bestiary entry).
   */
  /**
   * §14.9 Arcana nodes, first pass: the chance a chain holds one, `bearerPct` when a Scion of a still-unmet
   * Arcana is in the party (that Arcana), else `basePct` (any unmet one). Never on a mandatory or forced card.
   * The great Arcana in `hunts` also carry a Hunt card of their own: a card of their boss's pool from
   * `huntLevel` becomes that Arcana's Hunt `huntPct`% of the time, with the Arcana as its boss.
   */
  arcana: { basePct: 6, bearerPct: 30, huntLevel: 8, huntPct: 35, hunts: ["tower", "death", "world"] as string[] },

  /**
   * §14.9 Idols, first pass: a Pilgrimage card from `minLevel` ends at one of its pool's unmet Idols `pct`%
   * of the time. Killing one pays each House in the party `valor` Valor and `renown` Renown (Piety, DECISIONS Q92).
   */
  idol: { minLevel: 6, pct: 60, valor: 10, renown: 6 },

  hunt: { levelUp: 1, hpPct: 150, enrageTicks: 600, pack: ["fodder", "fodder"] as const, lorePerEntry: 1 },

  /**
   * §14.7a Dark Bargains, first pass. A House is offered one at Omens `omenPct`% of Years from `fromYear`,
   * at most `omenMax` a campaign (halved odds for `wary` traits). An accepted bargain resolves on a hidden
   * roll: `promisedPct` as promised, `nothingPct` nothing, the rest twisted (a boon at `twistScale`, a bane
   * on the bargainer's own House); `dark` traits move `darkPct` from nothing to promised. `grudge` traits'
   * banes are scaled by `grudgeScale`. A Watchtower at L3 hears that some House struck one `watchPct`% of
   * the time. Each Pact mark costs `markPct`% of the kingdom's mean Ascendancy at the final score.
   */
  bargain: {
    omenPct: 8,
    fromYear: 2,
    omenMax: 2,
    promisedPct: 60,
    nothingPct: 25,
    twistScale: 0.5,
    dark: ["demon_blooded", "cursed_line", "old_blood_of_kings"] as readonly string[],
    darkPct: 15,
    wary: ["pious", "ink_and_seal"] as readonly string[],
    grudge: ["grudge_holders"] as readonly string[],
    grudgeScale: 1.5,
    watchPct: 25,
    markPct: 25,
  },

  /** §8.6 shops and §13.4a auctions, first pass. */
  shops: {
    /** Lots a shop stocks a Year, by its stock tier 1–3. */
    lots: [3, 4, 5],
    /** Quality odds (% Common, Fine, Masterwork, Relic) by stock tier. */
    quality: [
      [70, 30, 0, 0],
      [30, 55, 15, 0],
      [0, 50, 40, 10],
    ] as readonly (readonly number[])[],
    /** List price by item tier (Crude…Relic), × (1 + perLevel × (item level − 1)). */
    price: [10, 20, 45, 100, 220],
    perLevel: 0.2,
    /** The Curio Dealer's one random magic item a Year is at least Fine. */
    curioTier: 3,
    /** Properties that send any item to auction (§13.4a: Quickening, Multi-hit, Massive crits). */
    rareProps: ["quickening", "multi_hit", "massive_crits"] as readonly string[],
    /** Shops standing from Year 1 (Josh's playtest, 2026-11-02: "not enough chances to spend money"); the rest, and the Great Market's own Gold, are still Commons projects. */
    openAtStart: ["armorer", "weaponsmith", "apothecary"] as readonly string[],
    /** What the shops pay for a House's item, % of its list price; with a Fence built, more. */
    sellPct: 35,
    fenceSellPct: 50,
    /** A bot buys gear that betters what a Scion wears while it keeps this much Gold. */
    botReserve: 15,
  },

  /** §13.7 consumables, first pass: the most bought at once, and what a bot keeps at home (with Gold it never spends below). */
  consumables: {
    perBuy: 10,
    /** The party satchel's slots (§9.10). */
    satchel: 12,
    botKeeps: { tonic: 4, bone_salve: 2, antidote: 1, clarity_draught: 1, smelling_salts: 1, lantern: 1 } as Readonly<Record<string, number>>,
    botReserve: 40,
    /** When a bot Scion reaches into the satchel: an ally under this share of HP or of a location's Durability, its own MP under this share, or this many foes standing for a bomb (and for Oathwine), or undead and constructs for a dust. A bot House at a Camp opens Camp items for a Scion under `campBelow` of MP, Sanity or a location. */
    bots: { hpBelow: 0.35, durBelow: 0.3, mpBelow: 0.2, bombFoes: 3, dustFoes: 2, campBelow: 0.5 },
    /** Camp items (§13.7): Widow's Tea's Sanity and its Sleep, the Smuggler's Flask's Sanity cost (% of max); the die the Dice of the Marches rerolls at or under; what the Saint's Tooth turns a Mortal wound into. */
    uses: { teaSanityPct: 20, teaSleepTicks: 100, flaskSanityPct: 5, diceRerollAt: 5, toothResult: "arms_severed" },
    /** The blessing a Passive Draught gives until the Reckoning. */
    draughtTrait: "draught_strong",
  },

  /** §8.9 deals, first pass: score for a deal honored (Intrigue, each side) and for a public one (Renown, each side). */
  deals: { intrigue: 1, publicRenown: 1, maxOpen: 6 },

  /** §3.5 Crises [DECIDED resolution, numbers to tune]. */
  crises: {
    /** % of Years whose settlement event is a Crisis (§8.8 "about 40%"). */
    pct: 40,
    /** The hidden swing, ± this many points. */
    swing: 20,
    /** Result thresholds: Triumph, Holds, Falters; under the last, Calamity. */
    bands: { triumph: 100, holds: 75, falters: 50 },
    /** The Need grows with the campaign: × by Year band of a 20-Year campaign (early to 6, mid to 13, late). */
    needScale: { early: 1, mid: 1.5, late: 2 },
    /** Renown per this many units pledged. */
    renownPer: 10,
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
    /**
     * A bot that votes against the people at the table comes round to their choice at this %, +1 for each
     * point of Accord below 50, up to `botAgreeMax` (Josh 2026-11-03: "they want to survive as well").
     */
    botAgreePct: 60,
    botAgreeMax: 90,
    /** Renown for each House on a vote's winning side (§3.4 "votes won"), first pass. */
    voteWonRenown: 1,
  },

  /** §7.3 derived pools [DECIDED as first pass]: pool = base + Σ coefficient × stat (+ per level). */
  formulas: {
    maxHp: { base: 20, might: 1, resilience: 3, level: 2 },
    maxMp: { base: 10, acuity: 2, sagacity: 2, level: 1 },
    /** Durability per location: base + coefficient × stat (§7.3), plus `durabilityPerLevel` × level (0: Josh kept the spec, Q87). */
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
    cost: { action: 100, wait: 60, defend: 60, song: 35 },
    /** Pugilist combos (§12.2): +5 TP per repeat of a move, +10 CT per move beyond the third. */
    combo: { repeatTp: 5, extraCt: 10, freeMoves: 3 },
    /** Ravager and Sword Saint (§12.12–12.13): Hold Together's HP cap %, Iron Will's HP % threshold, Mirror Stance's TP per counter, One Cut's crit multiplier, Still Water's power %. */
    /** Dual wield (§13.2): the off-hand hit's power %, and with Dual Wield Mastery. */
    dualWield: { offPower: 50, mastery: 80 },
    /** Conjurer summons (§12.2): two bound at once (+1 with Legion), and their accuracy. */
    summons: { cap: 2, accuracy: 90 },
    jobs: { healCapPct: 50, lowHpBelow: 30, mirrorTp: 20, oneCutMult: 2, stillWaterPct: 20, graftTicks: 200, hybridTicks: 100 },
    /** The Magus (§12.8): Elemental Mastery's MP cut, %. */
    magus: { masteryMpPct: 10 },
    /** The Minstrel (§12.11): Crescendo swells a layer +50% once it has played 300 ticks. */
    minstrel: { crescendoTicks: 300, crescendoPct: 50 },
    /** The Tinkerer (§12.16): Jury-Rig's three Components make one of these, at random. */
    tinkerer: { rigParts: 3, rigItems: ["ether", "mana_crystal", "oil_of_haste", "firebomb", "frost_flask", "shock_jar", "scroll_of_firestorm", "scroll_of_glacier", "scroll_of_tempest", "scroll_of_mending_rain", "mirror_shard", "ember_oil", "brine", "stormwax"] as readonly string[] },
    /** The Knight's passives (§12.4): Commanding Presence lends Sagacity/5 % accuracy, Shieldbearer adds Resilience/4 % guard, Bodyguard shifts 30% of single-target weight. */
    knight: { presenceDiv: 5, shieldbearerDiv: 4, bodyguardPct: 30 },
    /** The Soldier's passives (§12.5): Grizzled's step per 20 Might on the body's injury tables. */
    soldier: { grizzledPer: 20 },
    /** The Vagabond (§12.6): Vanish's Backstab +50%, Knife Flurry's chance Guile/4 %. */
    vagabond: { vanishPct: 50, flurryDiv: 4 },
    /** The Soothsayer (§12.9): Ancestor's Shield's steps, Lifeline's chance, Calming Presence's Sanity cut. */
    soothsayer: { shieldSteps: 2, lifelinePct: 25, calmPct: 20 },
    /** The Gambler (§12.7): Fortune Favors' chance that an event takes the outcome best for the Scion. */
    gambler: { fortunePct: 10 },
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
    /**
     * Scion melee leniency (DECISIONS 8am): how many rows above and below their own it reaches (7 = every
     * row: any foe nothing stands in front of), and whether, with none in reach, it reaches the nearest rows that hold one.
     */
    scionMelee: { rowReach: 7, nearestIfNone: true },
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
    /** Enemy melee: Might-free damage = power × atk × (1 + factor × L) (§14.2 has 2/25; 0.015 from the M3 tuning passes). */
    enemyLevelFactor: 0.015,
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
    /** Cast Lots and Double Down (§12.2, §12.7): a 2 adds CT to the next action; 3–4 and 9 move TP; 6 and 10 are until-next-turn bonuses; 7 and 8 restore %. A Double Down fizzles when the new roll is this much lower. */
    dice: { snakeEyesCt: 25, tp: 10, evasion: 10, accuracy: 10, restorePct: 5, fizzleMargin: 4, maxDoubleDown: 3 },
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
    /**
     * XP and JP per battle won and per expedition finished (§6.6, §12.1). Josh 2026-11-03: "maybe like 250 JP
     * 150 xp for such an early mission … 1 mission getting 4 levels is too much", so a five-battle
     * expedition pays 150 XP (a level and a half) and 250 JP.
     */
    battleXp: 20,
    expeditionXp: 50,
    battleJp: 40,
    expeditionJp: 50,
    /** Battle and expedition XP +this % per level a Scion stands below the highest level that marched with them, up to `catchUpLevels` levels (progression.ts xpAt). */
    catchUpPct: 50,
    catchUpLevels: 3,
    /** JP a new Scion starts with in their first Job, enough for a first ability or two (tuning pass, 2026-11-02). */
    startJp: 150,
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
    /** Role multipliers (§14.2), as retuned in the Milestone 3 tuning pass (atk about −10%, elites 2.5/1.4 → 2.2/1.2). */
    roles: {
      fodder: { hp: 0.7, atk: 0.7, def: 0.8, eva: 1.0 },
      swarm: { hp: 0.35, atk: 0.55, def: 0.5, eva: 1.3 },
      bruiser: { hp: 1.6, atk: 1.1, def: 1.3, eva: 0.6 },
      caster: { hp: 0.8, atk: 1.15, def: 0.7, eva: 1.0 },
      support: { hp: 0.9, atk: 0.55, def: 1.0, eva: 1.0 },
      lurker: { hp: 0.8, atk: 1.15, def: 0.7, eva: 1.5 },
      artillery: { hp: 1.0, atk: 1.0, def: 0.9, eva: 0.8 },
      horror: { hp: 1.0, atk: 0.7, def: 1.0, eva: 1.1 },
      elite: { hp: 2.2, atk: 1.2, def: 1.4, eva: 1.0 },
      colossus: { hp: 6, atk: 1.5, def: 1.5, eva: 0.3 },
      boss: { hp: 15, atk: 1.6, def: 1.5, eva: 0.8 },
    },
    /**
     * Tuning pass (2026-11-02): enemy HP and damage × this at expedition levels 1, 2, 3… (1 beyond the
     * list). Starting Scions are level 1 with Crude gear, where the 3L reference expects level 3 at L1,
     * and bot campaigns put the best Scions near 2.5L, not 3L, at the mandatory Years. Raised 2026-11-02
     * (8ar), after HP began to carry between battles: Josh wants the game hard, so that bots with no
     * tactics nearly always lose (6 bot campaigns: 0 won, 4 of 17 mandatory expeditions won).
     */
    soften: [0.7, 0.75, 0.8, 0.85, 0.9, 0.95] as readonly number[],
    /**
     * Enemy damage × this at levels 1, 2, 3… (1 beyond the list), in place of `soften`, which now
     * thins only their HP. Josh 2026-11-02: enemies were "not threatening enough": a party lost 12–20%
     * of its HP a battle at L2–4.
     */
    softenAtk: [0.95, 1, 1, 1, 1, 1] as readonly number[],
    /** Every enemy's damage × this (Josh 2026-11-02, "not threatening enough"). */
    atkMult: 1.15,
    /** §14.1 Parts, first pass: the share of a blow on a Part the body also takes, and the stagger when one breaks. */
    parts: { bodySharePct: 50, stagger: 50 },
    /** §14.6: everyone starts a boss fight at CT 30. */
    bosses: { ct: 30 },
  },

  /**
   * §14.4 encounters, first pass: the base Ambush and Surprise odds (events, traits and the Stalkers
   * template move them), and the starting CT each side takes. Lurkers in an Ambush get a free first turn.
   */
  encounters: {
    ambushPct: 10,
    surprisePct: 10,
    ct: { ambushed: 0, ambusher: 50, lurkerAmbush: 100 },
    /** §14.10, first pass: the chance an enemy wears one of its variants, and Unknown-touched from Year 10. */
    variants: { pct: 20, unknownPct: 30 },
    /** §14.8: hazards' blows find their mark (accuracy bonus). */
    hazards: { accuracy: 100 },
    /** A pool short of a role at a level fills it from the next role here (until every pool's roster is full). */
    stand: {
      swarm: ["fodder"],
      support: ["caster", "fodder"],
      horror: ["caster", "lurker", "fodder"],
      artillery: ["caster", "fodder"],
      caster: ["artillery", "fodder"],
      lurker: ["fodder"],
      elite: ["bruiser", "fodder"],
      colossus: ["elite", "bruiser"],
      bruiser: ["fodder"],
      fodder: ["bruiser", "swarm"],
    } as Record<string, readonly string[]>,
  },

  /** §6.3 recruit generation. */
  recruits: {
    /** §6.7: how many individual traits a recruit rolls (1–3, chance in % each), and the weight × for a trait of the House's element (§5.6). */
    traits: { count: [50, 35, 15], alignedWeight: 2 },
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
    age: [16, 40] as const,
  },

  /**
   * §3.4 what a House holds, first pass (the earned categories live in `house.score`): Lineage per
   * living person, a point per few levels, by potential and per Ward hosted; Treasury a point per 10
   * Gold of wealth (stores at a Gold a unit, rare materials at 10); Relics per Relic-tier or named item.
   */
  scoring: {
    lineage: { scion: 2, recruit: 1, levelsPerPoint: 5, ward: 2, potential: { common: 0, promising: 1, gifted: 2, prodigy: 4 } },
    goldPerPoint: 10,
    storeGold: 1,
    rareGold: 10,
    relic: 10,
    named: 5,
  },

  /**
   * §3.3 Devastation, PROPOSED: a failed mandatory expedition ruins 1–3 building levels across the
   * settlement, takes a share of every store, cancels the next arrivals, costs Accord and adds Doom; a
   * failed forced expedition ruins one and costs less (§3.2). Each level of Walls ruins one fewer and
   * takes 5 off the Doom.
   */
  /**
   * §14.7 the mandatory arc's stakes (first pass). Year 5 won: the Bastion of the Gate may be built, and
   * then every Scion starts each battle of the final expedition behind a shield of `bastionShieldPct`% of
   * their HP, and the party may fall back from one lost battle. Year 10 lost: the Court's knights raid
   * every expedition after (one more Encounter, from `raidPool`). Year 15: lost, the Devastation's Doom
   * is `nestFailDoom` and Unknown fodder joins every pool's fights; won, Doom falls by `nestWinDoom`.
   * The final Year's chain ends with `reflectionEvent` (The Gate's Reflection) just before the boss.
   */
  arc: { bastionShieldPct: 20, raidPool: "apostate_court", nestFailDoom: 40, nestWinDoom: 20, reflectionEvent: "gates_reflection" },

  devastation: {
    mandatory: { ruin: [1, 3] as const, storesPct: 25, accord: 20, doom: 25, noArrivals: true },
    forced: { ruin: [1, 1] as const, storesPct: 0, accord: 10, doom: 10, noArrivals: false },
    wallsDoom: 5,
  },

  /** §3.4 Standing tiers: a House's Ascendancy over the kingdom's mean. PROPOSED, see DECISIONS Q85. */
  standing: { steady: 0.75, rising: 1.0, ascendant: 1.25 },

  /**
   * Simulator parties (combat/roster.ts): JP a Scion has earned by each level (~2 expeditions a level at
   * ~100 a battle and ~300 an expedition, §12.1), the least an advanced Job starts with, and the item
   * tier by Scion level (Common, Fine from 6, Masterwork from 15).
   */
  sim: { jpPerLevel: 300, jpFloor: 100, tiers: [[1, 2], [6, 3], [15, 4]] as readonly (readonly [number, number])[] },

  /** The public log kept in state for the host to show; older lines are dropped. */
  logLines: 40,
} as const;

/** The House-count row of a {@link ByHouses} table. */
export const forHouses = (table: ByHouses, houses: number): number => table[Math.min(Math.max(houses, 1), 4) - 1]!;
