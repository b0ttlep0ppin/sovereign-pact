// The campaign's state: plain JSON, the single source of truth the reducer works over (SPEC §4.2).
// Content is stored by id, never by text, so a 20-Year, 4-House checkpoint fits 64 KB (§4.4).
// Hidden information (Ambition, exact score, pledges, Loyalty, unrevealed recruit potential, Pact
// marks) lives here like everything else and is filtered out per seat by view.ts.
import type { PlayerId } from "../../game.ts";
import type { FoundingStep, HouseDesign } from "./founding.ts";
import type { Muster } from "./muster.ts";
import type { Replay } from "./combat/replay.ts";
import type { Battle } from "./combat/types.ts";
import type { TripEffect } from "./content.ts";
import type { Command } from "./fight.ts";

export const ELEMENTS = ["holy", "dark", "fire", "water", "earth", "wind"] as const;
/** Three opposed pairs: Holy/Dark, Fire/Water, Earth/Wind (§5.6). */
export type Element = (typeof ELEMENTS)[number];

/** The six core stats, in the order every {@link Six} uses (§7.1). */
export const STATS = ["might", "resilience", "guile", "acuity", "sagacity", "speed"] as const;
export type Stat = (typeof STATS)[number];
/** One number per core stat, in {@link STATS} order. */
export type Six = [number, number, number, number, number, number];

export const LOCATIONS = ["head", "body", "arms", "legs"] as const;
/** Hit locations; "hands" is Arms (§7.4). */
export type Location = (typeof LOCATIONS)[number];

export const MATERIALS = ["grain", "timber", "stone", "iron", "essence"] as const;
export type Material = (typeof MATERIALS)[number];
/** Materials by id: the five common ones plus rare materials (wyrmbone, moonsilver…) by content id (§8.1). */
export type Stores = Partial<Record<string, number>>;

export const SCORE_CATEGORIES = ["lineage", "valor", "treasury", "holdings", "lore", "renown", "intrigue", "relics"] as const;
/** The eight Ascendancy categories (§3.4). */
export type ScoreCategory = (typeof SCORE_CATEGORIES)[number];
export type Score = Record<ScoreCategory, number>;

/** Doubles one category and halves another; secret to its House (§3.4). */
export interface Ambition {
  double: ScoreCategory;
  halve: ScoreCategory;
}

export type StandingTier = "waning" | "steady" | "rising" | "ascendant";

export const BASE_JOBS = ["soldier", "knight", "magus", "soothsayer", "vagabond", "pugilist", "minstrel", "gambler"] as const;
export const ADVANCED_JOBS = ["ravager", "sword_saint", "abjurer", "conjurer", "tinkerer", "alterer"] as const;
export type JobId = (typeof BASE_JOBS)[number] | (typeof ADVANCED_JOBS)[number];

export type PotentialTier = "common" | "promising" | "gifted" | "prodigy";

/** Where a person stands in the lifecycle (§6.1). The dead leave `people` for their House's Chronicle. */
export type PersonStatus = "recruit" | "scion" | "retired" | "lost";

export const GEAR_SLOTS = ["main", "off", "head", "body", "arms", "legs", "acc1", "acc2"] as const;
export type GearSlot = (typeof GEAR_SLOTS)[number];

/** The counters event resolution rules read (§9.4: most kills, most expeditions, the healer…). */
export const HIST_KEYS = ["kills", "expeditions", "led", "healing", "targeted", "bosses", "sorties", "devastating", "dead_comrades", "retired", "tarot_tokens"] as const;
export type HistKey = (typeof HIST_KEYS)[number];

/** A lasting injury result (§11.2). `years` −1 is permanent. */
export interface Injury {
  /** The injury table result's content id, e.g. "head_lost_eye". */
  id: string;
  years: number;
}

/**
 * A recruit, Scion or Retired Scion: one small record (§6.3). Rates are integers in hundredths so the
 * rules stay exact and the save stays small.
 */
