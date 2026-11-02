// What one seat may see (§4.2, §15.7). This is the only place hidden information is filtered: exact
// Ascendancy and its categories, the Ambition, another House's Treasury, Stores and recruit pool, a
// recruit's unrevealed potential, Ward Loyalty, and Pact marks (which no House ever sees, §14.7a).
import type { PlayerId } from "../../game.ts";
import { dealsFor } from "./deals.ts";
import { secretEvent } from "./events.ts";
import { marketFor } from "./market.ts";
import { eventsFor } from "./omens.ts";
import { fallen } from "./lifecycle.ts";
import { timelineFor } from "./timeline.ts";
import { ascendancy, categories, standing } from "./score.ts";
import type {
  Expedition,
  Ambition,
  Assignment,
  ChronicleEntry,
  Deal,
  Element,
  Emblem,
  GearSlot,
  House,
  Injury,
  Item,
  JobId,
  Lot,
  Person,
  PersonStatus,
  PendingEvent,
  Phase,
  Score,
  Six,
  SovState,
  StandingTier,
  Stores,
} from "./state.ts";
import { campaignYears, mandatoryYears, trackName } from "./year.ts";

/** Another House as everyone sees it. */
export interface PublicHouse {
  index: number;
  name: string;
  motto: string;
  colors: [string, string];
  emblem: Emblem;
  seat: string;
  element: Element | null;
  traits: string[];
  buildings: House["buildings"];
  /** Buildings going up this Year: scaffolding on the Town Map is public. */
  works: string[];
  chronicle: ChronicleEntry[];
  standing: StandingTier;
  /** No Scions, recruits or Retired left (§6.13): its district goes dark. */
  fallen: boolean;
  sealed: boolean;
}

/** What only the House itself sees. */
export interface PrivateHouse {
  ambition: Ambition;
  score: Score;
  ascendancy: number;
  gold: number;
  debt: number;
  stores: Stores;
  /** The Scriptorium's level: how much of a recruit shows (§6.4). */
  insight: number;
  /** This House's own Crisis pledge, and whether it gave in to the temptation. */
  crisis: { pledge: Partial<Record<string, number>>; tempted: boolean } | null;
  /** This House's Year assignments, by person id (§8.3). */
  assign: Record<number, Assignment>;
  /** What happened at home: this House's own events and their outcomes (Q89), newest last. */
  notes: string[];
  /** At founding: the two Ambitions dealt, to keep one (§5.1 step 7). */
  dealt: [Ambition, Ambition] | null;
}

/**
 * A person as the viewer sees them. Everyone sees Scions and the Retired (they fight side by side);
 * recruits show only to their own House, and only as far as its Insight reaches (§6.4).
 */
export interface PersonView {
  /** A Ward's Loyalty, for its host with Insight 3 only (§6.9). */
  loyalty?: number;
  id: number;
  status: PersonStatus;
  house: number;
  host: number;
  name: string;
  sex: "f" | "m";
  look: string[];
  age: number;
  level: number;
  job: JobId | null;
  traits: string[];
  injuries: Injury[];
  /** Pools follow from the stats, so a recruit's show from Insight 1, like its stats. */
  sanity?: number;
  mp?: number;
  /** Insight 1+ for recruits. */
  base?: Six;
  potential?: Person["potential"];
  /** Insight 2+ for recruits; always for the viewer's own Scions. */
  growth?: Six;
  /** Face-up once promoted (§6.5); Insight 3 for recruits. */
  tarot?: string;
  /** Worn items by slot (ids into `SovView.items`); Scions and the Retired only. */
  gear?: Partial<Record<GearSlot, number>>;
}

export interface SovView {
  /** The viewer's House, or null for a spectator. */
  me: number | null;
  year: number;
  years: number;
  mandatoryYears: readonly number[];
  phase: Phase;
  display: SovState["opts"]["display"];
  track: "Accord" | "Unrest";
  accord: number;
  doom: number;
  commons: SovState["commons"];
  /** This Year's Crisis: its Need is public, every pledge private (§3.5). */
  crisis: { id: string; need: Partial<Record<string, number>> } | null;
  /** This Year's shop stock and House lots; the viewer's own bids only (§13.4a). */
  market: Lot[];
  /** Deals the viewer may see: its own, those offered to it, and public ones. */
  deals: Deal[];
  /** The Rift Gate's cards this Year and the Houses' votes. */
  gate: SovState["gate"] | null;
  /** The Year's party: seats, who each House fielded, the Leader vote (all open); of the chain, only the nodes passed and its length. */
  expedition: (Expedition & { length: number }) | null;
  /** Town events waiting on choices; a secret one shows others' choices only as made (-1) or not. */
  events: PendingEvent[];
  /** The open vote, cast in the open (§8.1). */
  vote: SovState["vote"] | null;
  /** Hidden entries show only their Year, unless a Watchtower or the Observatory reveals them. */
  timeline: { year: number; id: string; house?: number }[];
  houses: PublicHouse[];
  mine: PrivateHouse | null;
  people: PersonView[];
  /** Items the viewer may see: everything a visible person wears, and their own House's stash. */
  items: Item[];
  log: string[];
  outcome: SovState["outcome"] | null;
}

