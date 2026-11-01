// The content catalog: everything under content/ as typed data. Rules read content only through here,
// by id, so Josh can edit the JSON (validated by schemas/ in CI) without touching rules (CLAUDE.md).
import bossFiles from "./content/bosses/index.gen.ts";
import enemyFiles from "./content/enemies/index.gen.ts";
import abjurerSet from "./content/abilities/abjurer.json" with { type: "json" };
import conjurerSet from "./content/abilities/conjurer.json" with { type: "json" };
import altererSet from "./content/abilities/alterer.json" with { type: "json" };
import gamblerSet from "./content/abilities/gambler.json" with { type: "json" };
import knightSet from "./content/abilities/knight.json" with { type: "json" };
import minstrelSet from "./content/abilities/minstrel.json" with { type: "json" };
import magusSet from "./content/abilities/magus.json" with { type: "json" };
import pugilistSet from "./content/abilities/pugilist.json" with { type: "json" };
import ravagerSet from "./content/abilities/ravager.json" with { type: "json" };
import soldierSet from "./content/abilities/soldier.json" with { type: "json" };
import soothsayerSet from "./content/abilities/soothsayer.json" with { type: "json" };
import tinkererSet from "./content/abilities/tinkerer.json" with { type: "json" };
import swordSaintSet from "./content/abilities/sword_saint.json" with { type: "json" };
import vagabondSet from "./content/abilities/vagabond.json" with { type: "json" };
import formsJson from "./content/forms.json" with { type: "json" };
import summonsJson from "./content/summons.json" with { type: "json" };
import hazardsJson from "./content/hazards.json" with { type: "json" };
import heraldryJson from "./content/heraldry.json" with { type: "json" };
import injuriesJson from "./content/injuries.json" with { type: "json" };
import itemsJson from "./content/items.json" with { type: "json" };
import jobsJson from "./content/jobs.json" with { type: "json" };
import namesJson from "./content/names.json" with { type: "json" };
import poolsJson from "./content/pools.json" with { type: "json" };
import propertiesJson from "./content/properties.json" with { type: "json" };
import seatsJson from "./content/seats.json" with { type: "json" };
import tarotJson from "./content/tarot.json" with { type: "json" };
import variantsJson from "./content/variants.json" with { type: "json" };
import templatesJson from "./content/templates.json" with { type: "json" };
import type { AbilityDef, GambitRule } from "./combat/types.ts";
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
  kind?: "physical" | "magic" | "heal" | "support";
  element?: Element | null;
  reach?: "melee" | "reach" | "ranged";
  locationBias?: Location;
  cost?: number;
  charge?: number;
  telegraph?: boolean;
  homing?: boolean;
  leap?: boolean;
  raise?: number;
  drain?: number;
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
  /** Parts (§14.1): sub-entities on some of its cells. */
  parts?: PartDef[];
  /** Only a boss brings it: never drawn for an Encounter. */
  addOnly?: boolean;
  /** Elemental variants it can appear as (§14.10). */
  variants?: string[];
  bestiary?: { lore: string; weakness: string };
}

/** A Part of a big enemy (§14.1): cells relative to its top-left, HP as a share of its max, the abilities it powers. */
export interface PartDef {
  id: string;
  name: string;
  cells: [number, number][];
  hp: number;
  disables?: string[];
  affinity?: Partial<Record<Element, number>>;
  immune?: string[];
  weak?: { location: Location; mult: number };
  /** Battle mods the body takes while this Part is destroyed (`damagePct: -25` is a quarter less damage). */
  mods?: Record<string, number>;
}

/** Every enemy file, through the generated index (`npm run gen:content`; one import per file keeps the rules free of bundler globs). */
export const ENEMIES = enemyFiles as unknown as readonly EnemyDef[];

/** Adds a boss brings: its opening group or a phase's (§14.6). */
export interface BossAdds {
  spawn: string[];
  count?: number;
  at: "E1" | "E2" | "E3";
}