export interface Person {
  id: number;
  status: PersonStatus;
  /** Birth House (index into `houses`). */
  house: number;
  /** Current House: differs from `house` for a Ward (§6.9). */
  host: number;
  name: string;
  sex: "f" | "m";
  /** Sprite layer ids (§5.8); filled by the sprite pipeline in Milestone 8. */
  look: string[];
  age: number;
  base: Six;
  /** Growth per level, in hundredths (§7.2: 40–160). */
  growth: Six;
  /** Fractional growth carried between levels, in hundredths. */
  carry: Six;
  /** Hidden until Insight reveals it (§6.4). */
  potential: PotentialTier;
  level: number;
  xp: number;
  /** Primary Job; recruits have none. */
  job: JobId | null;
  secondary?: JobId;
  /** JP earned per Job; buying abilities does not lower it (what is left: progression.ts `jpLeft`). */
  jp: Partial<Record<JobId, number>>;
  /** Jobs with every ability bought (§12.1); their abilities are not listed again in `learned`. */
  mastered: JobId[];
  /** Abilities and passives bought in Jobs not yet mastered, by content id. */
  learned: string[];
  /** Passives equipped against the budget, by content id. */
  passives: string[];
  /** Individual trait ids (§6.7). */
  traits: string[];
  /** Major Arcana id (§6.8); hidden on recruits until promotion or Insight 3. */
  tarot: string;
  reversed?: true;
  /** Element deltas granted by events, on top of House and traits. */
  aff?: Partial<Record<Element, number>>;
  injuries: Injury[];
  /** Current Sanity and MP: both persist between battles (§7.1, §7.4). */
  sanity: number;
  mp: number;
  /** Item instance ids, owned by the host House (§13.8). */
  gear: Partial<Record<GearSlot, number>>;
  /** Counters event rules read: kills, expeditions, heals, times targeted… (§9.4). */
  hist: Partial<Record<HistKey, number>>;
  /** Traits held for a time (§9.4 blessings): the Reckonings each has left before it fades. */
  blessed?: { id: string; years: number }[];
  /** A Lost Scion's last sighting (§9.9): the Year, and the pool and level of the expedition that left them. */
  lost?: { year: number; pool: string; level: number };
  /** A Change (§9.6) and the body it replaced, kept so an event can give it back. */
  change?: { id: string; was: Body };
  /** Wards only: 0–100, hidden from both Houses (§6.9). */
  loyalty?: number;
  /** Wards only: the Year the host took them in (no giving back within 3 Years). */
  wardSince?: number;
}

/** What a Change replaces (§9.6), at the level it happened. */
export interface Body {
  level: number;
  base: Six;
  growth: Six;
  carry: Six;
  traits: string[];
  look: string[];
  injuries: Injury[];
  job: JobId | null;
  secondary?: JobId;
}

/** A dead Scion, kept in the House's Chronicle (§6.13). */
export interface ChronicleEntry {
  name: string;
  year: number;
  /** Cause of death, as a content id (an injury result, a boss…). */
  cause: string;
  level: number;
}

export interface Emblem {
  shield: string;
  division: string;
  /** Field tinctures, as palette ids. */
  tinctures: string[];
  charge: string;
  secondary?: string;
}

