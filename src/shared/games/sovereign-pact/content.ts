// The content catalog: everything under content/ as typed data. Rules read content only through here,
// by id, so Josh can edit the JSON (validated by schemas/ in CI) without touching rules (CLAUDE.md).
import knightSet from "./content/abilities/knight.json" with { type: "json" };
import magusSet from "./content/abilities/magus.json" with { type: "json" };
import soldierSet from "./content/abilities/soldier.json" with { type: "json" };
import soothsayerSet from "./content/abilities/soothsayer.json" with { type: "json" };
import vagabondSet from "./content/abilities/vagabond.json" with { type: "json" };
import banshee from "./content/enemies/barrows/barrow_banshee.json" with { type: "json" };
import cursedArcher from "./content/enemies/barrows/barrow_cursed_archer.json" with { type: "json" };
import ghost from "./content/enemies/barrows/barrow_ghost.json" with { type: "json" };
import hollowSoldier from "./content/enemies/barrows/barrow_hollow_soldier.json" with { type: "json" };
import skeleton from "./content/enemies/barrows/barrow_skeleton.json" with { type: "json" };
import heraldryJson from "./content/heraldry.json" with { type: "json" };
import injuriesJson from "./content/injuries.json" with { type: "json" };
import itemsJson from "./content/items.json" with { type: "json" };
import jobsJson from "./content/jobs.json" with { type: "json" };
import namesJson from "./content/names.json" with { type: "json" };
import propertiesJson from "./content/properties.json" with { type: "json" };
import seatsJson from "./content/seats.json" with { type: "json" };
import tarotJson from "./content/tarot.json" with { type: "json" };
import type { AbilityDef } from "./combat/types.ts";
import type { Element, JobId, Location } from "./state.ts";

export interface TarotCard {
  id: string;
  number: number;
  name: string;
  crunch: string;
}

export interface SeatStyle {
  id: string;
  name: string;
  flavor: string;
}

export interface Swatch {
  id: string;
  name: string;
  hex: string;
}

export interface Heraldry {
  palette: readonly Swatch[];
  shields: readonly string[];
  divisions: readonly string[];
  metals: readonly string[];
  charges: readonly string[];
}

export interface Names {
  given: { f: readonly string[]; m: readonly string[] };
  houses: readonly string[];
  mottos: readonly string[];
}

export type InjuryBand = "devastating" | "moderate" | "mild" | "shrug";
export type InjuryTableId = "head" | "body" | "arms" | "legs" | "sanity";

/** One row of an injury or Sanity table (§11); content/injuries.json, schemas/injuries.schema.json. */
export interface InjuryResult {
  id: string;
  /** The highest final roll that lands here. */
  max: number;
  band: InjuryBand;
  name: string;
  text: string;
  death?: true;
  mortal?: true;
  catatonic?: true;
  trauma?: true;
  boon?: true;
  scar?: true;
  disfiguring?: true;
  fear?: true;
  statuses?: { id: string; ticks: number }[];
  tp?: number;
  tpSet?: number;
  hpPct?: number;
  sanity?: number;
  sanityTo?: number;
  durabilityTo?: number;
  dent?: string;
  flags?: string[];
  stat?: Record<string, number>;
  battle?: Record<string, number>;
  expedition?: Record<string, number>;
  lasting?: { years: number; mods: Record<string, number> };
}

export interface InjuryTable {
  id: InjuryTableId;
  results: readonly InjuryResult[];
}

export const INJURY_TABLES = injuriesJson.tables as readonly InjuryTable[];
export const INJURY_TABLE_BY_ID = new Map(INJURY_TABLES.map((t) => [t.id, t]));
export const INJURY_BY_ID: ReadonlyMap<string, InjuryResult> = new Map(INJURY_TABLES.flatMap((t) => t.results.map((r) => [r.id, r] as const)));

export type EnemyRole = "fodder" | "swarm" | "bruiser" | "caster" | "support" | "lurker" | "artillery" | "horror" | "elite" | "colossus" | "boss";

/** An enemy ability as content writes it: `side` is "player" (the Scions' grid), "ally" or "self" (§14.1). */
export interface EnemyAbility {
  id: string;
  shape: string;
  side: "player" | "ally" | "self";
  power: number;
  base?: number;
  kind?: "physical" | "magic" | "heal";
  element?: Element | null;
  reach?: "melee" | "reach" | "ranged";
  locationBias?: Location;
  cost?: number;
  charge?: number;
  telegraph?: boolean;
  homing?: boolean;
  cooldown?: number;
  sanity?: number;
  readiness?: number;
  hits?: number;
  accuracy?: number;
  crit?: number;
  statuses?: { id: string; chance: number; ticks: number; value?: number }[];
}

/** One enemy (§14.1): content/enemies/<pool>/<id>.json, schemas/enemies.schema.json. */
export interface EnemyDef {
  id: string;
  name: string;
  pool: string;
  tags: string[];
  role: EnemyRole;
  size: [number, number];
  levels: [number, number];
  /** Multipliers on the level's block, replacing the role's; `speed` is absolute (§14.2). */
  stats?: { hp?: number; atk?: number; def?: number; acc?: number; eva?: number; speed?: number; sanityTouch?: number };
  affinity?: Partial<Record<Element, number>>;
  immune?: string[];
  weak?: { location: Location; mult: number };
  abilities: EnemyAbility[];
  gambits: { if?: string; do: string; target?: string }[];
  bestiary?: { lore: string; weakness: string };
}

