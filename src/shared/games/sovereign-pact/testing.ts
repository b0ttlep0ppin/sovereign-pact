// Helpers for this game's tests and the simulator: seeded campaigns and bot play-throughs.
import { createRng } from "../../rng.ts";
import { sovereignPact, type SovState } from "./index.ts";

export const seats = (n: number): string[] => Array.from({ length: n }, (_, i) => `p${i + 1}`);

/** A new campaign for `houses` seats from `seed`, under standard options unless given. */
export function campaign(houses: number, seed = 1, options?: Record<string, string>): SovState {
  return found(sovereignPact.setup(seats(houses), createRng(seed), undefined, options));
}

/** Every House swears the Random House it was dealt: the campaign at Year 1. */
export function found(s: SovState): SovState {
  let t = s;
  for (const p of t.players) {
    const r = sovereignPact.applyMove(t, p, sovereignPact.botMove!(t, p, undefined as never));
    if (!r.ok) throw new Error(r.error);
    t = r.state;
  }
  return t;
}

/**
 * Stills the Omens (tests of exact amounts): this Year's events, Crisis and event vote are cleared, and
 * none come. The Houses also lose their traits (and any starting debt), so amounts are the plain rules'.
 */
export function calm(s: SovState): SovState {
  for (const h of s.houses) {
    h.traits = [];
    delete h.bane;
    h.debt = 0;
  }
  s.flags.push("calm");
  s.events = [];
  s.notes = s.houses.map(() => []);
  delete s.crisis;
  if (s.vote?.kind === "event") delete s.vote;
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