export interface House {
  name: string;
  motto: string;
  /** Primary and secondary palette ids (§5.1). */
  colors: [string, string];
  emblem: Emblem;
  /** The House's home on the Town Map; cosmetic (§5.5). */
  seat: string;
  /** Elemental affinity, or null for Unaligned (§5.6). */
  element: Element | null;
  /** House trait ids: Majors, Minors, Flaws, or a Bloodline (§5.7). */
  traits: string[];
  /** The element Elemental Bane names, when the House took it. */
  bane?: Element;
  /** Music track id for the Settlement theme (§5.9). */
  theme: string;
  /** Hidden: only this House sees it. */
  ambition: Ambition;
  /** Hidden: the two Ambitions dealt at founding, until the House swears with one (§5.1 step 7). */
  dealt?: [Ambition, Ambition];
  /** Hidden: the raw points per category, before the Ambition (§3.4). */
  score: Score;
  /** Hidden: Pact marks from Dark Bargains, revealed only at the final score (§14.7a). */
  pactMarks: number;
  gold: number;
  /** Owed Gold (Debt-Ridden, unpaid upkeep). */
  debt: number;
  stores: Stores;
  /** Building id → level 1–3 (§8.4). */
  buildings: Partial<Record<string, number>>;
  /** Buildings started this Year, each one level up at the Reckoning (§8.3); public on the Town Map. */
  works: string[];
  chronicle: ChronicleEntry[];
  /** Pressed Seal the Year (§8.2). */
  sealed: boolean;
  /** Recruits promoted this Year (§6.5). */
  promotions?: number;
  /** Expeditions it has sent Scions on: spare seats go to the fewest first (§9.2). */
  attended?: number;
  /** Consumables held at home, by id → count (§13.7). */
  consumables?: Partial<Record<string, number>>;
}

/** A queued thing on the 20-Year strip (§8.7). Hidden entries show as "?" until revealed. */
export interface TimelineEntry {
  year: number;
  /** Content id of the event or consequence. */
  id: string;
  /** House index it concerns, if any. */
  house?: number;
  hidden?: true;
}

/** What a person does with the Year (§8.3). Expedition, Sortie and Special come with Milestone 6 and events. */
export const ASSIGNMENTS = ["rest", "chapel", "infirmary", "train", "teach", "study", "work", "guard", "sortie"] as const;
export type AssignmentKind = (typeof ASSIGNMENTS)[number];
export interface Assignment {
  to: AssignmentKind;
  /** Work: the producer building worked; Sortie: the Sortie's content id. */
  at?: string;
  /** Train: the Mentor's person id, and the mastered Job taught. */
  mentor?: number;
  job?: JobId;
}

/** A shared project's next level, paid for so far: by resource, and each House's share (public, §8.5). */
export interface ProjectFund {
  paid: Partial<Record<string, number>>;
  /** Units pledged by each House (index), for Renown. */
  by: number[];
}

export interface Commons {
  gold: number;
  stores: Stores;
  /** Shared project id → level standing. */
  built: Partial<Record<string, number>>;
  /** Shared projects being paid for, by id. */
  funds: Partial<Record<string, ProjectFund>>;
  /** Shop stock tiers above 1, raised by expedition finds (§8.6). */
  shopTiers?: Partial<Record<string, number>>;
}

/** An expedition the Rift Gate offers (§9.1): type, enemy pool, level 1–10 and party size. */
export interface ExpeditionCard {
  type: "mandatory" | "forced" | "resource" | "hunt" | "rescue" | "delve" | "pilgrimage";
  pool: string;
  level: number;
  size: 4 | 8 | "2x4";
  /** The mandatory arc's boss (§14.7); other cards draw theirs from the pool. */
  boss?: string;
  /** A Rescue card's Lost Scions (§9.9): a won expedition brings them home. */
  rescue?: number[];
  /** A Pilgrimage card's Idol (§14.9), by content id: its offer waits before the boss, which is the Idol. */
  idol?: string;
  /** A Hunt card's named quarry (§14.9), by content id: fought in its Lair, one node of the chain. */
  quarry?: string;
  /** An Arcana Hunt's Tarot (§14.9): the great Arcana is the card's boss. */
  arcana?: string;
}

/** One share of a drafted haul: an item, or a bundle of materials. */
export interface Share {
  id: number;
  item?: Item;
  stores?: Stores;
}

