// The Sovereign Pact as a Vibe Pulse GameDefinition (SPEC §4.2): pure functions over JSON state.
// One seat is one Great House. Milestone 0 runs the Year loop with the Settlement Phase's seal; every
// later milestone adds its decisions as moves here.
import { cannotPost, post } from "./formation.ts";
import { cannotRestyle, restyle } from "./style.ts";
import type { GameDefinition, GameResult, MoveResult, PlayerId } from "../../game.ts";
import { TOWN_EVENT_BY_ID } from "./content.ts";
import type { Rng } from "../../rng.ts";
import type { TableOption, TableOptions } from "../../table-options.ts";
import { botFounding, cannotDesign, cannotSwear, design, draftHouse, reroll, swear } from "./founding.ts";
import { botMuster, cannotMuster, muster, musterTurn, type BaseJob } from "./muster.ts";
import { checkpoint, describeSave, restore, type SovSave } from "./save.ts";
import { placements } from "./score.ts";
import { BASE_JOBS, type CampaignOptions, type House, type SovMove, type SovState } from "./state.ts";
import { assign, cannotAssign } from "./assign.ts";
import { cannotPledge, pledge } from "./commons.ts";
import { cannotChoose, choose } from "./omens.ts";
import { bid, botSell, botShop, buy, cannotAuction, cannotBid, cannotBuy, cannotSell, putUp, sell } from "./market.ts";
import { accept, cannotAccept, cannotDecline, cannotOffer, decline, offer } from "./deals.ts";
import { cannotCrisisPledge, cannotTempt, crisisPledge, tempt } from "./crisis.ts";
import { cannotPropose, cannotVote, castVote, owed, propose } from "./votes.ts";
import { botDeal, botAssign, botPromote, botBuild, botChoice, botCrisis, botPledge, botPropose, botTarget, botVote } from "./bot.ts";
import { build, cannotBuild, unbuild } from "./town.ts";
import { cannotPromote, promoteRecruit } from "./promotion.ts";
import { botOutfit, cannotOutfit, outfit } from "./outfit.ts";
import { bargain, botBargain, cannotBargain } from "./bargains.ts";
import { botCure, cannotCure, cure } from "./cures.ts";
import { botBuyConsumable, botPack, buyConsumable, cannotBuyConsumable, cannotDrawTarot, cannotDrinkDraught, cannotPack, drawTarot, drinkDraught, pack } from "./consumables.ts";
import { botOpen, cannotOpen, open } from "./satchel.ts";
import { cannotReinstate, cannotRetire, reinstate, retire } from "./lifecycle.ts";
import { botCard, cannotPick, pick } from "./gate.ts";
import { TUNING } from "./tuning.ts";
import { view, type SovView } from "./view.ts";
import { clone, closeExpedition, closeSettlement } from "./year.ts";
import { botPress, cannotRetreat, home, pressOn } from "./journey.ts";
import { cannotCommand, command } from "./fight.ts";
import { botDecide, botPicksFor, cannotDecide, decide } from "./events.ts";
import { botDraft, cannotDraft, draftPick } from "./loot.ts";
import { botField, botLeader, cannotField, cannotLead, field, voteLeader, waiting } from "./expedition.ts";

export type { SovMove, SovState } from "./state.ts";
export { ELEMENTS, MATERIALS } from "./state.ts";
export type { SovView } from "./view.ts";
export { restore, type SovSave } from "./save.ts";
export * as Content from "./content.ts";
export { itemName, TIER_NAMES } from "./loot.ts";
export { nominable } from "./events.ts";
export { FLAG, replayLine, type Replay, type ReplayUnit, type Vitals } from "./combat/replay.ts";
export { meta as statusMeta } from "./combat/status.ts";
export { TUNING } from "./tuning.ts";
export type { Aim, Choice, ComboMove, ComboView, Command, FightView, TurnView } from "./fight.ts";
export { fitsPattern } from "./combat/combos.ts";
export type { Cell } from "./combat/types.ts";
export { areaCells } from "./combat/grid.ts";
export { deploy } from "./formation.ts";
export { BEARDS, HEADWEAR, HAIR_COLORS, HAIR_LONG, HAIR_SHORT, HAIR_STYLES, styleOf } from "./style.ts";

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
  {
    id: "battles",
    label: "Battles",
    description: "Command each of your Scions' turns in expedition battles, or let their gambits fight every battle.",
    choices: [
      { value: "hand", label: "Command" },
      { value: "gambits", label: "Gambits" },
    ],
    standard: "hand",
  },
];

