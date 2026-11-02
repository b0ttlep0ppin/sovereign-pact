// What one seat may see (§4.2, §15.7). This is the only place hidden information is filtered: exact
// Ascendancy and its categories, the Ambition, another House's Treasury, Stores and recruit pool, a
// recruit's unrevealed potential, Ward Loyalty, and Pact marks (which no House ever sees, §14.7a).
import type { PlayerId } from "../../game.ts";
import type { Replay } from "./combat/replay.ts";
import { dealsFor } from "./deals.ts";
import { secretEvent } from "./events.ts";
import { fightView, type FightView } from "./fight.ts";
import { marketFor, priceFor } from "./market.ts";
import { cannotDrawTarot, cannotDrinkDraught, consumablePrice, forSale } from "./consumables.ts";
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
import { kitOf, type Kit } from "./outfit.ts";
import { BUILDINGS, PROJECTS } from "./content.ts";
import { built, projectCost, stillNeeded } from "./commons.ts";
import { buildCost, cannotBuild, levelOf } from "./town.ts";
import { cannotPropose } from "./votes.ts";
import { cannotOpen } from "./satchel.ts";
import { ceremonies } from "./promotion.ts";
import { cureOf, mends } from "./cures.ts";
import { stash } from "./items.ts";
import { TUNING } from "./tuning.ts";
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
  /** Pact marks (§14.7a): hidden from everyone, the House too, until the campaign is over. */
  pactMarks?: number;
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
  /** Consumables held at home (§13.7). */
  consumables: Partial<Record<string, number>>;
  /** The consumables this House can buy now, at its price (§13.7). */
  shop: { id: string; price: number }[];
  /** Each building it could raise: the next level, what it costs (null at the top), and why it cannot, if so (§8.2). */
  builds: { id: string; level: number; cost: Partial<Record<string, number>> | null; why: string | null }[];
  /** The Commons' projects open now: the next level, what it still needs, and why this House cannot propose spending on it, if so (§8.5, §8.1). */
  projects: { id: string; level: number; need: Partial<Record<string, number>>; propose: string | null }[];
  /** Promotions this Year (§6.5): what one costs, and how many ceremonies are left. */
  promotion: { gold: number; left: number };
  /** Cure items in the stash and whom each can mend, with the injuries it mends (§9.8). */
  cures: { item: number; person: number; injuries: string[] }[];
  /** Scions who may draw a new Tarot, or drink a Passive Draught, from what the House holds (§13.7). */
  tarot: number[];
  draught: number[];
  /** The Scriptorium's level: how much of a recruit shows (§6.4). */
  insight: number;
  /** This House's own Crisis pledge, and whether it gave in to the temptation. */
  crisis: { pledge: Partial<Record<string, number>>; tempted: boolean } | null;
  /** This House's Year assignments, by person id (§8.3). */
  assign: Record<number, Assignment>;
  /** What happened at home: this House's own events and their outcomes (Q89), newest last. */
  notes: string[];
  /** Dark Bargains offered to this House and not yet answered, by content id (§14.7a). */
  bargains: string[];
  /** The element that hates the House, if it took Elemental Bane (§5.7). */
  bane: Element | null;
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
  /** The Change they have undergone (§9.6), for all to see; never the body it replaced. */
  change?: string;
  /** Worn items by slot (ids into `SovView.items`); Scions and the Retired only. */
  gear?: Partial<Record<GearSlot, number>>;
  /** Jobs, JP, abilities, passives and the gear that fits: the host House's own Scions and Retired only. */
  kit?: Kit;
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
  /** This Year's shop stock and House lots; the viewer's own bids only (§13.4a); `cost` is a shop lot's price to the viewer. */
  market: (Lot & { cost?: number })[];
  /** Deals the viewer may see: its own, those offered to it, and public ones. */
  deals: Deal[];
  /** The Rift Gate's cards this Year and the Houses' votes. */
  gate: SovState["gate"] | null;
  /** The Year's party: seats, who each House fielded, the Leader vote (all open); of the chain, only the nodes passed and its length. */
  expedition: ExpeditionView | null;
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
  /** The bestiary: kills by enemy and the slain quarries, open to every House (§14.3). */
  bestiary: SovState["bestiary"];
  /** What the viewer's House may open from the satchel now (§13.7), and on whom when it needs a Scion named. */
  opens: { id: string; people: number[] | null }[];
  /** The battles the last move fought, to play back (§15.5); `key` tells a new one from one already seen. */
  battles: (Replay & { key: string })[];
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
    ...(s.phase === "over" ? { pactMarks: h.pactMarks } : {}),
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
  if (p.change) v.change = p.change.id;
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
  const people = s.people.flatMap((p) => {
    const v = personView(p, me, insight);
    if (v && me !== null && p.host === me && (p.status === "scion" || p.status === "retired")) v.kit = kitOf(s, me, p);
    return v ?? [];
  });
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
    expedition: s.expedition ? expeditionView(s, s.expedition, me) : null,
    opens: me === null ? [] : opensFor(s, me),
    deals: dealsFor(s, me),
    // A shop lot's price to the viewer (its discount, §5.7); sealed lots show their reserve.
    market: marketFor(s, me).map((l) => (me !== null && l.shop !== null && !l.auction ? { ...l, cost: priceFor(s, me, l) } : l)),
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
            consumables: own.consumables ?? {},
            shop: forSale(s, me).map((d) => ({ id: d.id, price: consumablePrice(s, me, d) })),
            builds: BUILDINGS.map((b) => {
              const level = levelOf(own, b.id) + 1;
              return { id: b.id, level, cost: buildCost(b.id, level, own), why: own.works.includes(b.id) ? null : cannotBuild(s, me, b.id) };
            }),
            projects: PROJECTS.filter((x) => projectCost(s, x.id)).map((x) => ({
              id: x.id,
              level: built(s, x.id) + 1,
              need: stillNeeded(s, x.id),
              propose: s.proposers.includes(me) ? "You have made your proposal for this Year." : cannotPropose(s, x.id),
            })),
            promotion: { gold: TUNING.promotion.gold, left: Math.max(0, ceremonies(s, me) - (own.promotions ?? 0)) },
            cures: stash(s, me).flatMap((it) =>
              cureOf(it)
                ? s.people.filter((p) => p.host === me && p.status !== "lost" && mends(it, p).length).map((p) => ({ item: it.id, person: p.id, injuries: mends(it, p) }))
                : [],
            ),
            tarot: s.people.filter((p) => !cannotDrawTarot(s, me, p.id)).map((p) => p.id),
            draught: s.people.filter((p) => !cannotDrinkDraught(s, me, p.id)).map((p) => p.id),
            insight,
            crisis: s.crisis ? { pledge: s.crisis.pledges[me]!, tempted: s.crisis.tempted[me]! } : null,
            notes: s.notes[me] ?? [],
            // Dark Bargains offered to this House alone (§14.7a).
            bargains: s.bargains.pending.filter((b) => b.house === me).map((b) => b.id),
            bane: own.bane ?? null,
            dealt: own.dealt ?? null,
            assign: Object.fromEntries(s.people.filter((p) => p.host === me && s.assign[p.id]).map((p) => [p.id, s.assign[p.id]!])),
          },
    people,
    items: s.items.filter((i) => worn.has(i.id) || (me !== null && i.house === me && !wornByAnyone.has(i.id))),
    log: s.log,
    outcome: s.outcome ?? null,
    // The bestiary opens for every House (§14.3).
    bestiary: s.bestiary,
    // Every House watches every battle, Sorties too: the log already tells them all.
    battles: (s.battles ?? []).map((b, i) => ({ ...b, key: `${s.year}:${b.seed}:${i}` })),
  };
}