/** The Year's expedition (§9.2): seats per House, the Scions each fielded, the Leader vote. */
export interface Expedition {
  card: ExpeditionCard;
  /** Seats per House index. */
  seats: number[];
  /** Person ids each House fielded; null while it is still choosing. */
  party: (number[] | null)[];
  /** Houses that left seats empty: they are not offered more. */
  declined: number[];
  /** Each House's vote for a Leader while the vote is open. */
  votes?: (number | null)[];
  /** The Leader's person id, once the party departs; a fallen Leader's successor after. */
  leader?: number;
  /** The Arcana met on this chain (§14.9), by Tarot id: its node is a face-down card until reached. */
  arcana?: string;
  /** The chain (§9.3), rolled at departure; only the nodes passed are shown. */
  chain: NodeKind[];
  /** The next node's index. */
  at: number;
  /** What each Scion carries from battle to battle: Durability, Broken locations, this expedition's injury mods, an ailment for the next battle (`id` or `id:ticks`). */
  carry: Record<number, { dur: Partial<Record<Location, number>>; broken: Location[]; mods?: Record<string, number>; start?: string[] }>;
  /** Scions out of the fight for the rest of the expedition (Catatonic). */
  out: number[];
  /** Events met this expedition: none comes twice. */
  seen: string[];
  /** The event waiting on the party (§9.4): each House's vote, −1 for a House with no one present; for `each_scion`, each Scion's pick. */
  event?: { id: string; votes: (number | null)[]; picks?: Record<number, number | null> };
  /** What the party carries home (§9.8, §9.10): found items, not yet anyone's, and materials. Lost on a wipe. */
  haul?: { items: Item[]; stores: Stores };
  /** The haul as shares, being drafted (§9.10). */
  pool?: Share[];
  /** The Houses' picks still to come in the loot draft, in snake order (§9.10). */
  draft?: number[];
  /** How it ended: the boss beaten, turned back, wiped, nobody came, or it never left. */
  result?: "won" | "retreated" | "wiped" | "unanswered" | "stayed";
  /** A 2×4 card's two parties (§9.3, split.ts); `chain`, `at` and `leader` above are the walking party's. */
  split?: Split;
  /** The party satchel (§9.10, §13.7): one consumable a slot, with the House that packed it. */
  satchel?: { id: string; house: number }[];
  /** The node a Lantern lights (§13.7): it cannot Ambush the party, and an Encounter there is a Surprise. */
  lit?: number;
  /** The battle being fought, turn by turn (fight.ts). */
  fight?: LiveFight;
}

/** What a battle's victory carries on with: a trapped Cache opened, or the rest of an event's outcome. */
export type Then = { cache: true } | { effects: TripEffect[]; scions: number[]; house: number | null };

/** A battle under way (§10.4): it runs by itself until a Scion's turn, then waits on the Scion's House. */
export interface LiveFight {
  b: Battle;
  title: string;
  boss: boolean;
  /** How it was made (journey.ts FightOpts). */
  o: NonNullable<TripEffect["encounter"]> & { raid?: true; lair?: true; arcana?: true };
  then?: Then;
  /** The replay so far, finished and handed to the battle screen at the end. */
  replay: Replay;
  /** Battle events from before the first turn; each turn's own move into the replay as it is played. */
  seen: number;
  turns: number;
  /** The Scion whose turn it is, waiting on a command. */
  unit?: number;
  /** Houses whose Scions fight by gambits for the rest of this battle. */
  auto?: number[];
}

/** Where one of a 2×4 card's parties is: on its way, at the meeting place, or gone home. */
export type PartyState = "walking" | "rallied" | "retreated" | "wiped";

/** A 2×4 expedition's parties: each its own chain, Leader and place on it; one walks at a time. */
export interface Split {
  teams: [number[], number[]];
  leaders: [number, number];
  /** The parties' chains; the walking party's is kept up to date in `Expedition.chain` until control passes. */
  chains: [NodeKind[], NodeKind[]];
  at: [number, number];
  turn: 0 | 1;
  state: [PartyState, PartyState];
  /** Scions of a party that turned back: home already, and drafting the haul when it comes. */
  home: number[];
  /** Both parties met (or what is left of them) for the boss. */
  united?: true;
}