function readOptions(options?: TableOptions): CampaignOptions {
  return {
    display: options?.display === "flavor" ? "flavor" : "crunch",
    length: options?.length === "short" ? "short" : "full",
    battles: options?.battles === "gambits" ? "gambits" : "hand",
  };
}

/** A new campaign: one Random House draft per seat to found (§5.1); Year 1 opens when all have sworn. */
export function newCampaign(players: readonly PlayerId[], rng: Rng, opts: CampaignOptions): SovState {
  const H = players.length;
  const houses: House[] = [];
  for (let i = 0; i < H; i++) houses.push(draftHouse(rng, houses, H));
  const state: SovState = {
    v: 1,
    rng: 0,
    opts,
    players: [...players],
    year: 1,
    phase: "founding",
    phaseMoves: 0,
    houses,
    people: [],
    items: [],
    nextId: 1,
    commons: { gold: 0, stores: {}, built: Object.fromEntries(TUNING.shops.openAtStart.map((id) => [id, 1])), funds: {} },
    accord: TUNING.tracks.accordStart,
    doom: TUNING.tracks.doomStart,
    timeline: [],
    assign: {},
    proposers: [],
    events: [],
    bargains: { pending: [], offered: houses.map(() => 0) },
    bestiary: { kills: {}, quarries: {} },
    deals: [],
    market: [],
    flags: [],
    log: [],
    notes: houses.map(() => []),
  };
  const years = TUNING.campaign.years[opts.length];
  for (const year of TUNING.campaign.mandatoryYears[opts.length]) {
    state.timeline.push({ year, id: year === years ? "mandatory_final" : "mandatory" });
  }
  state.rng = rng.int(2 ** 32);
  state.log.push("The Houses gather to swear the Pact.");
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
  // The last move's battle replays are the screen's to keep, not the state's (they are large).
  const s = clone({ ...state, battles: undefined });
  const h = s.houses[house]!;
  // Who is playing a seat, a bot or a person, is told by the move itself (botMove marks its own).
  const seats = new Set(s.botSeats ?? []);
  if ((move as { bot?: true }).bot) seats.add(house);
  else seats.delete(house);
  s.botSeats = [...seats].sort();
  if (s.phase === "founding" && !["design", "random_house", "swear", "unseal", "muster"].includes(move.type)) return fail("Found your House first.");
  if (s.expedition?.fight && move.type !== "command") return fail("A battle is being fought.");
  switch (move.type) {
    case "design": {
      if (s.phase !== "founding") return fail("Your House is already founded.");
      if (h.sealed) return fail("You have sworn the Pact; take back your oath to change your House.");
      const why = cannotDesign(s, house, move.house ?? {});
      if (why) return fail(why);
      design(s, house, move.house);
      return { ok: true, state: s };
    }
    case "random_house": {
      if (s.phase !== "founding") return fail("Your House is already founded.");
      if (h.sealed) return fail("You have sworn the Pact; take back your oath to change your House.");
      if (move.step !== undefined && !["name", "colors", "emblem", "seat", "element", "traits"].includes(move.step)) return fail("There is no such step.");
      reroll(s, house, move.step);
      return { ok: true, state: s };
    }
    case "swear": {
      if (s.phase !== "founding") return fail("The Pact is already sworn.");
      if (h.sealed) return fail("You have already sworn the Pact.");
      const why = cannotSwear(s, house, move.ambition);
      if (why) return fail(why);
      swear(s, house, move.ambition);
      return { ok: true, state: s };
    }
    case "muster": {
      const why = cannotMuster(s, house, move.person, move.job);
      if (why) return fail(why);
      muster(s, house, move.person, move.job as BaseJob);
      return { ok: true, state: s };
    }
    case "seal": {
      if (s.phase !== "settlement") return fail("Only the Settlement Phase can be sealed.");
      if (h.sealed) return fail("You have already sealed the Year.");
      const due = owed(s, house);
      if (due) return fail(due);
      h.sealed = true;
      s.phaseMoves += 1;
      if (s.houses.every((x) => x.sealed)) closeSettlement(s);
      return { ok: true, state: s };
    }
    case "post": {
      const why = cannotPost(s, house, move);
      if (why) return fail(why);
      post(s, house, move);
      return { ok: true, state: s };
    }
    case "restyle": {
      const why = cannotRestyle(s, house, move);
      if (why) return fail(why);
      restyle(s, move);
      return { ok: true, state: s };
    }
    case "retire":
    case "reinstate": {
      if (s.phase !== "settlement") return fail("That is done in the Settlement Phase.");
      if (h.sealed) return fail("Unseal the Year first.");
      const why = move.type === "retire" ? cannotRetire(s, house, move.person) : cannotReinstate(s, house, move.person);
      if (why) return fail(why);
      (move.type === "retire" ? retire : reinstate)(s, move.person);
      s.phaseMoves += 1;
      return { ok: true, state: s };
    }
    case "pick_card": {
      if (s.phase !== "settlement") return fail("The Rift Gate is chosen in the Settlement Phase.");
      if (h.sealed) return fail("Unseal the Year first.");
      const why = cannotPick(s, move.card);
      if (why) return fail(why);
      pick(s, house, move.card);
      s.phaseMoves += 1;
      return { ok: true, state: s };
    }
    case "field":
    case "lead": {
      if (s.phase !== "expedition") return fail("The party is chosen in the Expedition Phase.");
      const why = move.type === "field" ? (cannotField(s, house, move.people) ?? cannotPack(s, house, move.people.length, move.pack)) : cannotLead(s, house, move.person);
      if (why) return fail(why);
      if (move.type === "field") {
        pack(s, house, move.pack);
        field(s, house, move.people);
      }
      else voteLeader(s, house, move.person);
      s.phaseMoves += 1;
      if (!waiting(s).length) closeExpedition(s);
      return { ok: true, state: s };
    }
    case "decide": {
      if (s.phase !== "expedition") return fail("No event waits on the party.");
      const why = cannotDecide(s, house, move.option, move.person);
      if (why) return fail(why);
      decide(s, house, move.option, move.person);
      s.phaseMoves += 1;
      if (!waiting(s).length) closeExpedition(s);
      return { ok: true, state: s };
    }
    case "draft": {
      if (s.phase !== "expedition") return fail("Nothing is being drafted.");
      const why = cannotDraft(s, house, move.share);
      if (why) return fail(why);
      draftPick(s, house, move.share);
      s.phaseMoves += 1;
      if (!waiting(s).length) closeExpedition(s);
      return { ok: true, state: s };
    }
    case "command": {
      if (s.phase !== "expedition") return fail("No battle is being fought.");
      const c = { ...(move.move ? { move: move.move } : {}), ...(move.action ? { action: move.action } : {}), ...(move.auto ? { auto: move.auto } : {}), ...(move.dice ? { dice: move.dice } : {}) };
      const why = cannotCommand(s, house, c) ?? command(s, house, c);
      if (why) return fail(why);
      s.phaseMoves += 1;
      if (!waiting(s).length) closeExpedition(s);
      return { ok: true, state: s };
    }
    case "onward": {
      const e = s.expedition;
      if (s.phase !== "expedition" || !e?.halt?.includes(house)) return fail("Nothing waits on you to go on.");
      e.halt = e.halt.filter((h) => h !== house);
      if (!e.halt.length) delete e.halt;
      s.phaseMoves += 1;
      return { ok: true, state: s };
    }
    case "press_on":
    case "retreat": {
      const e = s.expedition;
      if (s.phase !== "expedition" || e?.leader === undefined || e.result) return fail("No expedition is underway.");
      if (e.event) return fail("The party must decide what to do first.");
      if (e.halt?.length) return fail(`The party waits for ${e.halt.map((h) => `House ${s.houses[h]!.name}`).join(" and ")} to take in what happened.`);
      if (s.bargains.pending.length) return fail("The party waits while each House looks into the Gate.");
      if (s.people.find((p) => p.id === e.leader)!.host !== house) return fail("The Leader's House decides the way.");
      if (move.type === "retreat") {
        const why = cannotRetreat(s);
        if (why) return fail(why);
        home(s, "retreated");
      } else pressOn(s);
      s.phaseMoves += 1;
      if (!waiting(s).length) closeExpedition(s);
      return { ok: true, state: s };
    }
    case "promote": {
      if (s.phase !== "settlement") return fail("Promotions are held in the Settlement Phase.");
      if (h.sealed) return fail("Unseal the Year first.");
      const why = cannotPromote(s, house, move.person, move.job);
      if (why) return fail(why);
      promoteRecruit(s, house, move.person, move.job as (typeof BASE_JOBS)[number]);
      s.phaseMoves += 1;
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
    case "pledge": {
      if (s.phase !== "settlement") return fail("Pledges are made in the Settlement Phase.");
      if (h.sealed) return fail("Unseal the Year first.");
      const why = cannotPledge(s, house, move.project, move.give ?? {});
      if (why) return fail(why);
      pledge(s, house, move.project, move.give);
      s.phaseMoves += 1;
      return { ok: true, state: s };
    }
    case "crisis_pledge": {
      if (s.phase !== "settlement") return fail("Pledges are made in the Settlement Phase.");
      if (h.sealed) return fail("Unseal the Year first.");
      const why = cannotCrisisPledge(s, house, move.give ?? {});
      if (why) return fail(why);
      crisisPledge(s, house, move.give);
      s.phaseMoves += 1;
      return { ok: true, state: s };
    }
    case "buy": {
      if (s.phase !== "settlement") return fail("The shops open in the Settlement Phase.");
      if (h.sealed) return fail("Unseal the Year first.");
      const why = cannotBuy(s, house, move.item);
      if (why) return fail(why);
      buy(s, house, move.item);
      s.phaseMoves += 1;
      return { ok: true, state: s };
    }
    case "draw_tarot": {
      if (s.phase !== "settlement") return fail("A Tarot Token is spent in town, in the Settlement Phase.");
      if (h.sealed) return fail("Unseal the Year first.");
      const why = cannotDrawTarot(s, house, move.person);
      if (why) return fail(why);
      drawTarot(s, house, move.person);
      s.phaseMoves += 1;
      return { ok: true, state: s };
    }
    case "drink_draught": {
      if (s.phase !== "settlement") return fail("A Passive Draught is drunk in town, in the Settlement Phase.");
      if (h.sealed) return fail("Unseal the Year first.");
      const why = cannotDrinkDraught(s, house, move.person);
      if (why) return fail(why);
      drinkDraught(s, house, move.person);
      s.phaseMoves += 1;
      return { ok: true, state: s };
    }
    case "use_item": {
      const why = cannotOpen(s, house, move);
      if (why) return fail(why);
      open(s, move);
      s.phaseMoves += 1;
      return { ok: true, state: s };
    }
    case "buy_consumable": {
      if (s.phase !== "settlement") return fail("The shops open in the Settlement Phase.");
      if (h.sealed) return fail("Unseal the Year first.");
      const why = cannotBuyConsumable(s, house, move);
      if (why) return fail(why);
      buyConsumable(s, house, move);
      s.phaseMoves += 1;
      return { ok: true, state: s };
    }
    case "bid": {
      if (s.phase !== "settlement") return fail("Bids are made in the Settlement Phase.");
      if (h.sealed) return fail("Unseal the Year first.");
      const why = cannotBid(s, house, move.item, move.gold);
      if (why) return fail(why);
      bid(s, house, move.item, move.gold);
      s.phaseMoves += 1;
      return { ok: true, state: s };
    }
    case "auction": {
      if (s.phase !== "settlement") return fail("Auctions are held in the Settlement Phase.");
      if (h.sealed) return fail("Unseal the Year first.");
      const why = cannotAuction(s, house, move.item, move.reserve);
      if (why) return fail(why);
      putUp(s, house, move.item, move.reserve);
      s.phaseMoves += 1;
      return { ok: true, state: s };
    }
    case "sell": {
      if (s.phase !== "settlement") return fail("The shops open in the Settlement Phase.");
      if (h.sealed) return fail("Unseal the Year first.");
      const why = cannotSell(s, house, move.item);
      if (why) return fail(why);
      sell(s, house, move.item);
      s.phaseMoves += 1;
      return { ok: true, state: s };
    }
    case "offer": {
      if (s.phase !== "settlement") return fail("Deals are made in the Settlement Phase.");
      if (h.sealed) return fail("Unseal the Year first.");
      const why = cannotOffer(s, house, move.to, move.give ?? {}, move.get ?? {});
      if (why) return fail(why);
      offer(s, house, move.to, move.give ?? {}, move.get ?? {}, !!move.open);
      s.phaseMoves += 1;
      return { ok: true, state: s };
    }
    case "accept": {
      if (s.phase !== "settlement") return fail("Deals are made in the Settlement Phase.");
      const why = cannotAccept(s, house, move.deal);
      if (why) return fail(why);
      accept(s, move.deal);
      s.phaseMoves += 1;
      return { ok: true, state: s };
    }
    case "decline": {
      if (s.phase !== "settlement") return fail("Deals are made in the Settlement Phase.");
      const why = cannotDecline(s, house, move.deal);
      if (why) return fail(why);
      decline(s, move.deal);
      s.phaseMoves += 1;
      return { ok: true, state: s };
    }
    case "choose": {
      if (s.phase !== "settlement") return fail("There is nothing to choose now.");
      const why = cannotChoose(s, house, move.event, move.option, move.target);
      if (why) return fail(why);
      choose(s, house, move.event, move.option, move.target);
      s.phaseMoves += 1;
      return { ok: true, state: s };
    }
    case "bargain": {
      if (s.phase !== "settlement" && s.phase !== "expedition") return fail("No one is whispering now.");
      const why = cannotBargain(s, house, move);
      if (why) return fail(why);
      bargain(s, house, move);
      s.phaseMoves += 1;
      return { ok: true, state: s };
    }
    case "cure": {
      if (s.phase !== "settlement") return fail("Cures are spent at home, in the Settlement Phase.");
      if (h.sealed) return fail("Unseal the Year first.");
      const why = cannotCure(s, house, move);
      if (why) return fail(why);
      cure(s, move);
      s.phaseMoves += 1;
      return { ok: true, state: s };
    }
    case "tempt": {
      if (s.phase !== "settlement") return fail("Nothing tempts you now.");
      if (h.sealed) return fail("Unseal the Year first.");
      const why = cannotTempt(s, house);
      if (why) return fail(why);
      tempt(s, house);
      s.phaseMoves += 1;
      return { ok: true, state: s };
    }
    case "propose": {
      if (s.phase !== "settlement") return fail("Proposals are made in the Settlement Phase.");
      if (h.sealed) return fail("Unseal the Year first.");
      if (s.proposers.includes(house)) return fail("You have made your proposal for this Year.");
      const why = cannotPropose(s, move.project);
      if (why) return fail(why);
      s.proposers.push(house);
      propose(s, house, move.project);
      s.phaseMoves += 1;
      return { ok: true, state: s };
    }
    case "vote": {
      if (s.phase !== "settlement") return fail("There is nothing to vote on.");
      const why = cannotVote(s, house, move.choice);
      if (why) return fail(why);
      castVote(s, house, move.choice);
      s.phaseMoves += 1;
      return { ok: true, state: s };
    }
    case "learn":
    case "take_job":
    case "secondary":
    case "passive":
    case "equip":
    case "unequip": {
      if (s.phase !== "settlement") return fail(s.phase === "expedition" ? "Jobs, passives and gear are locked until the expedition returns." : "Scions are readied in the Settlement Phase.");
      if (h.sealed) return fail("Unseal the Year first.");
      const why = cannotOutfit(s, house, move);
      if (why) return fail(why);
      outfit(s, house, move);
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
      if (s.phase === "founding") {
        // Taking back an oath before the last House swears.
        if (s.muster) return fail("Every House has sworn; the draft is under way.");
        if (!h.sealed) return fail("You have not sworn the Pact.");
        h.sealed = false;
        return { ok: true, state: s };
      }
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
  if (s.phase === "expedition") return waiting(s).map((i) => s.players[i]!);
  if (s.muster) return [s.players[musterTurn(s)!]!];
  if (s.phase !== "settlement" && s.phase !== "founding") return [];
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
/** A bot fields its best and packs its share of the satchel. */
function botFieldMove(s: SovState, house: number): SovMove {
  const people = botField(s, house);
  const kit = botPack(s, house, people.length);
  return { type: "field", people, ...(kit ? { pack: kit } : {}) };
}

/** A bot's move, marked as a bot's so the state knows which seats people hold. */
export const botMove = (s: SovState, playerId: PlayerId): SovMove => ({ ...chooseBotMove(s, playerId), bot: true }) as unknown as SovMove;

function chooseBotMove(s: SovState, playerId: PlayerId): SovMove {
  const house = houseOf(s, playerId);
  // A bot founds the Random House it was dealt, keeping the first Ambition (§5.1).
  if (s.muster && musterTurn(s) === house) return { type: "muster", ...botMuster(s) };
  if (s.phase === "founding") return house >= 0 && !s.houses[house]!.sealed ? botFounding(s, house) : { type: "swear", ambition: 0 };
  // In battle, the Scion's gambits: the same engine plays a bot's turn and an absent player's (§6.11).
  if (s.phase === "expedition" && house >= 0 && s.expedition?.fight) return { type: "command", auto: "turn" };
  if (s.phase === "expedition" && house >= 0 && s.expedition?.halt?.includes(house)) return { type: "onward" };
  if (s.phase === "expedition" && house >= 0)
    return botBargain(s, house) ?? (s.expedition?.draft?.length
      ? { type: "draft", share: botDraft(s, house) }
      : s.expedition?.event
      ? { type: "decide", option: botDecide(s), ...(s.expedition.event.picks ? { person: botPicksFor(s, house) } : {}) }
      : s.expedition?.leader !== undefined
      ? (botOpen(s, house) ?? { type: botPress(s) ? "press_on" : "retreat" })
      : s.expedition?.votes
        ? { type: "lead", person: botLeader(s, house) }
        : botFieldMove(s, house));
  if (house >= 0 && s.phase === "settlement" && s.vote && s.vote.by[house] === null) return { type: "vote", choice: botVote(s, house) };
  const offered = house >= 0 && s.phase === "settlement" ? s.deals.find((d) => d.to === house) : undefined;
  if (offered) return botDeal(s, house, offered);
  const whisper = house >= 0 && s.phase === "settlement" ? botBargain(s, house) : null;
  if (whisper) return whisper;
  const mend = house >= 0 && s.phase === "settlement" && !s.houses[house]!.sealed ? botCure(s, house) : null;
  if (mend) return mend;
  const pick = house >= 0 && s.phase === "settlement" ? s.events.find((e) => e.deciders.includes(house) && e.choices[house] === null) : undefined;
  if (pick) {
    const option = botChoice(s, house, pick.id);
    const named = TOWN_EVENT_BY_ID.get(pick.id)!.options![option]!.target ? botTarget(s, house) : null;
    return { type: "choose", event: pick.key, option, ...(named === null ? {} : { target: named }) };
  }
  if (house >= 0 && s.phase === "settlement" && !s.houses[house]!.sealed) {
    const help = botCrisis(s, house);
    if (help) return { type: "crisis_pledge", give: help };
    if (s.gate && s.gate.cards.length > 1 && s.gate.votes[house] === null) return { type: "pick_card", card: botCard(s, house) };
    const raise = botPromote(s, house);
    if (raise) return { type: "promote", ...raise };
    const ready = botOutfit(s, house);
    if (ready) return ready;
    const stock = botBuyConsumable(s, house);
    if (stock) return stock;
    const gear = botShop(s, house);
    if (gear !== null) return { type: "buy", item: gear };
    const junk = botSell(s, house);
    if (junk !== null) return { type: "sell", item: junk };
    const job = botAssign(s, house);
    if (job) return { type: "assign", ...job };
    const next = botBuild(s, house);
    if (next) return { type: "build", building: next };
    const gift = botPledge(s, house);
    if (gift) return { type: "pledge", ...gift };
    const ask = botPropose(s, house);
    if (ask) return { type: "propose", project: ask };
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
    return (s.phase === "settlement" || (s.phase === "founding" && !s.muster)) && house >= 0 && s.houses[house]!.sealed ? ["unseal"] : [];
  },
  checkpoint,
  describeSave,
};
