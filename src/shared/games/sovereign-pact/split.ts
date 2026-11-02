// 2×4 expeditions (§9.3): the eight split into two parties of four, each with its own chain and Leader.
// One party walks at a time. Each chain has a Gate halfway that waits on the other party (the lever on
// the far side): the first party's opens once the second reaches its own Gate, the second's once the
// first is through. So control passes A, B, A, B. Both chains end at the meeting place, where whoever is
// left faces the boss together. A party that turns back or falls is gone; the other goes on alone, and
// its Gate no longer waits.
import { lose, person, rollChain } from "./journey.ts";
import type { Expedition, NodeKind, PartyState, SovState, Split } from "./state.ts";
import { TUNING } from "./tuning.ts";
import { log, withRng } from "./year.ts";

const sp = (s: SovState): Split => s.expedition!.split!;
const runs = (s: SovState, id: number) => person(s, id).hist.expeditions ?? 0;

/** Whether the expedition is walking as two parties now (not yet, or no longer, one). */
export const divided = (e: Expedition | undefined): boolean => !!e?.split && !e.split.united;

/** One party's chain: the card's N nodes with a Gate halfway, then the meeting place. */
function chainOf(s: SovState): NodeKind[] {
  const nodes = rollChain(s).slice(0, -1);
  nodes.splice(Math.floor(nodes.length / 2), 0, "gate");
  return [...nodes, "rally"];
}

/**
 * The parties at departure: the roster dealt out by House, so a House with two or more Scions is in
 * both. The Leader's party walks first; the other's Leader is its most travelled Scion.
 */
export function divide(s: SovState, ids: number[], leader: number): void {
  const e = s.expedition!;
  const order = [...ids].sort((a, b) => person(s, a).host - person(s, b).host || a - b);
  let teams: [number[], number[]] = [order.filter((_, i) => i % 2 === 0), order.filter((_, i) => i % 2 === 1)];
  if (!teams[0].includes(leader)) teams = [teams[1], teams[0]];
  const second = teams[1].reduce((a, b) => (runs(s, b) > runs(s, a) || (runs(s, b) === runs(s, a) && b < a) ? b : a));
  const chains: [NodeKind[], NodeKind[]] = [chainOf(s), chainOf(s)];
  e.split = { teams, leaders: [leader, second], chains, at: [0, 0], turn: 0, state: ["walking", "walking"], home: [] };
  e.chain = chains[0];
  e.at = 0;
  const p = person(s, second);
  log(s, `Beyond the Gate the way divides. ${person(s, leader).name} leads one party of ${teams[0].length}; ${p.name} of House ${s.houses[p.host]!.name} leads the other.`);
}

/** The walking party's place goes back into the split, and party `t` takes the way. */
function pass(s: SovState, t: 0 | 1): void {
  const e = s.expedition!;
  const x = sp(s);
  x.chains[x.turn] = e.chain;
  x.at[x.turn] = e.at;
  x.leaders[x.turn] = e.leader!;
  x.turn = t;
  e.chain = x.chains[t];
  e.at = x.at[t];
  e.leader = x.leaders[t];
  log(s, `Control passes to ${person(s, e.leader).name}'s party.`);
}

const passed = (chain: NodeKind[], at: number) => !chain.includes("gate") || at > chain.indexOf("gate");

/** Whether the walking party's Gate opens: the other party has done its part, or is gone or waiting at the end. */
function opens(s: SovState): boolean {
  const x = sp(s);
  const o = (1 - x.turn) as 0 | 1;
  if (x.state[o] !== "walking") return true;
  const [chain, at] = [x.chains[o], x.at[o]];
  return x.turn === 0 ? chain[at] === "gate" || passed(chain, at) : passed(chain, at);
}

/** A Gate node: through if it opens; otherwise the party waits before it and the other party walks. */
export function gate(s: SovState): void {
  const e = s.expedition!;
  if (opens(s)) return log(s, "Something gives on the far side, and the Gate grinds open.");
  e.at -= 1;
  log(s, "A sealed Gate bars the way. The party waits for the others to find the lever.");
  pass(s, (1 - sp(s).turn) as 0 | 1);
}

/** The meeting place: this party waits there, and the other walks on, or both are here and face the boss. */
export function rally(s: SovState): void {
  const x = sp(s);
  x.state[x.turn] = "rallied";
  log(s, "The party reaches the meeting place.");
  next(s);
}

/** The other party walks if it can; otherwise those left meet for the boss. */
function next(s: SovState): void {
  const x = sp(s);
  const o = (1 - x.turn) as 0 | 1;
  if (x.state[o] === "walking") return pass(s, o);
  const e = s.expedition!;
  x.chains[x.turn] = e.chain;
  x.at[x.turn] = e.at;
  x.united = true;
  e.chain = ["boss"];
  e.at = 0;
  e.leader = x.leaders[x.state[0] === "rallied" ? 0 : 1];
  log(s, x.state.every((st) => st === "rallied") ? "The two parties meet again, and the boss is waiting." : "What is left of the expedition faces the boss alone.");
}

/**
 * The walking party turns back or falls (§9.9 for the fallen: half Lost, the rest crawl home). The other
 * goes on; with nobody left on the way, the expedition ends as the last party's did. Returns how the
 * whole expedition ended, or null if it goes on.
 */
export function partyGone(s: SovState, how: "retreated" | "wiped", walkers: number[]): PartyState | null {
  const e = s.expedition!;
  const x = sp(s);
  if (how === "wiped")
    withRng(s, (rng) => {
      for (const id of walkers) if (rng.int(100) < TUNING.journey.lostPct) lose(s, person(s, id));
    });
  else x.home.push(...walkers);
  for (const id of walkers) if (!e.out.includes(id)) e.out.push(id);
  x.state[x.turn] = how;
  const o = (1 - x.turn) as 0 | 1;
  if (x.state[o] === "walking" || x.state[o] === "rallied") {
    log(s, how === "wiped" ? "One party is gone. The other does not know it yet." : "One party turns back for home; the other goes on alone.");
    next(s);
    return null;
  }
  x.united = true;
  return x.state.includes("retreated") ? "retreated" : "wiped";
}