/** `gate` and `rally` are a 2×4 card's: a Gate waits on the other party; the rally is where they meet for the boss. */
export type NodeKind = "encounter" | "event" | "camp" | "cache" | "boss" | "gate" | "rally" | "raid" | "lair" | "arcana" | "idol" | "reflection";

/**
 * A vote of the Houses (§8.1, §8.8): open in the Settlement Phase, settled when every House has voted or
 * when the Year is sealed (those who did not vote abstain). Votes are cast in the open.
 */

export interface Vote {
  /** What it decides: "spend" (the Commons' stock on a project); events add their own kinds. */
  kind: "spend" | "event";
  /** The project (or event) it is about. */
  subject: string;
  /** Option ids, in order; "yes" and "no" for a spend. */
  options: string[];
  /** Each House's choice (index into options), or null while it has not voted. */
  by: (number | null)[];
  proposer: number;
}

/** This Year's Crisis (§3.5): its Need, and each House's private pledge and whether it gave in to the temptation. */
export interface Crisis {
  id: string;
  need: Partial<Record<string, number>>;
  pledges: Partial<Record<string, number>>[];
  tempted: boolean[];
}

/** A town event waiting on choices (§8.8): who must choose, and what each House chose (by option index). */
export interface PendingEvent {
  /** The event id, with "@<House>" for a House event (two Houses may draw the same one). */
  key: string;
  id: string;
  /** The House it concerns, for a House event. */
  house?: number;
  deciders: number[];
  choices: (number | null)[];
}

/** One side of a deal: Gold, materials and stashed items (by id). */
export interface DealSide {
  gold?: number;
  stores?: Partial<Record<string, number>>;
  items?: number[];
  /** Scions given as Wards (§6.9). */
  wards?: number[];
}

/** A deal offered by one House to another (§8.9): instant when accepted, gone at the seal. */
export interface Deal {
  id: number;
  from: number;
  to: number;
  give: DealSide;
  get: DealSide;
  /** A public deal is logged for all and counts for Renown; a private one only the two Houses see. */
  open: boolean;
}

/**
 * An item for sale this Year (§8.6, §13.4a): from a shop at its list price, or put up by a House. Fine
 * goods sell first come; Masterwork, Relic and rare-property goods, and every House's lot, go to sealed bids.
 */
export interface Lot {
  item: Item;
  /** The shop's id, or null for a House's own lot. */
  shop: string | null;
  /** The House selling its own item. */
  seller?: number;
  /** List price, or a House's reserve. */
  price: number;
  auction: boolean;
  /** Each House's sealed bid in Gold, or null. Private until the result. */
  bids: (number | null)[];
}

export type Phase = "founding" | "omens" | "settlement" | "expedition" | "reckoning" | "over";

export interface CampaignOptions {
  /** Flavor shows trait text only; Crunch shows exact numbers (§5.2). */
  display: "flavor" | "crunch";
  length: "full" | "short";
  /** Expedition battles: each House commands its own Scions (the default), or gambits fight them all (the simulator's way). */
  battles?: "hand" | "gambits";
}

export type ItemTier = 1 | 2 | 3 | 4 | 5;

/**
 * One item in the world (§13): a base from content/items.json at a tier and an item level, owned by
 * a House. Scions wear items by id (`Person.gear`); an item not worn sits in its House's stash.
 */
export interface Item {
  id: number;
  base: string;
  /** Crude 1, Common 2, Fine 3, Masterwork 4, Relic 5 (§13.4). */
  tier: ItemTier;
  /** The expedition level it was made for (1–10): scales its power and defense like the enemy block (§14.2). */
  ilvl: number;
  house: number;
  /** Properties by content id with their rolled value (Milestone 2, §13.4). */
  props?: [string, number][];
  /** Quality lost to "dented" results until a Forge repairs it (§13.3). */
  dented?: number;
  cursed?: true;
  /** A named item's content id (§13.4). */
  named?: string;
}

