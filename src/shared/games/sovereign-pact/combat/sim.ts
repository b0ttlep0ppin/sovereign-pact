// The headless battle simulator (HANDOFF §7): both sides decide by gambits, the battle runs to its
// end from its seed, and a summary comes back for balance tests and `npm run sim`.
import { createRng, type Rng } from "../../../rng.ts";
import { INJURY_BY_ID } from "../content.ts";
import { act, advance, move } from "./battle.ts";
import { decide } from "./gambits.ts";
import type { Battle, BattleOutcome } from "./types.ts";

/** Runs `fn` with the battle's own RNG and stores the RNG's state back. */
export function withRng<T>(b: Battle, fn: (rng: Rng) => T): T {
  const rng = createRng(b.rng);
  const out = fn(rng);
  b.rng = rng.seed();
  return out;
}

/** Plays one turn by gambit for whoever is next. Returns false once the battle is over. `strict` rethrows a plan the rules refuse. */
export function autoTurn(b: Battle, strict = false): boolean {
  return withRng(b, (rng) => {
    const u = advance(b, rng);
    if (!u) return false;
    const plan = decide(b, rng, u);
    if (plan.move) {
      try {
        move(b, u, plan.move[0], plan.move[1]);
      } catch (e) {
        if (strict) throw e;
      }
    }
    try {
      act(b, rng, u, plan.action);
    } catch (e) {
      if (strict) throw e;
      act(b, rng, u, { do: "defend" });
    }
    return !b.outcome;
  });
}

export interface BattleSummary {
  outcome: BattleOutcome;
  ticks: number;
  /** Turns the party took, all Scions together. */
  partyTurns: number;
  /** Party HP lost as a share of its total max HP, 0–1. */
  hpLost: number;
  injuryRolls: number;
  /** Injury results by band. */
  bands: Record<string, number>;
  downed: number;
  dead: number;
}

/** Runs a battle to the end (mutating it) and sums it up. */
export function simulate(b: Battle, maxTurns = 2_000, strict = false): BattleSummary {
  const start = new Map(b.units.map((u) => [u.id, u.hp]));
  for (let i = 0; i < maxTurns && autoTurn(b, strict); i++);
  if (!b.outcome) b.outcome = "retreat";
  const party = b.units.filter((u) => u.side === "party");
  const max = party.reduce((s, u) => s + u.maxHp, 0);
  const lost = party.reduce((s, u) => s + Math.max(0, start.get(u.id)! - (u.dead ? 0 : u.hp)), 0);
  const bands: Record<string, number> = {};
  let injuryRolls = 0;
  for (const e of b.events) {
    if (e.t !== "injury") continue;
    injuryRolls++;
    const band = bandOf(e.result);
    bands[band] = (bands[band] ?? 0) + 1;
  }
  return {
    outcome: b.outcome,
    ticks: b.tick,
    partyTurns: party.reduce((s, u) => s + u.turns, 0),
    hpLost: max ? lost / max : 0,
    injuryRolls,
    bands,
    downed: new Set(b.events.filter((e) => e.t === "down").map((e) => (e as { target: number }).target)).size,
    dead: party.filter((u) => u.dead).length,
  };
}

const bandOf = (id: string) => INJURY_BY_ID.get(id)?.band ?? "unknown";