/**
 * The expedition as everyone sees it: only the nodes passed, the chain's length, and the haul drafted
 * blind, its items' properties hidden until identified (§13.4: Identify comes with the Scriptorium).
 */
/** Each kind in the satchel the House may open now: alone, or naming one of the Scions it may go to. */
function opensFor(s: SovState, me: number): SovView["opens"] {
  const ids = [...new Set((s.expedition?.satchel ?? []).map((x) => x.id))];
  return ids.flatMap((id): SovView["opens"] => {
    if (!cannotOpen(s, me, { id })) return [{ id, people: null }];
    const people = s.people.filter((p) => !cannotOpen(s, me, { id, person: p.id })).map((p) => p.id);
    return people.length ? [{ id, people }] : [];
  });
}

export type ExpeditionView = Omit<Expedition, "fight"> & { length: number; fight: FightView | null };

function expeditionView(s: SovState, e: Expedition, me: number | null): ExpeditionView {
  const rest: Omit<Expedition, "fight"> = { ...e };
  delete (rest as Expedition).fight;
  const v: ExpeditionView = { ...rest, chain: e.chain.slice(0, e.at), length: e.chain.length, fight: fightView(s, me) };
  // A 2×4 card's other party's way shows only as far as it has walked.
  if (e.split) v.split = { ...e.split, chains: e.split.chains.map((c, i) => c.slice(0, e.split!.at[i])) as typeof e.split.chains };
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