export interface SovState {
  /** State version, for saves. */
  v: 1;
  /** The seeded RNG's state: applyMove has no Rng of its own, so it carries on from here. */
  rng: number;
  opts: CampaignOptions;
  /** Seat order; House i belongs to players[i]. Never saved (saves hold no player ids). */
  players: PlayerId[];
  year: number;
  phase: Phase;
  /** Moves made since the current phase opened; the checkpoint is the phase's first state. */
  phaseMoves: number;
  houses: House[];
  /** Every living recruit, Scion, Retired and Lost person, all Houses together (Wards move between them). */
  people: Person[];
  /** Every item, worn or stashed, all Houses together. */
  items: Item[];
  /** Ids for people and items alike. */
  nextId: number;
  /** The settlement's shared stockpile, fed by the tithe, spent by vote (§8.1), and its shared projects (§8.5). */
  commons: Commons;
  /** Accord with 2+ Houses; Unrest with one (same scale, §3.3). At 0 the campaign is lost. */
  accord: number;
  /** At 100 the city is overwhelmed (§3.3). */
  doom: number;
  timeline: TimelineEntry[];
  /** What the shops and Houses offer this Year. */
  market: Lot[];
  /** Deals on the table this Year. */
  deals: Deal[];
  /** Town events drawn in the Omens and waiting on choices. */
  events: PendingEvent[];
  /** This Year's Crisis, open through the Settlement Phase. */
  crisis?: Crisis;
  /** The vote now open, if any. */
  vote?: Vote;
  /** The Rift Gate's cards this Year and each House's vote for one (§9.1). */
  gate?: { cards: ExpeditionCard[]; votes: (number | null)[] };
  /** The Expedition Phase's party (§9.2). */
  expedition?: Expedition;
  /** The opening recruit draft, between the last oath and Year 1. */
  muster?: Muster;
  /** Houses that proposed a vote this Year: one proposal each a Year. */
  proposers: number[];
  /** Year assignments by person id; kept from Year to Year until changed. Unassigned people idle. */
  assign: Record<number, Assignment>;
  /** Campaign-wide flags set by events, by id. */
  flags: string[];
  /** Recent public happenings, newest last. Not saved. */
  log: string[];
  /** The battles the last move fought, recorded for the battle screen (§15.5); the next move clears them. Not saved. */
  battles?: Replay[];
  /** Hidden: each House's own recent happenings at home (its House events, Q89), newest last. Not saved. */
  notes: string[][];
  /** Set when the campaign ends. */
  outcome?: { won: boolean; reason: string };
  /** The bestiary (§14.3, §14.9), open to every House: kills by enemy id, and each slain quarry's Houses. */
  bestiary: { kills: Partial<Record<string, number>>; quarries: Partial<Record<string, number[]>> };
  /** Hidden: Dark Bargains offered and not yet answered, each seen only by its House; Omens offers made to each House (§14.7a). */
  bargains: { pending: PendingBargain[]; offered: number[] };
}

/** A Dark Bargain waiting on its House's answer (§14.7a). */
export interface PendingBargain {
  house: number;
  id: string;
}

