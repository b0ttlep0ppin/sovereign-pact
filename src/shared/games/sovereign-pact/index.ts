// The Sovereign Pact as a Vibe Pulse GameDefinition (SPEC §4.2): pure functions over JSON state.
// One seat is one Great House. Milestone 0 runs the Year loop with the Settlement Phase's seal; every
// later milestone adds its decisions as moves here.
import type { GameDefinition, GameResult, MoveResult, PlayerId } from "../../game.ts";
import type { Rng } from "../../rng.ts";
import type { TableOption, TableOptions } from "../../table-options.ts";
import { promote, randomHouse, rollRecruit } from "./generate.ts";
import { equipStarter } from "./items.ts";
import { checkpoint, describeSave, restore, type SovSave } from "./save.ts";
import { placements } from "./score.ts";
import { BASE_JOBS, type CampaignOptions, type House, type SovMove, type SovState } from "./state.ts";
import { assign, cannotAssign } from "./assign.ts";
import { botAssign, botBuild } from "./bot.ts";
import { build, cannotBuild, unbuild } from "./town.ts";
import { forHouses, TUNING } from "./tuning.ts";
import { view, type SovView } from "./view.ts";
import { clone, closeSettlement, openYear } from "./year.ts";

export type { SovMove, SovState } from "./state.ts";
export type { SovView } from "./view.ts";
export { restore, type SovSave } from "./save.ts";
export * as Content from "./content.ts";

export const SOVEREIGN_PACT_OPTIONS: readonly TableOption[] = [
  {
    id: "display",
    label: "Trait display",
    description: "Flavor shows traits as evocative text only; Crunch adds their exact numbers.",
    choices: [
      { value: "flavor", label: "Flavor" },
      { value: "crunch", label: "Crunch" },
    ],
    standard: "crunch",
  },
  {
    id: "length",
    label: "Campaign",
    description: "Twenty Years is the full campaign; Short compresses the arc into ten.",
    choices: [
      { value: "full", label: "20 Years" },
      { value: "short", label: "10 Years (Short)" },
    ],
    standard: "full",
  },
];

function readOptions(options?: TableOptions): CampaignOptions {
  return {
    display: options?.display === "flavor" ? "flavor" : "crunch",
    length: options?.length === "short" ? "short" : "full",
  };
}

/** A new campaign: one random House per seat, its starting Scions and recruits (§6.2), Year 1 open. */
export function newCampaign(players: readonly PlayerId[], rng: Rng, opts: CampaignOptions): SovState {
  const H = players.length;
  const houses: House[] = [];
  for (let i = 0; i < H; i++) {
    houses.push(randomHouse(rng, houses.map((h) => h.name), houses.map((h) => h.colors[0]), H));
  }
  const state: SovState = {
    v: 1,
    rng: 0,
    opts,
    players: [...players],
    year: 1,
    phase: "omens",
    phaseMoves: 0,
    houses,
    people: [],
    items: [],
    nextId: 1,
    commons: { gold: 0, stores: {} },
    accord: TUNING.tracks.accordStart,
    doom: TUNING.tracks.doomStart,
    timeline: [],
    assign: {},
    flags: [],
    log: [],
  };
  houses.forEach((_, i) => {
    for (let n = 0; n < forHouses(TUNING.houses.startScions, H); n++) {
      const scion = promote(rollRecruit(rng, state.nextId++, i), rng.pick(BASE_JOBS));
      state.people.push(scion);
      equipStarter(state, scion);
    }
    for (let n = 0; n < forHouses(TUNING.houses.startRecruits, H); n++) {
      state.people.push(rollRecruit(rng, state.nextId++, i));
    }
  });
  const years = TUNING.campaign.years[opts.length];
  for (const year of TUNING.campaign.mandatoryYears[opts.length]) {
    state.timeline.push({ year, id: year === years ? "mandatory_final" : "mandatory" });
  }
  state.rng = rng.int(2 ** 32);
  openYear(state);
  return state;
}

const houseOf = (s: SovState, playerId: PlayerId): number => {
  const i = s.players.indexOf(playerId);
  return i >= 0 && i < s.houses.length ? i : -1;
};

const fail = (error: string): MoveResult<SovState> => ({ ok: false, error });

function isMove(m: unknown): m is SovMove {
  return typeof m === "object" && m !== null && typeof (m as { type?: unknown }).type === "string";
}