function publicHouse(s: SovState, h: House, index: number): PublicHouse {
  return {
    index,
    name: h.name,
    motto: h.motto,
    colors: h.colors,
    emblem: h.emblem,
    seat: h.seat,
    element: h.element,
    traits: h.traits,
    buildings: h.buildings,
    works: h.works,
    chronicle: h.chronicle,
    standing: standing(s, index),
    fallen: fallen(s, index),
    sealed: h.sealed,
  };
}

function personView(p: Person, viewer: number | null, insight: number): PersonView | null {
  const own = viewer !== null && p.host === viewer;
  if (p.status === "recruit" && !own) return null;
  const v: PersonView = {
    id: p.id,
    status: p.status,
    house: p.house,
    host: p.host,
    name: p.name,
    sex: p.sex,
    look: p.look,
    age: p.age,
    level: p.level,
    job: p.job,
    // Insight 0 shows one trait (§6.4); a Scion shows them all.
    traits: p.status === "recruit" && insight < 2 ? p.traits.slice(0, 1) : p.traits,
    injuries: p.injuries,
  };
  if (p.status !== "recruit" || insight >= 1) {
    v.sanity = p.sanity;
    v.mp = p.mp;
  }
  // A host with Insight 3 reads its Wards' Loyalty (§6.9); no one else does.
  if (own && insight >= 3 && p.loyalty !== undefined) v.loyalty = p.loyalty;
  if (p.status !== "recruit") {
    v.base = p.base;
    v.tarot = p.tarot;
    v.gear = p.gear;
    if (own) v.growth = p.growth;
    return v;
  }
  if (insight >= 1) {
    v.base = p.base;
    v.potential = p.potential;
  }
  if (insight >= 2) v.growth = p.growth;
  if (insight >= 3) v.tarot = p.tarot;
  return v;
}

export function view(s: SovState, playerId: PlayerId): SovView {
  const seat = s.players.indexOf(playerId);
  const me = seat >= 0 && seat < s.houses.length ? seat : null;
  const own = me === null ? null : s.houses[me]!;
  const insight = own?.buildings.scriptorium ?? 0;
  const people = s.people.flatMap((p) => personView(p, me, insight) ?? []);
  const worn = new Set(people.flatMap((p) => Object.values(p.gear ?? {})));
  const wornByAnyone = new Set(s.people.flatMap((p) => Object.values(p.gear)));
  return {
    me,
    year: s.year,
    years: campaignYears(s),
    mandatoryYears: mandatoryYears(s),
    phase: s.phase,
    display: s.opts.display,
    track: trackName(s),
    accord: s.accord,
    doom: s.doom,
    commons: s.commons,
    vote: s.vote ?? null,
    events: eventsFor(s, me),
    // The Gate's cards and votes are open: the Houses argue over them in public (§9.1).
    gate: s.gate ?? null,
    // §9.3: the chain's shape is unknown until walked.
    expedition: s.expedition ? expeditionView(s.expedition, me) : null,
    deals: dealsFor(s, me),
    market: marketFor(s, me),
    crisis: s.crisis ? { id: s.crisis.id, need: s.crisis.need } : null,
    timeline: timelineFor(s, me),
    houses: s.houses.map((h, i) => publicHouse(s, h, i)),
    mine:
      me === null || !own
        ? null
        : {
            ambition: own.ambition,
            score: categories(s, me),
            ascendancy: ascendancy(s, me),
            gold: own.gold,
            debt: own.debt,
            stores: own.stores,
            insight,
            crisis: s.crisis ? { pledge: s.crisis.pledges[me]!, tempted: s.crisis.tempted[me]! } : null,
            notes: s.notes[me] ?? [],
            dealt: own.dealt ?? null,
            assign: Object.fromEntries(s.people.filter((p) => p.host === me && s.assign[p.id]).map((p) => [p.id, s.assign[p.id]!])),
          },
    people,
    items: s.items.filter((i) => worn.has(i.id) || (me !== null && i.house === me && !wornByAnyone.has(i.id))),
    log: s.log,
    outcome: s.outcome ?? null,
  };
}

/**
 * The expedition as everyone sees it: only the nodes passed, the chain's length, and the haul drafted
 * blind, its items' properties hidden until identified (§13.4: Identify comes with the Scriptorium).
 */
function expeditionView(e: Expedition, me: number | null): Expedition & { length: number } {
  const v = { ...e, chain: e.chain.slice(0, e.at), length: e.chain.length };
  // A secret event's picks stay hidden until all are in (§9.4): another House's shows only as chosen (-2).
  if (e.event && secretEvent(e.event.id)) v.event = { ...e.event, votes: e.event.votes.map((x, h) => (x === null || x === -1 || h === me ? x : -2)) };
  const blind = (i: Item): Item => {
    const seen = { ...i };
    delete seen.props;
    return seen;
  };
  if (e.haul) v.haul = { ...e.haul, items: e.haul.items.map(blind) };
  if (e.pool) v.pool = e.pool.map((x) => (x.item ? { ...x, item: blind(x.item) } : x));
  return v;
}