export type SovMove =
  /** House creation (§5.1): change the draft, reroll a step or the whole House, swear with Ambition 0 or 1. */
  | { type: "design"; house: HouseDesign }
  | { type: "random_house"; step?: FoundingStep }
  | { type: "swear"; ambition: 0 | 1 }
  /** The opening draft: take a volunteer, promoted into a base Job. */
  | { type: "muster"; person: number; job: JobId }
  | { type: "seal" }
  /** Vote for one of the Rift Gate's cards (§9.1). */
  | { type: "pick_card"; card: number }
  /** Field your Scions in your seats (fewer declines the rest) and pack the satchel, then vote a Leader (§9.2). */
  | { type: "field"; people: number[]; pack?: Partial<Record<string, number>> }
  | { type: "lead"; person: number }
  /** The Leader's House: on to the next node, or home (§9.9). */
  | { type: "press_on" }
  /** The Scion whose turn it is in battle (fight.ts): a move and an action, or their gambits for the turn or the battle. */
  | ({ type: "command" } & Command)
  /** A House's vote on the waiting event's option (§9.4). */
  | { type: "decide"; option: number; person?: number }
  | { type: "retreat" }
  /** Your House's pick of a share of the haul when the draft comes to it (§9.10). */
  | { type: "draft"; share: number }
  /** Retire a Scion, or bring a Retired one back (§6.12). */
  | { type: "retire"; person: number }
  | { type: "reinstate"; person: number }
  /** Promote a recruit to Scion in a base Job (§6.5). */
  | { type: "promote"; person: number; job: JobId }
  | { type: "unseal" }
  /** Start a House building, or its next level, paying now (§8.3). */
  | { type: "build"; building: string }
  /** Take back a build started this Year, for a full refund. */
  | { type: "unbuild"; building: string }
  /** Pledge Gold and materials to a shared project's next level; public and final (§8.5). */
  | { type: "pledge"; project: string; give: Partial<Record<string, number>> }
  /** Pledge to this Year's Crisis, privately (§3.5). */
  | { type: "crisis_pledge"; give: Partial<Record<string, number>> }
  /** Buy a shop item at its list price (first come), or bid sealed on a lot at auction (§13.4a). */
  | { type: "buy"; item: number }
  | { type: "bid"; item: number; gold: number }
  /** Buy consumables where they are sold: a Commons shop or the House's own building (§13.7). */
  | { type: "buy_consumable"; id: string; n?: number }
  /** Opens the satchel between nodes: a Camp item (on a Scion, for Widow's Tea and the Smuggler's Flask), a Lantern, a Signal Flare (§13.7). */
  | { type: "use_item"; id: string; person?: number }
  /** Spends a Tarot Token in town (§13.7): one Scion draws a new Tarot, once in their life. */
  | { type: "draw_tarot"; person: number }
  /** Gives one Scion a Passive Draught in town (§13.7): passive budget +1 until the Reckoning. */
  | { type: "drink_draught"; person: number }
  /** Put a stashed item up for sealed bids, with a reserve. */
  | { type: "auction"; item: number; reserve: number }
  /** Offer a deal to another House; `open` makes it public (§8.9). */
  | { type: "offer"; to: number; give: DealSide; get: DealSide; open?: boolean }
  /** Accept or decline a deal offered to you, or withdraw your own. */
  | { type: "accept"; deal: number }
  | { type: "decline"; deal: number }
  /** Choose an option of a town event this House decides (`key` as in the view). */
  | { type: "choose"; event: string; option: number }
  /** Answer a Dark Bargain (§14.7a); a bane names its victim. */
  | { type: "bargain"; id: string; accept: boolean; target?: number }
  /** Spend a cure item on one of the House's own (§11.2): the injury it names, else the oldest it mends. */
  | { type: "cure"; item: number; person: number; injury?: string }
  /** Give in to the Crisis's private temptation. */
  | { type: "tempt" }
  /** Propose spending the Commons' stock on a shared project (a vote of the Houses, §8.1). */
  | { type: "propose"; project: string }
  /** Vote on the open question: an index into its options. */
  | { type: "vote"; choice: number }
  /** Ready a Scion in town (§12.1, §13.1): buy an ability, change Job, set the secondary set, a passive, gear. */
  | { type: "learn"; person: number; ability: string }
  | { type: "take_job"; person: number; job: JobId }
  | { type: "secondary"; person: number; job: JobId | null }
  | { type: "passive"; person: number; ability: string; on: boolean }
  | { type: "equip"; person: number; item: number; slot: GearSlot }
  | { type: "unequip"; person: number; slot: GearSlot }
  /** Set a person's Year assignment; "idle" clears it (§8.3). */
  | { type: "assign"; person: number; to: AssignmentKind | "idle"; at?: string; mentor?: number; job?: JobId };
