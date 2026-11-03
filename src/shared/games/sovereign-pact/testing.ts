// Helpers for this game's tests and the simulator: seeded campaigns and bot play-throughs.
import { createRng } from "../../rng.ts";
import { TOWN_EVENT_BY_ID } from "./content.ts";
import { sovereignPact, type SovMove, type SovState } from "./index.ts";
import { cautious } from "./omens.ts";

export const seats = (n: number): string[] => Array.from({ length: n }, (_, i) => `p${i + 1}`);

/** A new campaign for `houses` seats from `seed`, under standard options unless given, its battles fought by gambits (fast) unless asked. */
export function campaign(houses: number, seed = 1, options?: Record<string, string>): SovState {
  return found(sovereignPact.setup(seats(houses), createRng(seed), undefined, { battles: "gambits", ...options }));
}

/** Every House swears the Random House it was dealt: the campaign at Year 1. */
export function found(s: SovState): SovState {
  let t = s;
  for (const p of t.players) {
    const r = sovereignPact.applyMove(t, p, sovereignPact.botMove!(t, p, undefined as never));
    if (!r.ok) throw new Error(r.error);
    t = r.state;
  }
  // The opening draft, each House's pick as its bot would make it.
  while (t.muster) {
    const p = sovereignPact.activePlayers(t)[0]!;
    const r = sovereignPact.applyMove(t, p, sovereignPact.botMove!(t, p, undefined as never));
    if (!r.ok) throw new Error(r.error);
    t = r.state;
  }
  return t;
}

/**
 * Stills the Omens (tests of exact amounts): this Year's events, Crisis and event vote are cleared, and
 * none come. The Houses also lose their traits (and any starting debt), so amounts are the plain rules'.
 * The Rift Gate offers nothing, so no expedition departs.
 */
/** A Seat id with no advantage or drawback: tests that count Gold, stores or slots exactly use it. */
export const PLAIN_SEAT = "plain";

export function calm(s: SovState): SovState {
  for (const h of s.houses) {
    h.traits = [];
    delete h.bane;
    h.debt = 0;
    // No Seat's advantage or drawback either (DECISIONS 8ah): a Seat with no effects, and no head-start building.
    h.seat = PLAIN_SEAT;
    h.buildings = {};
  }
  s.flags.push("calm");
  s.events = [];
  s.notes = s.houses.map(() => []);
  delete s.crisis;
  delete s.gate;
  if (s.vote?.kind === "event") delete s.vote;
  return s;
}

/** The Rift Gate stays shut for the whole campaign: the settlement bots alone, whatever expeditions would do to them. */
export function ashore(s: SovState): SovState {
  s.flags.push("no_gate");
  delete s.gate;
  return s;
}

/** Plays bots in every seat until the campaign ends (or `maxMoves`), calling `each` on every state. */
export function playOut(start: SovState, each?: (s: SovState) => void, maxMoves = 10_000): SovState {
  let s = start;
  const rng = createRng(s.rng ^ 0x5eed);
  each?.(s);
  for (let i = 0; i < maxMoves && !sovereignPact.result(s); i++) {
    const [who] = sovereignPact.activePlayers(s);
    if (!who) throw new Error(`Nobody can move in phase ${s.phase}`);
    const r = sovereignPact.applyMove(s, who, sovereignPact.botMove!(s, who, rng));
    if (!r.ok) throw new Error(r.error);
    s = r.state;
    each?.(s);
  }
  return s;
}

/** Every House seals the Year; bots then field the party and vote its Leader, as far as the next Year. */
/** Answers what House `i` owes before it may seal (Josh 2026-11-03): each of its town events cautiously, a vote with its last option. */
export function answerOwed(start: SovState, i: number): SovState {
  let s = start;
  const p = s.players[i]!;
  const send = (m: SovMove) => {
    const r = sovereignPact.applyMove(s, p, m);
    if (!r.ok) throw new Error(r.error);
    s = r.state;
  };
  for (let n = 0; n < 8; n++) {
    if (s.vote && s.vote.by[i] === null) send({ type: "vote", choice: s.vote.options.length - 1 });
    else {
      const pe = s.events.find((e) => e.deciders.includes(i) && e.choices[i] === null);
      if (!pe) break;
      send({ type: "choose", event: pe.key, option: cautious(TOWN_EVENT_BY_ID.get(pe.id)!) });
    }
  }
  return s;
}

export function sealYear(start: SovState): SovState {
  let s = start;
  for (const [i, p] of s.players.entries()) {
    if (s.phase !== "settlement" || s.houses[i]!.sealed) continue;
    s = answerOwed(s, i);
    const r = sovereignPact.applyMove(s, p, { type: "seal" });
    if (!r.ok) throw new Error(r.error);
    s = r.state;
  }
  while (s.phase === "expedition") {
    const who = sovereignPact.activePlayers(s)[0]!;
    const r = sovereignPact.applyMove(s, who, sovereignPact.botMove!(s, who, undefined as never));
    if (!r.ok) throw new Error(r.error);
    s = r.state;
  }
  return s;
}
