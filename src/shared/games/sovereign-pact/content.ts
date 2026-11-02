// The content catalog: everything under content/ as typed data. Rules read content only through here,
// by id, so Josh can edit the JSON (validated by schemas/ in CI) without touching rules (CLAUDE.md).
import bossFiles from "./content/bosses/index.gen.ts";
import enemyFiles from "./content/enemies/index.gen.ts";
import townFiles from "./content/town/index.gen.ts";
import expeditionFiles from "./content/expedition/index.gen.ts";
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
import buildingsJson from "./content/buildings.json" with { type: "json" };
import changesJson from "./content/changes.json" with { type: "json" };
import consumablesJson from "./content/consumables.json" with { type: "json" };
import namedJson from "./content/named.json" with { type: "json" };
import bargainsJson from "./content/bargains.json" with { type: "json" };
import quarriesJson from "./content/quarries.json" with { type: "json" };
import arcanaJson from "./content/arcana.json" with { type: "json" };
import idolsJson from "./content/idols.json" with { type: "json" };
import formsJson from "./content/forms.json" with { type: "json" };
import projectsJson from "./content/projects.json" with { type: "json" };
import summonsJson from "./content/summons.json" with { type: "json" };
import hazardsJson from "./content/hazards.json" with { type: "json" };
import spritesJson from "./content/sprites/manifest.json" with { type: "json" };
import sfxJson from "./content/audio/sfx.json" with { type: "json" };
import heraldryJson from "./content/heraldry.json" with { type: "json" };
import houseTraitsJson from "./content/house_traits.json" with { type: "json" };
import traitsJson from "./content/traits.json" with { type: "json" };
import injuriesJson from "./content/injuries.json" with { type: "json" };
import itemsJson from "./content/items.json" with { type: "json" };
import jobsJson from "./content/jobs.json" with { type: "json" };
import namesJson from "./content/names.json" with { type: "json" };
import poolsJson from "./content/pools.json" with { type: "json" };
import sortiesJson from "./content/sorties.json" with { type: "json" };
import propertiesJson from "./content/properties.json" with { type: "json" };
import seatsJson from "./content/seats.json" with { type: "json" };
import tarotJson from "./content/tarot.json" with { type: "json" };
import variantsJson from "./content/variants.json" with { type: "json" };
import templatesJson from "./content/templates.json" with { type: "json" };
import type { AbilityDef, GambitRule } from "./combat/types.ts";
import type { AssignmentKind, Element, GearSlot, JobId, Location, Material, NodeKind, ScoreCategory, Stat } from "./state.ts";

export interface TarotCard {
  id: string;
  number: number;
  name: string;
  crunch: string;
  /** Battle mods the bearer carries (inverted when Reversed). */
  mods?: Record<string, number>;
}

export interface SeatStyle {
  id: string;
  name: string;
  flavor: string;
  /** One advantage and one drawback, in plain words (DECISIONS 8ah). */
  pro: string;
  con: string;
  /** What the House starts with when the Pact is sworn. */
  start?: { buildings?: Record<string, number>; recruits?: number };
  /** Battle mods and economy knobs, read like a House trait's. */
  mods?: Record<string, number>;
  economy?: Record<string, number>;
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
  /** Eats living allies of these ids to heal (the Siege Beast's Devour, the Unknown Mother's Consume). */
  devour?: Devour;
  /** Calls adds onto its grid (the Unknown Mother's Brood): placed like a boss phase's. */
  call?: BossAdds;
  /** Each target resists its statuses on a Sanity check: d100 under its Sanity % (the Mother's Lullaby). */
  sanityResists?: boolean;
  drain?: number;
  pull?: number;
  tpSteal?: number;
  sanityPerAdd?: number;
  constructHpPct?: number;
  selfDestruct?: boolean;
  flee?: boolean;
  cooldown?: number;
  sanity?: number;
  readiness?: number;
  hits?: number;
  accuracy?: number;
  crit?: number;
  statuses?: { id: string; chance: number; ticks: number; value?: number }[];
}

