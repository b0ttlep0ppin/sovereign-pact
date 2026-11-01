// What one seat may see (§4.2, §15.7). This is the only place hidden information is filtered: exact
// Ascendancy and its categories, the Ambition, another House's Treasury, Stores and recruit pool, a
// recruit's unrevealed potential, Ward Loyalty, and Pact marks (which no House ever sees, §14.7a).
import type { PlayerId } from "../../game.ts";
import { ascendancy, categories, standing } from "./score.ts";
import type {
  Ambition,
  Assignment,
  ChronicleEntry,
  Element,
  Emblem,
  GearSlot,
  House,
  Injury,
  Item,
  JobId,
  Person,
  PersonStatus,
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
  /** This House's Year assignments, by person id (§8.3). */
  assign: Record<number, Assignment>;
}

/**
 * A person as the viewer sees them. Everyone sees Scions and the Retired (they fight side by side);
 * recruits show only to their own House, and only as far as its Insight reaches (§6.4).
 */
export interface PersonView {
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
  /** Hidden entries show only their Year. */
  timeline: { year: number; id: string }[];
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
    timeline: s.timeline.map((t) => ({ year: t.year, id: t.hidden ? "?" : t.id })),
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
            assign: Object.fromEntries(s.people.filter((p) => p.host === me && s.assign[p.id]).map((p) => [p.id, s.assign[p.id]!])),
          },
    people,
    items: s.items.filter((i) => worn.has(i.id) || (me !== null && i.house === me && !wornByAnyone.has(i.id))),
    log: s.log,
    outcome: s.outcome ?? null,
  };
}
