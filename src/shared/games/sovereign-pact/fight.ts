// A battle fought turn by turn (SPEC §10.4, §6.11): the clock runs by itself through the enemies'
// turns, then stops on a Scion's and waits for the Scion's House to say what they do. A House can hand
// a turn, or the rest of the battle, to the Scion's gambits; a bot or a player who is away does that
// every turn, so the gambit engine is the bot. A table that chose "gambits" never stops at all.
import { act, advance, ATTACK, cannotMove, cannotUse, move, mpCost, tpCost, unit, type Action } from "./combat/battle.ts";
import { CONSUMABLE_BY_ID } from "./content.ts";
import { frame, unitOf, vitalsOf, type Replay, type Vitals } from "./combat/replay.ts";
import { autoAct, withRng } from "./combat/sim.ts";
import { hasStatus } from "./combat/grid.ts";
import { cannotUseItem, itemAbility } from "./combat/items.ts";
import { hasRoom } from "./combat/summons.ts";
import { canShift } from "./combat/forms.ts";
import { cellOf, isSingle, singleTargets, targetSide } from "./combat/targets.ts";
import { COLS, ROWS, type AbilityDef, type Battle, type Cell, type Combatant, type Side } from "./combat/types.ts";
import { concluded } from "./journey.ts";
import type { LiveFight, SovState } from "./state.ts";
import { TUNING } from "./tuning.ts";

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

/** How a choice is aimed: at the Scion themself, at one of `targets`, or at any cell of `side` (an area). */
export type Aim = { aim: "self" } | { aim: "unit"; targets: Cell[] } | { aim: "area"; side: Side };

/** One thing the Scion may do this turn, or could if not for `why`. */
export interface Choice {
  id: string;
  name: string;
  mp: number;
  tp: number;
  /** Why it cannot be used now (MP, cooldown, silence…), or null. */
  why: string | null;
}

/** The commanding House's view of the turn: where the Scion can move, and what they can do from where they stand. */
export interface TurnView {
  unit: number;
  moved: boolean;
  moves: [col: number, row: number][];
  abilities: (Choice & Aim)[];
  items: (Choice & Aim & { left: number })[];
  /** A Pugilist's moves to chain into a combo (§12.2), with the TP to spend and the foes the chain can strike. */
  combo?: ComboView;
}

/** One move a combo may chain: its tag, its TP before repeats, and for a finisher the pattern it ends. */
export interface ComboMove {
  id: string;
  name: string;
  tp: number;
  mp: number;
  tag: string;
  finisher?: string;
  /** It lands on the foe the chain is aimed at (else on the Pugilist, like Breath). */
  strike: boolean;
  /** Why it cannot be chained at all (cooldown, silence…), or null. */
  why: string | null;
}

export interface ComboView {
  tp: number;
  mp: number;
  /** TP added for each earlier use of the same move in the chain. */
  repeatTp: number;
  moves: ComboMove[];
  /** Where a chain with a strike in it may be aimed. */
  targets: Cell[];
}

/** A battle under way, as every House sees it (§15.5): the replay so far, everyone's vitals now, and whose turn waits on which House. */
export interface FightView {
  title: string;
  /** The Scion whose turn waits on a command, and the House that gives it. */
  person: number | null;
  house: number | null;
  /** Houses whose Scions fight by gambits for the rest of it. */
  auto: number[];
  replay: Replay;
  now: Vitals[];
  /** The turn's choices, for the House that commands it only. */
  turn: TurnView | null;
}

const NO_AIM = new Set(["self", "all", "line", "nearest", "random", "front_each_row"]);

function aimOf(b: Battle, u: Combatant, ab: AbilityDef): Aim {
  if (ab.side === "self" || ab.summon || ab.form || ab.revert || ab.raise || ab.call || ab.devour || ab.song || NO_AIM.has(ab.shape.split(":")[0]!)) return { aim: "self" };
  if (isSingle(ab)) return { aim: "unit", targets: singleTargets(b, u, ab).map(cellOf) };
  return { aim: "area", side: targetSide(u, ab) };
}

/** Why the ability has nothing to aim at, beyond `cannotUse`. */
function stuck(b: Battle, u: Combatant, ab: AbilityDef, aim: Aim): string | null {
  if (ab.summon && !hasRoom(b, u, ab.summon)) return "no room";
  if (ab.form && !canShift(b, u, ab.form)) return "no room";
  return aim.aim === "unit" && !aim.targets.length ? "out of reach" : null;
}

function turnView(b: Battle, u: Combatant): TurnView {
  const moves: [number, number][] = [];
  for (let col = 0; col < COLS; col++) for (let row = 0; row < ROWS; row++) if (!cannotMove(b, u, col, row)) moves.push([col, row]);
  const abilities = [ATTACK, ...u.abilities.filter((a) => !a.move?.finisher)].map((ab) => {
    const aim = aimOf(b, u, ab);
    return { id: ab.id, name: ab.name ?? ab.id.replace(/_/g, " "), mp: mpCost(u, ab), tp: tpCost(u, ab), why: cannotUse(u, ab) ?? stuck(b, u, ab, aim), ...aim };
  });
  const counts = new Map<string, number>();
  for (const id of b.satchel ?? []) counts.set(id, (counts.get(id) ?? 0) + 1);
  const items = [...counts].flatMap(([id, left]) => {
    const ab = itemAbility(u, id);
    if (!ab) return [];
    const aim = aimOf(b, u, ab);
    return [{ id, name: CONSUMABLE_BY_ID.get(id)?.name ?? id, mp: 0, tp: 0, why: cannotUseItem(b, u, id) ?? stuck(b, u, ab, aim), left, ...aim }];
  });
  const chain = u.abilities.filter((a) => a.move);
  const foe = chain.find((m) => m.side === "foe");
  const combo: ComboView | undefined = chain.length
    ? {
        tp: u.tp,
        mp: u.mp,
        repeatTp: TUNING.combat.combo.repeatTp,
        targets: foe ? singleTargets(b, u, foe).map(cellOf) : [],
        moves: chain.map((m) => ({
          id: m.id,
          name: m.name ?? m.id.replace(/_/g, " "),
          tp: m.tp ?? 0,
          mp: m.mp ?? 0,
          tag: m.move!.tag,
          strike: m.side === "foe",
          ...(m.move!.finisher ? { finisher: m.move!.finisher } : {}),
          why: cannotUse({ ...u, tp: 999, mp: 999 }, { ...m, move: undefined }),
        })),
      }
    : undefined;
  return { unit: u.id, moved: !!b.moved, moves, abilities, items, ...(combo ? { combo } : {}) };
}

/** The battle for `me`'s screen, or null when none is under way. */
export function fightView(s: SovState, me: number | null): FightView | null {
  const f = s.expedition?.fight;
  if (!f) return null;
  const u = f.unit === undefined ? undefined : unit(f.b, f.unit);
  const house = awaited(s);
  return {
    title: f.title,
    person: u?.person ?? null,
    house,
    auto: f.auto ?? [],
    // Summons that came since the start are on the replay's roll too.
    replay: { ...f.replay, units: f.b.units.map(unitOf) },
    now: f.b.units.map(vitalsOf),
    turn: u && me !== null && me === house ? turnView(f.b, u) : null,
  };
}