/** A boss phase (§14.6): entered once when `at` holds, with its own gambits, speed, adds and line. */
export interface BossPhase {
  at: string;
  name: string;
  speed?: number;
  gambits: { if?: string; do: string; target?: string }[];
  adds?: BossAdds;
  dispel?: boolean;
  regrow?: boolean;
  flee?: boolean;
  statuses?: { id: string; ticks: number }[];
  say: string;
}

/** A scripted boss (§10.10, §14.6): content/bosses/<id>.json, an enemy plus its phases. */
export interface BossDef extends EnemyDef {
  role: "boss";
  /** The column it starts in (E1 if not given). */
  at?: "E1" | "E2" | "E3";
  adds?: BossAdds[];
  phases: BossPhase[];
  say: { open: string; death: string };
  bestiary: { lore: string; weakness: string; pattern: string };
}

/** Every boss file, through the generated index. */
export const BOSSES = bossFiles as unknown as readonly BossDef[];
export const BOSS_BY_ID: ReadonlyMap<string, BossDef> = new Map(BOSSES.map((e) => [e.id, e]));
/** Enemies and bosses by id: anything that can stand on the enemy grid. */
export const ENEMY_BY_ID: ReadonlyMap<string, EnemyDef> = new Map([...ENEMIES, ...BOSSES].map((e) => [e.id, e]));

/** A variant family member (§14.10): content/variants.json. */
export interface VariantDef {
  id: string;
  family: "elemental" | "hollow" | "unknown";
  prefix: string;
  tint: string;
  affinity?: Partial<Record<Element, number>>;
  tags?: string[];
  element?: Element;
  sanityTouch?: number;
  level?: number;
  roles?: EnemyRole[];
  immune?: string[];
  minYear?: number;
}

export const VARIANTS = variantsJson.variants as unknown as readonly VariantDef[];
export const VARIANT_BY_ID: ReadonlyMap<string, VariantDef> = new Map(VARIANTS.map((v) => [v.id, v]));

/** A battle hazard (§14.8): content/hazards.json. */
export interface HazardDef {
  id: string;
  name: string;
  side: "enemy" | "party";
  cols?: number[];
  hp?: number;
  weight: number;
  pools?: string[];
  bait?: boolean;
  hidden?: boolean;
  telegraph?: boolean;
  trigger: { kind: "destroyed" | "every" | "struck_or_timer" | "front_row" | "timer" | "enter"; ticks?: number };
  effect?: EnemyAbility;
  reinforce?: number;
  lore: string;
}

export const HAZARDS = hazardsJson.hazards as unknown as readonly HazardDef[];
export const HAZARD_BY_ID: ReadonlyMap<string, HazardDef> = new Map(HAZARDS.map((h) => [h.id, h]));

export type CardType = "resource" | "hunt" | "delve" | "rescue" | "pilgrimage";

/** A region of the otherworld (§14.5): content/pools.json. Its roster is every enemy filed under it. */
export interface PoolDef {
  id: string;
  name: string;
  levels: [number, number];
  cards: CardType[];
  resist: Element[];
  weak: Element[];
  /** Chance an Encounter here carries a hazard (§14.8). */
  hazardPct: number;
}

export const POOLS = poolsJson.pools as unknown as readonly PoolDef[];
export const POOL_BY_ID: ReadonlyMap<string, PoolDef> = new Map(POOLS.map((p) => [p.id, p]));

/** The enemies of a pool, by role, that appear at expedition level `level` (§14.4: entries whose `levels` span L). */
export const rosterOf = (pool: string, role: EnemyRole, level: number): EnemyDef[] =>
  ENEMIES.filter((e) => e.pool === pool && e.role === role && !e.addOnly && e.levels[0] <= level && level <= e.levels[1]);

export type TemplateRole = Exclude<EnemyRole, "boss">;
/** A role's count: exact, or a [min, max] range drawn when the group is made. */
export type RoleCounts = Partial<Record<TemplateRole, number | [number, number]>>;

/** An encounter group template (§14.4): content/templates.json. */
export interface TemplateDef {
  id: string;
  name: string;
  weight: number;
  levels: [number, number];
  ambushMult?: number;
  betterDrops?: boolean;
  four: RoleCounts;
  eight: RoleCounts;
}