/** Every enemy file. A new file is added here once (one import per file keeps the rules free of bundler globs). */
export const ENEMIES = [skeleton, hollowSoldier, ghost, cursedArcher, banshee] as unknown as readonly EnemyDef[];
export const ENEMY_BY_ID: ReadonlyMap<string, EnemyDef> = new Map(ENEMIES.map((e) => [e.id, e]));

/** A passive as content: rules text plus simple combat `mods` and statuses on self at battle `start`. */
export interface PassiveDef {
  id: string;
  name: string;
  text: string;
  mods?: Record<string, number>;
  start?: string[];
}

export type ArmorClass = "light" | "medium" | "heavy";

/** A Job (§12.3): multipliers while in it, what it may wield, how it unlocks, its free passives. */
export interface JobDef {
  id: JobId;
  name: string;
  set: string;
  advanced: boolean;
  requires?: { job: JobId; jp: number }[];
  unlockedBy?: ("bloodline" | "event")[];
  mult: Partial<Record<"might" | "resilience" | "guile" | "acuity" | "sagacity" | "hp" | "mp", number>>;
  speed?: number;
  /** Weapon types, optionally limited to one or two hands ("sword:1h"). */
  weapons: string[];
  armor: ArmorClass;
  shields: boolean;
  innate: PassiveDef;
  mastery: PassiveDef;
}

export const JOBS = jobsJson.jobs as readonly JobDef[];
export const JOB_BY_ID: ReadonlyMap<JobId, JobDef> = new Map(JOBS.map((j) => [j.id, j]));

/** An item base (§13.1–13.3): a weapon type, shield, armor piece by slot and class, or accessory. */
export interface ItemBase {
  id: string;
  name: string;
  slot: "main" | "off" | "head" | "body" | "arms" | "legs" | "acc";
  type: string;
  hands?: 1 | 2;
  /** Power index (a sword is 100). */
  power?: number;
  acc?: number;
  crit?: number;
  reach?: "melee" | "reach" | "ranged";
  aims?: Location[];
  critStatus?: string;
  armorPierce?: number;
  tpGain?: number;
  attackCost?: number;
  spellPct?: number;
  mpPct?: number;
  guard?: number;
  weight?: number;
  armor?: ArmorClass;
}

export const ITEM_BASES = itemsJson.bases as readonly ItemBase[];
export const ITEM_BASE_BY_ID: ReadonlyMap<string, ItemBase> = new Map(ITEM_BASES.map((b) => [b.id, b]));

/** What an item property rolls on: a kind of item, or an armor location. */
export type PropertyOn = "weapon" | "armor" | "shield" | "accessory" | Location;

/** An item property (§13.4–13.5): battle mods per point of its rolled value; `@` in a key is the piece's location. */
export interface PropertyDef {
  id: string;
  name: string;
  on: PropertyOn[];
  text: string;
  roll?: [number, number];
  mods: Record<string, number>;
  weight?: number;
  minTier?: 3 | 4 | 5;
  group?: string;
  negative?: boolean;
  curse?: boolean;
  /** Works outside battle (campaign) or waits on a later system. */
  effect?: "campaign" | "later";
  eventTag?: string;
}

export const PROPERTIES = propertiesJson.properties as unknown as readonly PropertyDef[];
export const PROPERTY_BY_ID: ReadonlyMap<string, PropertyDef> = new Map(PROPERTIES.map((x) => [x.id, x]));

export const TAROT: readonly TarotCard[] = tarotJson.cards;
export const SEATS: readonly SeatStyle[] = seatsJson.seats;
export const HERALDRY: Heraldry = heraldryJson;
export const NAMES: Names = namesJson;

const byId = <T extends { id: string }>(items: readonly T[]): ReadonlyMap<string, T> => new Map(items.map((item) => [item.id, item]));

export const TAROT_BY_ID = byId(TAROT);
export const SEAT_BY_ID = byId(SEATS);
export const SWATCH_BY_ID = byId(HERALDRY.palette);

/** A Job's active, as content: the battle ability plus its name, JP price and text (§12.4–12.17). */
export interface ActiveDef extends AbilityDef {
  name: string;
  jp: number;
  text: string;
  /** Learnable, but not in battle until its system exists. */
  later?: boolean;
}

/** A Job's purchasable passive: budget points and JP (§12.1). */
export interface JobPassiveDef extends PassiveDef {
  points: 1 | 2 | 3;
  jp: number;
  later?: boolean;
}

export interface AbilitySet {
  job: JobId;
  actives: ActiveDef[];
  passives: JobPassiveDef[];
}

/** Every Job's ability file (content/abilities/<job>.json), imported by name like the enemies. */
export const ABILITY_SETS = [soldierSet, knightSet, magusSet, soothsayerSet, vagabondSet] as unknown as readonly AbilitySet[];
export const ABILITY_SET_BY_JOB: ReadonlyMap<JobId, AbilitySet> = new Map(ABILITY_SETS.map((a) => [a.job, a]));
export const ACTIVE_BY_ID: ReadonlyMap<string, ActiveDef & { job: JobId }> = new Map(
  ABILITY_SETS.flatMap((set) => set.actives.map((a) => [a.id, { ...a, job: set.job }] as const)),
);
export const JOB_PASSIVE_BY_ID: ReadonlyMap<string, JobPassiveDef & { job: JobId }> = new Map(
  ABILITY_SETS.flatMap((set) => set.passives.map((a) => [a.id, { ...a, job: set.job }] as const)),
);
