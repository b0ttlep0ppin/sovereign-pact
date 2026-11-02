// A battle fought turn by turn (SPEC §10.4, §6.11): the clock runs by itself through the enemies'
// turns, then stops on a Scion's and waits for the Scion's House to say what they do. A House can hand
// a turn, or the rest of the battle, to the Scion's gambits; a bot or a player who is away does that
// every turn, so the gambit engine is the bot. A table that chose "gambits" never stops at all.
import { act, advance, move, unit, type Action } from "./combat/battle.ts";
import { frame } from "./combat/replay.ts";
import { autoAct, withRng } from "./combat/sim.ts";
import { hasStatus } from "./combat/grid.ts";
import type { Combatant } from "./combat/types.ts";
import { concluded } from "./journey.ts";
import type { LiveFight, SovState } from "./state.ts";

/** A battle that has not ended after this many turns is a retreat (the simulator's limit). */
const MAX_TURNS = 2_000;

/** A command for the Scion whose turn it is: a move then an action, or their gambits for this turn or the rest of the battle. */
export interface Command {
  move?: [col: number, row: number];
  action?: Action;
  auto?: "turn" | "battle";
}

/** The House that commands a Scion in battle: the one they fight for (a Ward's host). */
export const commander = (s: SovState, u: Combatant): number => s.people.find((p) => p.id === u.person)!.host;

/** Fear, Berserk, Confusion, Madness and a feral Form take the choice away (§10.8): the Scion acts by themself. */
const compelled = (u: Combatant): boolean =>
  !!u.feral || !!u.mods.madness || ["fear", "turned", "berserk", "confusion", "madness"].some((id) => hasStatus(u, id));

/** Whether `u`'s turn waits on a House: a Scion (not a summon) the House has not handed to gambits. */
function waitsOn(s: SovState, f: LiveFight, u: Combatant): boolean {
  if (s.opts.battles === "gambits" || u.side !== "party" || u.person === undefined || u.owner !== undefined || compelled(u)) return false;
  return !f.auto?.includes(commander(s, u));
}

/** Runs the battle until a Scion's turn waits on a command, or to its end (journey.ts takes it from there). */
export function play(s: SovState): void {
  const f = s.expedition!.fight!;
  const b = f.b;
  while (!b.outcome && f.turns < MAX_TURNS) {
    const u = withRng(b, (rng) => advance(b, rng));
    if (!u) break;
    if (waitsOn(s, f, u)) {
      f.unit = u.id;
      return;
    }
    withRng(b, (rng) => autoAct(b, rng, u));
    turned(f);
  }
  if (!b.outcome) b.outcome = "retreat";
  framed(f);
  // The battle's events come back from the replay for what follows it (injuries, journey.ts settle).
  b.events.push(...f.replay.frames.flatMap((x) => x.ev));
  concluded(s);
}

function turned(f: LiveFight): void {
  f.turns += 1;
  framed(f);
}

/** The turn's events go into the replay and leave the battle, so a long battle stays small in the state. */
function framed(f: LiveFight): void {
  frame(f.b, f.replay, f.seen);
  f.b.events.length = f.seen;
}

/** The House whose command the battle waits on, or null. */
export function awaited(s: SovState): number | null {
  const f = s.expedition?.fight;
  return f?.unit === undefined ? null : commander(s, unit(f.b, f.unit));
}

/** Why `house` cannot give that command, or null. The battle's own rules are checked by trying it. */
export function cannotCommand(s: SovState, house: number, c: Command): string | null {
  const f = s.expedition?.fight;
  if (!f || f.unit === undefined) return "No battle waits on a command.";
  if (awaited(s) !== house) return "Another House commands this Scion.";
  if (c.auto) return c.auto === "turn" || c.auto === "battle" ? null : "Hand the turn or the battle to the gambits.";
  if (!c.action && !c.move) return "Choose what the Scion does.";
  if (c.move && f.b.moved) return "They have already moved this turn.";
  return null;
}

/**
 * The command, then the battle runs on to the next turn that waits; a move alone keeps the turn, so the
 * screen can show what the Scion reaches from there. Returns why the battle refused it, or null (the state is then the caller's to drop). */
export function command(s: SovState, house: number, c: Command): string | null {
  const f = s.expedition!.fight!;
  const b = f.b;
  const u = unit(b, f.unit!);
  if (c.auto === "battle") (f.auto ??= []).push(house);
  try {
    withRng(b, (rng) => {
      if (c.auto) return autoAct(b, rng, u);
      if (c.move) move(b, u, c.move[0], c.move[1]);
      if (c.action) act(b, rng, u, c.action);
    });
  } catch (e) {
    return `That cannot be done: ${(e as Error).message}.`;
  }
  if (!c.auto && !c.action) {
    framed(f);
    return null;
  }
  delete f.unit;
  turned(f);
  play(s);
  return null;
}