export function applyMove(state: SovState, playerId: PlayerId, move: SovMove): MoveResult<SovState> {
  if (!isMove(move)) return fail("That is not a move.");
  const house = houseOf(state, playerId);
  if (house < 0) return fail("You have no House in this campaign.");
  if (state.phase === "over") return fail("The campaign is over.");
  const s = clone(state);
  const h = s.houses[house]!;
  switch (move.type) {
    case "seal": {
      if (s.phase !== "settlement") return fail("Only the Settlement Phase can be sealed.");
      if (h.sealed) return fail("You have already sealed the Year.");
      h.sealed = true;
      s.phaseMoves += 1;
      if (s.houses.every((x) => x.sealed)) closeSettlement(s);
      return { ok: true, state: s };
    }
    case "build": {
      if (s.phase !== "settlement") return fail("Buildings go up in the Settlement Phase.");
      if (h.sealed) return fail("Unseal the Year to build.");
      const why = cannotBuild(s, house, move.building);
      if (why) return fail(why);
      build(s, house, move.building);
      s.phaseMoves += 1;
      return { ok: true, state: s };
    }
    case "unbuild": {
      if (s.phase !== "settlement") return fail("Nothing is being built now.");
      if (h.sealed) return fail("Unseal the Year first.");
      if (!unbuild(s, house, move.building)) return fail("That building is not going up this Year.");
      s.phaseMoves += 1;
      return { ok: true, state: s };
    }
    case "assign": {
      if (s.phase !== "settlement") return fail("Assignments are made in the Settlement Phase.");
      if (h.sealed) return fail("Unseal the Year first.");
      const why = cannotAssign(s, house, move);
      if (why) return fail(why);
      assign(s, move);
      s.phaseMoves += 1;
      return { ok: true, state: s };
    }
    case "unseal": {
      if (s.phase !== "settlement") return fail("There is nothing to unseal now.");
      if (!h.sealed) return fail("You have not sealed the Year.");
      h.sealed = false;
      s.phaseMoves += 1;
      return { ok: true, state: s };
    }
    default:
      return fail(`Unknown move: ${(move as { type: string }).type}.`);
  }
}

export function activePlayers(s: SovState): PlayerId[] {
  if (s.phase !== "settlement") return [];
  return s.houses.flatMap((h, i) => (h.sealed ? [] : [s.players[i]!]));
}

export function result(s: SovState): GameResult | null {
  if (!s.outcome) return null;
  // A co-op loss is a win with no winners; on victory everyone wins and the Sovereign places first (§3.3).
  if (!s.outcome.won) return { kind: "win", winners: [] };
  const places = placements(s);
  return {
    kind: "win",
    winners: [...s.players],
    seats: Object.fromEntries(s.players.map((p, i) => [p, { placement: places[i] }])),
  };
}

export function describeResult(s: SovState): string | null {
  if (!s.outcome) return null;
  if (!s.outcome.won) return s.outcome.reason;
  const places = placements(s);
  const sovereigns = s.houses.filter((_, i) => places[i] === 1).map((h) => `House ${h.name}`);
  return `${s.outcome.reason} ${sovereigns.join(" and ")} ${sovereigns.length > 1 ? "share" : "takes"} the throne.`;
}

/** The settlement bot is cautious (HANDOFF §3.4): it builds what it can afford by its plan, then seals. */
export function botMove(s: SovState, playerId: PlayerId): SovMove {
  const house = houseOf(s, playerId);
  if (house >= 0 && s.phase === "settlement" && !s.houses[house]!.sealed) {
    const job = botAssign(s, house);
    if (job) return { type: "assign", ...job };
    const next = botBuild(s, house);
    if (next) return { type: "build", building: next };
  }
  return { type: "seal" };
}

export const sovereignPact: GameDefinition<SovState, SovMove, SovView, SovSave> = {
  id: "sovereign-pact",
  options: SOVEREIGN_PACT_OPTIONS,
  setup(players, rng, _picks, options, save) {
    return (save !== undefined && restore(save, players)) || newCampaign(players, rng, readOptions(options));
  },
  applyMove,
  activePlayers,
  result,
  describeResult,
  view,
  botMove,
  timeoutMove: (s, playerId) => botMove(s, playerId),
  passiveMoves: (s, playerId) => {
    const house = houseOf(s, playerId);
    return s.phase === "settlement" && house >= 0 && s.houses[house]!.sealed ? ["unseal"] : [];
  },
  checkpoint,
  describeSave,
};
