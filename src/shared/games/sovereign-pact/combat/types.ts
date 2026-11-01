// A battle's state (SPEC §10): plain JSON like the campaign, so a battle can sit inside the campaign
// state, be replayed from its seed and be shown per seat. Coordinates: each side has 3 columns × 8
// rows; column 0 is nearest the gap (the party's Front, the enemy's E1), column 2 the farthest (Back, E3).
import type { Element, Location } from "../state.ts";

export type Side = "party" | "enemy";
export const COLS = 3;
export const ROWS = 8;

export interface Cell {
  side: Side;
  col: number;
  row: number;
}

export type StatusKind = "physical" | "mental" | "buff" | "debuff";

/** A status on a combatant (§10.8). `ticks` left; 0 means until the battle ends or its own rule ends it. */
export interface StatusInst {
  id: string;
  ticks: number;
  /** Strength where the status has one (a Shield's points, a Burn's damage…). */
  value?: number;
  /** Bleed: the bleeding location. */
  loc?: Location;
  /** Who put it on (a Minstrel's song ends with the Minstrel). */
  src?: number;
  /** Mods it adds to the combatant while it lasts. */
  mods?: Record<string, number>;
}

export type SongLayer = "melody" | "harmony" | "chorus";

export type Reach = "melee" | "reach" | "ranged";

export interface Weapon {
  kind: string;
  power: number;
  acc: number;
  crit: number;
  reach: Reach;
  hands: 1 | 2;
  element?: Element;
  /** A status every crit tries to inflict (axes Bleed, maces Stun, §13.2). */
  critStatus?: string;
  /** % of the target's armor it ignores (maces 25). */
  armorPierce?: number;
  /** Extra TP per hit (knives). */
  tpGain?: number;
  /** CT of a basic attack (crossbows 120). */
  attackCost?: number;
  /** Locations its aimed shots favor. */
  aims?: Location[];
}