export const TEMPLATES = templatesJson.templates as unknown as readonly TemplateDef[];
export const TEMPLATE_BY_ID: ReadonlyMap<string, TemplateDef> = new Map(TEMPLATES.map((t) => [t.id, t]));

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
export const ABILITY_SETS = [soldierSet, knightSet, magusSet, soothsayerSet, vagabondSet, gamblerSet, minstrelSet, pugilistSet, ravagerSet, swordSaintSet, abjurerSet, conjurerSet, tinkererSet, altererSet] as unknown as readonly AbilitySet[];
export const ABILITY_SET_BY_JOB: ReadonlyMap<JobId, AbilitySet> = new Map(ABILITY_SETS.map((a) => [a.job, a]));
export const ACTIVE_BY_ID: ReadonlyMap<string, ActiveDef & { job: JobId }> = new Map(
  ABILITY_SETS.flatMap((set) => set.actives.map((a) => [a.id, { ...a, job: set.job }] as const)),
);
export const JOB_PASSIVE_BY_ID: ReadonlyMap<string, JobPassiveDef & { job: JobId }> = new Map(
  ABILITY_SETS.flatMap((set) => set.passives.map((a) => [a.id, { ...a, job: set.job }] as const)),
);

/** A Conjurer's summon (§12.2, §12.15): stats relative to the Conjurer, abilities from its own point of view. */
export interface SummonDef {
  id: string;
  name: string;
  text: string;
  place: "front" | "back" | "any";
  count: number;
  size: [number, number];
  /** How long it stays; 0: the whole battle. */
  ticks: number;
  /** % of the Conjurer's max HP. */
  hp: number;
  /** × the spell power block at the Conjurer's level. */
  atk: number;
  /** Added to the Conjurer's Speed. */
  speed: number;
  ct?: number;
  evasion?: number;
  /** × the Conjurer's defense. */
  defense?: number;
  guard?: number;
  tags: string[];
  start?: string[];
  immune?: string[];
  affinity?: Partial<Record<Element, number>>;
  mods?: Record<string, number>;
  /** Mods on every enemy while it stands (the Drowned Choir's dirge). */
  aura?: Record<string, number>;
  abilities: AbilityDef[];
  onDeath?: AbilityDef;
  /** Its own gambit list (a Turret only waits); none: the default. */
  gambits?: GambitRule[];
}

/** An enemy-shaped ability from its user's point of view: "player" is the foe. */
export const fromEnemySide = (a: EnemyAbility): AbilityDef => ({ ...a, side: a.side === "player" ? "foe" : a.side }) as AbilityDef;

/** Summon abilities are written like enemies' ("player" is the foe) and turned to the summon's point of view here. */
export const SUMMONS: readonly SummonDef[] = (summonsJson.summons as unknown as (Omit<SummonDef, "abilities" | "onDeath"> & { abilities: EnemyAbility[]; onDeath?: EnemyAbility })[]).map((s) => ({
  ...s,
  abilities: s.abilities.map(fromEnemySide),
  onDeath: s.onDeath && fromEnemySide(s.onDeath),
}));
export const SUMMON_BY_ID = byId(SUMMONS);

/** An Alterer's Form (§12.2, §12.17): what a Shift puts on, for how long, and what Revert costs. */
export interface FormDef {
  id: string;
  name: string;
  text: string;
  control: "controlled" | "feral";
  ticks: number;
  size?: [number, number];
  hpMult?: number;
  guard?: number;
  mods: Record<string, number>;
  start?: string[];
  graft?: Record<string, number>;
  abilities: AbilityDef[];
  revert?: { statuses?: { id: string; ticks: number; mods?: Record<string, number> }[]; sanityPct?: number; durability?: { loc: Location; pct: number } };
}

export const FORMS: readonly FormDef[] = (formsJson.forms as unknown as (Omit<FormDef, "abilities"> & { abilities: EnemyAbility[] })[]).map((f) => ({
  ...f,
  abilities: f.abilities.map(fromEnemySide),
}));
export const FORM_BY_ID = byId(FORMS);