/** What a Devour eats: one (or `all`) of its living allies among `of`, healing `healPct`% of max HP for each. */
export interface Devour {
  of: string[];
  healPct: number;
  all?: boolean;
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
  /** A weak point it shows from this phase on (aimed hits on the location do × mult). */
  weak?: { location: Location; mult: number };
  /** Statuses it loses on entering the phase (Orochi's body stops being Guarded). */
  clear?: string[];
  /** Its elemental leanings from this phase on, replacing the old ones (Divine Beast Fusion's cycle). */
  affinity?: Partial<Record<Element, number>>;
  /** It rises as another boss (the Cursed King's Second Form): this one leaves, that one takes the field at full HP. */
  rise?: string;
  /** It kneels and the fight ends, won, with the boss alive (the Cursed King's Abdication). */
  kneel?: boolean;
  /** One living add of `from` becomes `into` where it stood (the Village Evil God's Flesh Mass). */
  transform?: { from: string; into: string };
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
  /** Statuses it starts the fight with (0 ticks: until removed). */
  start?: { id: string; ticks: number }[];
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

/** The pack picture an enemy, boss, summon or hazard is drawn with (§14.11): content/sprites/manifest.json. */
export interface SpriteDef {
  id: string;
  /** The source file in the Mega Packs, for the cutting tool and the credits. */
  source: string;
  /** Mirrored to face the party. */
  flip: boolean;
}

export const SPRITES = spritesJson.sprites as readonly SpriteDef[];
export const SPRITE_BY_ID: ReadonlyMap<string, SpriteDef> = new Map(SPRITES.map((s) => [s.id, s]));

/** A battle sound cue (§16.1): content/audio/sfx.json, the BOOM file its takes are cut from (tools/cut-sfx.py). */
export interface SfxCue {
  id: string;
  source: string;
  takes: number;
  max: number;
}
export const SFX = sfxJson.cues as readonly SfxCue[];
export const SFX_BY_ID: ReadonlyMap<string, SfxCue> = new Map(SFX.map((c) => [c.id, c]));

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
  /** Lines shown before a battle here, one chosen by the battle's seed. */
  omens?: string[];
  /** The drop table (§9.8): each material's % chance per roll, and Essence's. */
  drops: { materials: [string, number][]; essencePct: number };
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
  /** The item base of a newly promoted Scion's weapon (§13.4). */
  starter?: string;
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

export const TAROT = tarotJson.cards as readonly TarotCard[];
export const SEATS = seatsJson.seats as unknown as readonly SeatStyle[];
export const HERALDRY: Heraldry = heraldryJson;
export const NAMES: Names = namesJson;

const byId = <T extends { id: string }>(items: readonly T[]): ReadonlyMap<string, T> => new Map(items.map((item) => [item.id, item]));

export const TAROT_BY_ID = byId(TAROT);

/** A House building (§8.4): three levels, a cost table by class, and for producers the material made. */
export interface BuildingDef {
  id: string;
  name: string;
  cost: "cheap" | "standard" | "expensive";
  produces?: Exclude<Material, "essence">;
  /** What each level does, as shown in Crunch. */
  levels: string[];
}
export const BUILDINGS = buildingsJson.buildings as readonly BuildingDef[];
export const BUILDING_BY_ID = byId(BUILDINGS);
/** A shared project (§8.5) or shop (§8.6): its levels each priced as a House building tier. */
export interface ProjectDef {
  id: string;
  name: string;
  cost: BuildingDef["cost"];
  tiers: (1 | 2 | 3)[];
  requires?: string;
  /** A campaign flag that must be set first (the Bastion of the Gate, arc.ts). */
  unlockedBy?: string;
  text: string;
}
export const PROJECTS = projectsJson.projects as readonly ProjectDef[];
export const PROJECT_BY_ID = byId(PROJECTS);
/** One effect of a town event (§9.4's catalogue, the parts that touch the town). */
export interface TownEffect {
  /** The subject House (default), each House, one random House, or the Commons (resources only). */
  to?: "house" | "all" | "random" | "commons";
  accord?: number;
  doom?: number;
  resources?: Partial<Record<string, number>>;
  ruin?: number;
  recruits_lost?: number;
  sanity?: number;
  score?: Partial<Record<string, number>>;
  flag?: string;
  timeline?: { event: string; years: number; hidden?: boolean };
  recruit_gain?: number;
}
/** An option of a town event: who picks it is the event's rule; its outcome is drawn by weight. */
export interface TownOption {
  id: string;
  label: string;
  tags?: string[];
  outcomes: { w: number; text: string; effects: TownEffect[] }[];
}
export interface TownBand {
  text: string;
  effects: TownEffect[];
}
/** A Crisis (§3.5): a Need met by private pledges, four outcome bands, and perhaps a private temptation. */
export interface CrisisDef {
  need: Partial<Record<string, number>>;
  temptation?: { label: string; text: string; penalty: number; effects: TownEffect[] };
  triumph: TownBand;
  holds: TownBand;
  falters: TownBand;
  calamity: TownBand;
}
/** A town event drawn in the Omens (§8.8). */
export interface TownEventDef {
  id: string;
  scope: "settlement" | "house";
  weight: number;
  years: [number, number];
  requires?: string[];
  title: string;
  text: string;
  rule: string;
  crisis?: CrisisDef;
  options?: TownOption[];
  /** Secret choices: what follows when no House, or every House, picks `option`. */
  together?: { when: "none" | "all"; option: string; text: string; effects: TownEffect[] }[];
  /** A forcing event (§3.2): it comes only from the timeline, and makes the Year's expedition its one card. */
  forces?: { pool: string; size?: 4 | 8 };
}
export const TOWN_EVENTS = townFiles as unknown as readonly TownEventDef[];
export const TOWN_EVENT_BY_ID: ReadonlyMap<string, TownEventDef> = new Map(TOWN_EVENTS.map((e) => [e.id, e]));

/** One effect of an expedition event (§9.4's catalogue): on the subject, or the whole party. */
export interface TripEffect {
  to?: "subject" | "party";
  sanity?: number;
  durability?: number;
  loc?: "head" | "body" | "arms" | "legs";
  /** % of max HP, carried to the next battle (Josh 2026-11-02); never below 1. */
  hp?: number;
  mp?: number;
  xp?: number;
  jp?: number;
  injury?: InjuryTableId;
  resources?: Partial<Record<string, number>>;
  score?: Partial<Record<string, number>>;
  accord?: number;
  doom?: number;
  flag?: string;
  encounter?: { template?: string; modifier?: "ambush" | "surprise"; level?: number };
  skip?: number;
  retreat?: true;
  /** The party kneels to the Idol (§14.9): the expedition ends in triumph, its boss unfought. */
  idol?: "kneel";
  /** Permanent base stat changes; growth changes in hundredths ("all": every stat but Speed). */
  stat?: Partial<Record<Stat, number>>;
  growth?: Partial<Record<Stat | "all", number>>;
  /** "+id" gains an individual trait (replacing one of its group), "-id" loses it. */
  trait?: string;
  /** A random Curse (a trait tagged cursed) the subject lacks. */
  curse?: true;
  /** The Tarot redrawn (§6.8). */
  tarot?: true;
  /** An ailment the subject starts the next battle with. */
  status?: string;
  /** The subject's oldest lasting Moderate injury is healed (the Grinning Surgeon, §9.7). */
  mend?: true;
  /** The subject's House is told its Ascendancy as a number (§9.7, The Gate's Reflection). */
  foresee?: true;
  /** A trait held for a time: it fades at the Reckoning after `years` more Years (§9.4). */
  blessing?: { trait: string; years: number };
  /** A recruit, a building's next level (the subject's House, or a random House present), or a Commons shop's next tier. */
  house_improvement?: "recruit" | "building" | "shop";
  /** A Ward's Loyalty, + or − (§6.9). */
  loyalty?: number;
  /** A Fork (§9.3): the next `drop` places are passed by and `add` come next; never the boss. */
  fork?: { drop?: number; add?: NodeKind[] };
  /** The subject is Lost in the otherworld (§9.9). */
  scion_lost?: true;
  /** A found item of this tier: to the subject's House, or into the haul for the draft when the party chose together. */
  item?: { tier: 2 | 3 | 4 };
  /** A town event queued on the timeline `years` from now (§8.7), for the subject's House if it has one. */
  timeline?: { id: string; years: number };
  /** The subject is Changed (§9.6): a Change id from content/changes.json. */
  change?: string;
  /** A Changed subject's old body comes back (§9.6: some events can reverse a Change). */
  unchange?: true;
}
/** An option of an expedition event: the party votes for it; its rule names its subject (§9.4). */
export interface TripOption {
  id: string;
  label: string;
  rule: string;
  tags?: string[];
  /** `when` (secret events): another House picked option `any`, or no other House picked `none`. */
  outcomes: { w: number; text: string; effects: TripEffect[]; when?: { any?: string; none?: string } }[];
}
/** An expedition event, met at an Event node (§9.4). */
export interface TripEventDef {
  id: string;
  pools: string[];
  weight: number;
  band: [number, number];
  requires?: string[];
  title: string;
  text: string;
  options: TripOption[];
}
export const TRIP_EVENTS = expeditionFiles as unknown as readonly TripEventDef[];
export const TRIP_EVENT_BY_ID: ReadonlyMap<string, TripEventDef> = new Map(TRIP_EVENTS.map((e) => [e.id, e]));

/** Rare materials (§8.1): kept in Stores by id beside the five common ones. */
export const RARE_MATERIALS: readonly { id: string; name: string }[] = buildingsJson.rareMaterials;
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

/** A House trait (§5.3, §5.7). Each effect kind is read by the system that owns it; tags wait on later ones. */
export interface HouseTraitDef {
  id: string;
  name: string;
  kind: "major" | "minor" | "major_flaw" | "minor_flaw" | "bloodline";
  flavor: string;
  crunch: string;
  /** Battle mods every person of the House carries. */
  mods?: Record<string, number>;
  /** Recruit growth rate in % of the rolled rate; `all` is every stat but Speed. */
  growth?: Partial<Record<Exclude<Stat, "speed"> | "all", number>>;
  jobXp?: Partial<Record<JobId, number>>;
  economy?: Record<string, number>;
  score?: Partial<Record<ScoreCategory, number>>;
  /** Chance in % that a recruit rolls an individual trait. */
  innate?: Record<string, number>;
  tags?: string[];
  look?: string[];
  choice?: "element";
}
export const HOUSE_TRAITS = houseTraitsJson.traits as readonly HouseTraitDef[];
export const HOUSE_TRAIT_BY_ID = byId(HOUSE_TRAITS);

/** An individual trait (§6.7): one person's own, rolled at generation (weight > 0) or gained later. */
export interface TraitDef {
  id: string;
  name: string;
  flavor: string;
  crunch: string;
  /** Battle mods the person carries. */
  mods?: Record<string, number>;
  tags?: string[];
  weight: number;
  /** At most one of a group per person. */
  group?: string;
  /** Rolled more often for a House aligned with it. */
  element?: Element;
}
export const TRAITS = traitsJson.traits as readonly TraitDef[];
export const TRAIT_BY_ID = byId(TRAITS);

/** A Sortie (§6.11): content/sorties.json. Rewards are per Scion (XP per battle won, JP if won) and per House. */
export interface SortieDef {
  id: string;
  name: string;
  text: string;
  pool: string;
  battles: 1 | 2;
  xp: number;
  jp: number;
  rolls: number;
  gold?: number;
  score?: Partial<Record<ScoreCategory, number>>;
}
export const SORTIES = sortiesJson.sorties as readonly SortieDef[];
export const SORTIE_BY_ID = byId(SORTIES);

/**
 * A Change (§9.6; Josh 2026-11-02: the word for a Scion's permanent transformation): content/changes.json.
 * It replaces the Scion's stats, growths, traits, look and injuries; `mods` ride into battle like a trait's.
 */
export interface ChangeDef {
  id: string;
  name: string;
  flavor: string;
  crunch: string;
  base: Record<Stat, number>;
  growth: Record<Stat, number>;
  mods: Record<string, number>;
  /** A fixed Job: the Scion takes it and can take no other. */
  job?: JobId;
  slots: GearSlot[];
  barred?: AssignmentKind[];
  upkeep?: Partial<Record<string, number>>;
  look: string[];
}
export const CHANGES = changesJson.changes as unknown as readonly ChangeDef[];
export const CHANGE_BY_ID = byId(CHANGES);

/** A named item (§13.4): fixed properties on a base, one of each a campaign; an artifact also scores (§3.4). */
export interface NamedDef {
  id: string;
  name: string;
  base: string;
  tier: 3 | 4 | 5;
  props: [string, number][];
  text: string;
  /** The boss that drops it the first time it falls. */
  boss?: string;
  /** Pools whose Caches and boss hauls may hold it. */
  pools?: string[];
  minLevel?: number;
  artifact?: { category: ScoreCategory; points: number };
  /** A cure item (§11.2): one use, mending these injury results or any lasting one of a band; it may leave a look. */
  cure?: { injuries?: string[]; band?: "moderate"; look?: string };
}
export const NAMED = namedJson.named as unknown as readonly NamedDef[];
export const NAMED_BY_ID = byId(NAMED);

/** What a Dark Bargain costs, grants or inflicts (§14.7a), on one House. */
export interface BargainEffect {
  resources?: Partial<Record<string, number>>;
  /** % of maximum Sanity, every Scion of the House. */
  sanity?: number;
  score?: Partial<Record<ScoreCategory, number>>;
  ruin?: number;
  recruits_lost?: number;
  recruit_gain?: number;
  /** An item of this tier for the stash. */
  item?: 2 | 3 | 4;
  /** A cursed item turns up in the stash. */
  cursed?: true;
  /** Added to one stat of the House's highest-level Scion. */
  stat?: number;
  /** Standing buildings raised a level. */
  building?: number;
}
/** A Dark Bargain (§14.7a): a private offer, a price for a boon or for a bane on a named rival. */
export interface BargainDef {
  id: string;
  title: string;
  text: string;
  when: ("omen" | "crown" | "reflection")[];
  price: BargainEffect;
  boon?: BargainEffect;
  bane?: BargainEffect;
  /** What a bane's victim reads: an ordinary misfortune. */
  misfortune?: string;
  /** What the bargainer reads when it comes as promised. */
  promise: string;
  /** % chance it carries a hidden Pact mark. */
  mark: number;
}
export const BARGAINS = bargainsJson.bargains as unknown as readonly BargainDef[];
export const BARGAIN_BY_ID = byId(BARGAINS);

/** A Hunt quarry (§14.9): a named enemy of its pool, +1 level and +50% HP, with one trick and a trophy. */
export interface QuarryDef {
  id: string;
  title: string;
  /** The enemy it is; its pool and levels are the quarry's. */
  enemy: string;
  ability: "enrage" | "ambush" | "call_pack";
  trophy: { valor: number; stores?: Partial<Record<string, number>> };
  text: string;
}
export const QUARRIES = quarriesJson.quarries as unknown as readonly QuarryDef[];
export const QUARRY_BY_ID = byId(QUARRIES);

/** An Arcana node (§14.9): a Major Arcana's mini-boss, the trait its bearer gains on the kill, and its Relic. */
export interface ArcanaDef {
  tarot: string;
  boss: string;
  trait: string;
  relic: string;
}
export const ARCANA = arcanaJson.arcana as readonly ArcanaDef[];
export const ARCANA_BY_TAROT: ReadonlyMap<string, ArcanaDef> = new Map(ARCANA.map((a) => [a.tarot, a]));

/** An Idol (§14.9): an old god at the end of a Pilgrimage card, an offer first and a boss if refused or cheated. */
export interface IdolDef {
  id: string;
  pool: string;
  boss: string;
  /** Its offer, an expedition event of pool "idol". */
  event: string;
  relic: string;
}
export const IDOLS = idolsJson.idols as readonly IdolDef[];
export const IDOL_BY_ID = byId(IDOLS);

/** A consumable (§13.7): Houses hold them by count, the party satchel carries them, and a use costs 100 CT. */
export interface ConsumableDef {
  id: string;
  name: string;
  text: string;
  /** Gold, first pass. */
  price: number;
  /** Where a House buys it: a Commons shop at a stock tier, or one of its own buildings at a level. */
  sold: readonly { at: string; level: number }[];
  use: "battle" | "camp" | "node" | "town" | "held";
  /** Its battle effect, shaped as an ability. */
  battle?: Omit<import("./combat/types.ts").AbilityDef, "id"> & { mpPct?: number };
  /** An effect the rules hand-code. */
  special?: string;
}
export const CONSUMABLES = consumablesJson.consumables as unknown as readonly ConsumableDef[];
export const CONSUMABLE_BY_ID = byId(CONSUMABLES);