/** What an ability does when it lands; Scion Jobs (Milestone 2) and enemies (Milestone 3) share it. */
export interface AbilityDef {
  id: string;
  name?: string;
  /** A lurker's leap (§14.3): reaches any standing foe, then the user stands Exposed among them. */
  leap?: boolean;
  /** Raises a fallen fodder or swarm ally at this % of its max HP (the Dark Necromancer, §14.5). */
  raise?: number;
  /** A shape from §10.2: single, row, column[:F|M|B], band:n, lob, line:n, cross, burst:3x3, burst:5x5, checker:a|b, front_each_row, nearest:n, random:n, all, self, adjacent, ring. */
  shape: string;
  /** Whose side it lands on, from the user's point of view. */
  side: "foe" | "ally" | "self";
  /** Multiplier on the user's power (the weapon's, or `base` for spells); 0: no damage. */
  power: number;
  /** A spell's own power; weapon abilities and enemies use their weapon's. */
  base?: number;
  /** "physical" uses Might (or the enemy's atk), "magic" Acuity and the target's Sagacity, "heal" Sagacity; "support" never misses and deals nothing, only its effects. */
  kind?: "physical" | "magic" | "heal" | "support";
  element?: Element | null;
  /** Melee abilities follow the reach rules (§10.3); ranged and magic reach any column. */
  reach?: Reach;
  /** An enemy's preferred location: 60% of hits go there (§14.1). */
  locationBias?: Location;
  /** A Scion's aimed location: every hit goes there (§7.4). */
  aim?: Location;
  /** CT the action costs (100 unless said). */
  cost?: number;
  mp?: number;
  tp?: number;
  /** Charge time in ticks before Acuity (§7.3); 0 or missing: instant. */
  charge?: number;
  /** Shown to the other side while it charges (§10.7). */
  telegraph?: boolean;
  /** Most single-target spells follow their target; big AoEs land where they were aimed (§10.5). */
  homing?: boolean;
  /** Turns between uses. */
  cooldown?: number;
  /** Sanity damage per target hit. */
  sanity?: number;
  /** Statuses it may inflict: chance %, before the target's resist. */
  statuses?: { id: string; chance: number; ticks: number; value?: number; tag?: string; mods?: Record<string, number> }[];
  /** Readiness damage (CT taken from each target). */
  readiness?: number;
  /** Hits per target. */
  hits?: number;
  accuracy?: number;
  /** Extra crit chance in %. */
  crit?: number;
  /** Weapon types (or "shield") the user must hold (Shield Bash, Pin, Volley). */
  requires?: string[];
  /** Hits per target rolled from `hits` to this. */
  hitsMax?: number;
  /** Damage multiplier against foes with a tag (Judgement vs undead). */
  vs?: Record<string, number>;
  /** Against a target below `below`% HP: damage +`pct`%, or (`kills`) the blow is fatal to all but bosses. */
  execute?: { below: number; pct?: number; kills?: boolean };
  /** Multiplier on power instead when an ally is Down (Oathbound Strike) or the target Marked (Backstab). */
  powerIfAllyDown?: number;
  powerIfMarked?: number;
  /** TP back to the user when the blow kills. */
  refundTp?: number;
  /** Statuses removed from each target (Guard Break). */
  dispel?: string[];
  /** Restores on each target: % of max HP, % of Durability at one random, the lowest, or every location. */
  restore?: { hpPct?: number; durPct?: number; loc?: "random" | "lowest" | "all" };
  /** Ailments cured on each target: status ids, or "physical" / "mental" for every one of that kind. */
  cure?: string[];
  /** Sanity restored, % of max, and TP given, to each target. */
  sanityPct?: number;
  tpGrant?: number;
  /** Raises a Down target at this % of HP. */
  revive?: number;
  /** Gives each target a one-use flag (Mulligan: "mulligan"; House Rules: "lots_floor7"). */
  flag?: string;
  /** The Gambler's 2d6 (§12.7): power = total × scale %, or HP restored = total × restorePct %; or at `high`+ power becomes highPower, at `low` or under lowPower (or it hits the user), otherwise `otherwise`. */
  dice?: { scale?: number; restorePct?: number; high?: number; highPower?: number; low?: number; lowPower?: number; lowHitsSelf?: boolean; otherwise?: number; doubleDown?: boolean };
  /** A Pugilist move (§12.2): its tag, and for a finisher the pattern the moves before it must make. */
  move?: { tag: string; finisher?: string };
  /** TP back to the user per hit (Jab). */
  tpOnHit?: number;
  /** Damage +% against multi-cell foes (Spine Breaker). */
  bigPct?: number;
  /** Power is shared among every target hit (Hundred Fists). */
  split?: boolean;
  /** A Minstrel's song (§12.2): its layer and what every hearer gets while it plays. */
  song?: { layer: SongLayer; mods: Record<string, number> };
  /** % of max HP paid instead of TP (Blood Price). */
  hpCost?: number;
  /** % of the damage dealt that returns to the user as HP (Drink Deep). */
  drain?: number;
  /** Always a crit against a Marked target (Executioner). */
  critIfMarked?: boolean;
  /** Crit chance + on the user's first turn of the battle (Draw Cut). */
  critFirstTurn?: number;
  /** A Shield of this % of each target's max HP (Barrier, Bulwark). */
  shieldPct?: number;
  /** Buffs removed from each target, most recent first (Dispel: all, Purge: one). */
  dispelBuffs?: number;
  /** Tinkerer Components it uses up (§12.2). */
  parts?: string[];
  /** Uses a held Lens, if any, to never miss (Bolt). */
  lens?: boolean;
  /** Columns each target is pulled toward the gap (Grapple Line). */
  pull?: number;
  /** CT given to each target (Overclock). */
  ctGrant?: number;
  /** HP restored to a construct target, % of its max (Repair). */
  constructHpPct?: number;
  /** Tops a Shield up to its size instead of adding to it (the Shield Drone). */
  shieldRefill?: boolean;
  /** Shifts into a Form from forms.json, ends the Form, or gives an ally its passive (§12.17). */
  form?: string;
  revert?: boolean;
  graft?: boolean;
  /** Calls a summon from summons.json (§12.15). */
  summon?: string;
  /** Dismisses one of the user's summons; allies around it heal this % of max HP (Sacrifice). */
  sacrifice?: number;
  /** Removes an enemy summon or add outright (Banish). */
  banish?: boolean;
  /** Cancels the target's charge in progress, a boss's too (Zenith Strike). */
  breaksCharge?: boolean;
  /** On the user after it resolves: TP, statuses, and mods (`turn.*` ones end at its next turn). */
  self?: { tp?: number; statuses?: { id: string; ticks: number; value?: number; mods?: Record<string, number> }[]; mods?: Record<string, number> };
}

export interface Charge {
  ability: AbilityDef;
  target: Cell;
  /** Whom it follows if homing. */
  homingOn?: number;
  /** Ticks until it resolves. */
  ticks: number;
}

export interface GambitRule {
  /** A condition from gambits.ts, or "always". */
  if?: string;
  /** An ability id, or "attack", "defend", "wait". */
  do: string;
  target?: string;
}

export interface Combatant {
  id: number;
  side: Side;
  name: string;
  /** The Person this is (Scions), and their House (for Oathbound). */
  person?: number;
  house?: number;
  /** A summon: who called it, its content id, the call it came with (Carrion Crows come two to a call), and the tick it leaves at. */
  owner?: number;
  summon?: string;
  binding?: number;
  expires?: number;
  /** What it does as it dies (the Ember Imp bursts). */
  onDeath?: AbilityDef;
  /** The enemy content id (enemies). */
  enemy?: string;
  role?: string;
  tags: string[];
  boss?: boolean;
  /** Top-left cell (lowest col, lowest row) and size in columns × rows. */
  col: number;
  row: number;
  size: [number, number];
  level: number;
  might: number;
  resilience: number;
  guile: number;
  acuity: number;
  sagacity: number;
  speed: number;
  maxHp: number;
  hp: number;
  maxMp: number;
  mp: number;
  tp: number;
  maxSanity: number;
  sanity: number;
  /** Evasion % and the accuracy added to a weapon's (§7.3). */
  evasion: number;
  accuracy: number;
  /** Flat physical defense (armor). */
  defense: number;
  /** Physical damage power before Might: a Scion's weapon, an enemy's level block × atk. */
  weapon: Weapon;
  /** What the off hand holds ("shield", a weapon type), for abilities that need it. */
  offhand?: string;
  /** A second one-hand weapon: the basic Attack strikes with it too (§13.2). */
  offWeapon?: Weapon;
  /** Enemies: damage = power × (1 + 2L/25) instead of Might (§14.2). */
  enemyScale?: number;
  /** Locations' Durability (Scions only; enemies have no hit locations, §14.1). */
  dur?: Record<Location, number>;
  maxDur?: Record<Location, number>;
  broken: Location[];
  /** At 0 Sanity every further Sanity hit forces another roll (§7.4). */
  sanityBroken?: boolean;
  affinity: Partial<Record<Element, number>>;
  /** Physical and mental ailment resist % (§7.3). */
  resist: { physical: number; mental: number };
  immune: string[];
  weak?: { location: Location; mult: number };
  sanityTouch: number;
  guard: number;
  counter: number;
  /** Injury roll steps from Resilience and traits (§11.1). */
  steps: number;
  abilities: AbilityDef[];
  gambits: GambitRule[];
  cooldowns: Record<string, number>;
  /** CT, 0–100+. */
  ct: number;
  statuses: StatusInst[];
  charge?: Charge;
  /** An Alterer's Form: what it replaced, and the tick it ends at (§12.2). */
  form?: { id: string; ends: number; abilities: AbilityDef[]; size: [number, number]; maxHp: number; guard: number };
  /** A feral Form's pick for this turn: the only ability the Alterer may use. */
  feral?: string;
  /** A Tinkerer's Components: held, and offered this turn (§12.2). */
  parts?: string[];
  offer?: string[];
  /** The songs a Minstrel is playing, by layer. */
  songs?: Partial<Record<SongLayer, string>>;
  defending?: boolean;
  down: boolean;
  dead: boolean;
  lastStand?: boolean;
  catatonic?: boolean;
  /** Battle-long modifiers from injury results and lasting injuries (content `mods`). */
  mods: Record<string, number>;
  flags: string[];
  turns: number;
  kills: number;
  /** Injury results rolled this battle, by content id. */
  injuries: string[];
}

export type BattleEvent =
  | { t: "turn"; unit: number; tick: number }
  | { t: "move"; unit: number; col: number; row: number }
  | { t: "use"; unit: number; ability: string; target: Cell }
  | { t: "charge"; unit: number; ability: string; target: Cell; ticks: number; telegraph: boolean }
  | { t: "cancel"; unit: number; ability: string }
  | { t: "miss"; unit: number; target: number }
  | { t: "hit"; unit: number; target: number; damage: number; loc?: Location; crit?: boolean; weak?: boolean; element?: Element }
  | { t: "heal"; unit: number; target: number; amount: number }
  | { t: "sanity"; target: number; amount: number }
  | { t: "status"; target: number; status: string; on: boolean }
  | { t: "injury"; target: number; table: string; roll: number; total: number; result: string }
  | { t: "steeled"; target: number; loc: Location | "sanity" }
  | { t: "down"; target: number }
  | { t: "lots" | "fizzle"; unit: number; total: number }
  | { t: "reflect" | "counterspell"; unit: number; target: number }
  | { t: "summon"; unit: number; summon: string; ids: number[] }
  | { t: "vanish"; unit: number }
  | { t: "raise"; unit: number; target: number }
  | { t: "shift"; unit: number; form: string | null }
  | { t: "dead"; target: number }
  | { t: "wait" | "defend"; unit: number }
  | { t: "end"; outcome: BattleOutcome };

export type BattleOutcome = "victory" | "defeat" | "retreat";

export interface Battle {
  /** The battle's own RNG state. */
  rng: number;
  /** Ticks since the battle began (§10.4); a clock step is 10 ticks (see clock.ts). */
  tick: number;
  units: Combatant[];
  /** Whose turn it is, waiting for an action; null between turns. */
  actor: number | null;
  moved: boolean;
  acted: boolean;
  events: BattleEvent[];
  outcome?: BattleOutcome;
  /** Battle-start effects have run (Familiar). */
  begun?: boolean;
}
