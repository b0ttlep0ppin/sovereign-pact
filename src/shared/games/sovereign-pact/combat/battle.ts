// A battle's turns (§10.4–10.5, §10.12): advancing the clock to the next actor, moving, acting,
// charging and resolving, and the end. Plain functions over a mutable `Battle`; callers clone first.
import type { Rng } from "../../../rng.ts";
import { TUNING } from "../tuning.ts";
import { chargeTicks, moveCost, nextActor, step } from "./clock.ts";
import { cannotCombo, comboCt, comboTp } from "./combos.ts";
import { abilityDice, castLots, rolledAbility } from "./dice.ts";
import { playSong } from "./songs.ts";
import { strike } from "./damage.ts";
import { hasStatus, isFree, standing } from "./grid.ts";
import { kill } from "./injury.ts";
import { addStatus, meta, removeStatus } from "./status.ts";
import { cellOf, isSingle, resolveTargets, singleTargets } from "./targets.ts";
import type { AbilityDef, Battle, Cell, Combatant } from "./types.ts";

const C = TUNING.combat;

/** Every combatant can make a plain attack with its weapon. */
export const ATTACK: AbilityDef = { id: "attack", name: "Attack", shape: "single", side: "foe", power: 1 };

/** `doubleDown`: how many times a Gambler rolls an ability's dice again (§12.2). */
export type Action =
  | { do: "ability"; ability: string; target: Cell; doubleDown?: number }
  /** A Pugilist's sequence of moves on one target (§12.2). */
  | { do: "combo"; moves: string[]; target: Cell }
  | { do: "wait" }
  | { do: "defend" };

/** The battle stops after this many ticks with a retreat, so a stalemate cannot run forever. */
export const MAX_TICKS = 30_000;

export const unit = (b: Battle, id: number): Combatant => b.units.find((u) => u.id === id)!;

export function abilityOf(u: Combatant, id: string): AbilityDef | undefined {
  return id === "attack" ? ATTACK : u.abilities.find((a) => a.id === id);
}

/** MP an ability costs `u`: spells with the Scion's spell-MP mods (Attunement −10%, §12.3). */
export const mpCost = (u: Combatant, ab: AbilityDef): number =>
  ab.mp ? Math.max(1, Math.round(ab.mp * (1 + (ab.kind === "magic" || ab.kind === "heal" ? (u.mods.spellMpPct ?? 0) : 0) / 100))) : 0;

/** Why `u` cannot use `ab` now, or null if it can. */
export function cannotUse(u: Combatant, ab: AbilityDef): string | null {
  if (ab.id !== "attack" && hasStatus(u, "berserk")) return "berserk";
  if (ab.kind === "magic" || ab.kind === "heal") {
    if (hasStatus(u, "silence") || u.mods.mute) return "silenced";
  }
  if (ab.id === "attack" && hasStatus(u, "disarmed")) return "disarmed";
  if ((u.cooldowns[ab.id] ?? 0) > 0) return "cooldown";
  // A finisher only ends a combo whose moves fit its pattern (combos.ts).
  if (ab.move?.finisher) return "finisher";
  if (ab.requires && !ab.requires.some((w) => (w === "shield" ? u.offhand === "shield" : u.weapon.kind === w))) return `needs ${ab.requires.join(" or ")}`;
  if (mpCost(u, ab) > u.mp) return "mp";
  if ((ab.tp ?? 0) > u.tp) return "tp";
  return null;
}

/** Runs the clock until someone may act; resolves charges as they come due. Returns the actor, or undefined when the battle is over. */
export function advance(b: Battle, rng: Rng): Combatant | undefined {
  while (!b.outcome) {
    const actor = nextActor(b, rng);
    if (actor) {
      if (beginTurn(b, rng, actor)) return actor;
      continue;
    }
    if (b.tick >= MAX_TICKS) return end(b, "retreat");
    for (const charger of step(b, rng)) if (charger.charge && !charger.dead && !charger.down) resolveCharge(b, rng, charger);
    checkEnd(b);
  }
  return undefined;
}

/** Start of a turn. Returns false if the turn was lost (Knockdown, Skip, a status that blocks). */
function beginTurn(b: Battle, rng: Rng, u: Combatant): boolean {
  b.events.push({ t: "turn", unit: u.id, tick: b.tick });
  u.turns++;
  u.defending = false;
  // Cast Lots' "until next turn" effects end here.
  for (const k of Object.keys(u.mods)) if (k.startsWith("turn.")) delete u.mods[k];
  u.flags = u.flags.filter((f) => f !== "lots_twelve");
  for (const k of Object.keys(u.cooldowns)) if (u.cooldowns[k]! > 0) u.cooldowns[k]!--;
  if (u.lastStand) u.tp = Math.min(C.tp.max, u.tp + C.lastStand.tp);
  // Attuned and Resolute accessories (§13.4).
  if (u.mods.mpPerTurn) u.mp = Math.min(u.maxMp, u.mp + u.mods.mpPerTurn);
  if (u.mods.sanityPerTurn) u.sanity = Math.min(u.maxSanity, u.sanity + u.mods.sanityPerTurn);
  if (hasStatus(u, "fear")) u.sanity = Math.max(0, u.sanity - 5);
  if (hasStatus(u, "hidden") && u.turns > 1) removeStatus(b, u, "hidden");
  const lost = u.statuses.find((s) => meta(s.id).oneTurn || meta(s.id).blocks);
  if (lost) {
    if (meta(lost.id).oneTurn) removeStatus(b, u, lost.id);
    u.ct = Math.max(0, u.ct - C.cost.action);
    return false;
  }
  if (u.mods.castLots) castLots(b, rng, u);
  b.actor = u.id;
  b.moved = false;
  b.acted = false;
  return true;
}

/** Moves the actor up to 2 cells on its own grid, or swaps it with an adjacent ally (§10.4). */
export function move(b: Battle, u: Combatant, col: number, row: number): void {
  if (b.actor !== u.id || b.moved) throw new Error("not this combatant's move");
  if (u.mods.noMove || hasStatus(u, "rooted") || hasStatus(u, "frozen")) throw new Error("cannot move");
  const cells = Math.abs(col - u.col) + Math.abs(row - u.row);
  if (cells < 1 || cells > C.move.maxCells) throw new Error("too far");
  const there = b.units.find((o) => o.id !== u.id && !o.dead && o.side === u.side && o.col === col && o.row === row);
  if (there) {
    if (cells !== 1 || there.size[0] * there.size[1] !== 1 || u.size[0] * u.size[1] !== 1) throw new Error("cannot swap");
    there.col = u.col;
    there.row = u.row;
    b.events.push({ t: "move", unit: there.id, col: there.col, row: there.row });
  } else if (!isFree(b, u.side, col, row, u.size, u.id)) throw new Error("cell taken");
  u.col = col;
  u.row = row;
  u.ct = Math.max(0, u.ct - moveCost(u, cells));
  b.moved = true;
  b.events.push({ t: "move", unit: u.id, col, row });
}

/** The actor's action; ends the turn. */
export function act(b: Battle, rng: Rng, u: Combatant, action: Action): void {
  if (b.actor !== u.id || b.acted) throw new Error("not this combatant's action");
  let cost: number;
  if (action.do === "wait") {
    cost = C.cost.wait;
    b.events.push({ t: "wait", unit: u.id });
  } else if (action.do === "defend" && u.mods.noDefend) {
    // A curse that forbids Defending (§13.5): the turn is a Wait.
    cost = C.cost.wait;
    b.events.push({ t: "wait", unit: u.id });
  } else if (action.do === "defend") {
    cost = u.mods.defendCost ?? C.cost.defend;
    u.defending = true;
    b.events.push({ t: "defend", unit: u.id });
  } else if (action.do === "combo") {
    cost = playCombo(b, rng, u, action.moves, action.target);
  } else if (abilityOf(u, action.ability)?.move) {
    // A single Pugilist move is a sequence of one (a finisher alone never fits its pattern).
    cost = playCombo(b, rng, u, [action.ability], action.target);
  } else {
    const ab = abilityOf(u, action.ability);
    if (!ab) throw new Error(`unknown ability ${action.ability}`);
    const why = cannotUse(u, ab);
    if (why) throw new Error(`cannot use ${ab.id}: ${why}`);
    let homingOn: number | undefined;
    if (isSingle(ab)) {
      const t = singleTargets(b, u, ab).find((x) => x.side === action.target.side && x.col === action.target.col && x.row === action.target.row);
      if (!t) throw new Error("no valid target there");
      if (ab.homing !== false) homingOn = t.id;
    }
    u.mp -= mpCost(u, ab);
    u.tp -= ab.tp ?? 0;
    if (ab.cooldown) u.cooldowns[ab.id] = ab.cooldown + 1;
    cost = ab.cost ?? (ab.song ? (u.mods.songCt ?? C.cost.song) : ab.id === "attack" ? (u.weapon.attackCost ?? C.cost.action) : C.cost.action);
    const instant = u.flags.indexOf("instant_charge");
    if (ab.charge && instant < 0) {
      const ticks = chargeTicks(u, ab.charge);
      u.charge = { ability: ab, target: action.target, homingOn, ticks };
      b.events.push({ t: "charge", unit: u.id, ability: ab.id, target: action.target, ticks, telegraph: !!ab.telegraph });
    } else {
      if (ab.charge) u.flags.splice(instant, 1);
      resolve(b, rng, u, ab, action.target, homingOn, action.doubleDown);
    }
  }
  if (u.mods.nextActionCt) {
    cost += u.mods.nextActionCt;
    delete u.mods.nextActionCt;
  }
  u.ct = Math.max(0, u.ct - cost);
  b.acted = true;
  b.actor = null;
  checkEnd(b);
}

/** Plays a combo: each move pays its TP and lands in turn until the target falls. Returns the CT. */
function playCombo(b: Battle, rng: Rng, u: Combatant, ids: string[], at: Cell): number {
  const moves = ids.map((id) => {
    const ab = abilityOf(u, id);
    if (!ab) throw new Error(`unknown move ${id}`);
    return ab;
  });
  const why = cannotCombo(u, moves) ?? moves.map((m) => cannotUse({ ...u, tp: 999, mp: 999 }, { ...m, move: undefined })).find(Boolean);
  if (why) throw new Error(`cannot play that combo: ${why}`);
  const target = moves.some((m) => m.side === "foe") ? singleTargets(b, u, moves.find((m) => m.side === "foe")!).find((x) => x.col === at.col && x.row === at.row) : u;
  if (!target) throw new Error("no valid target there");
  const tp = comboTp(moves);
  moves.forEach((m, i) => {
    if (u.dead || u.down || b.outcome) return;
    u.tp -= tp[i]!;
    u.mp -= m.mp ?? 0;
    const t = m.side === "foe" ? target : u;
    if (!t.dead) resolve(b, rng, u, m, cellOf(t), t.id);
  });
  return comboCt(moves.length);
}

function resolveCharge(b: Battle, rng: Rng, u: Combatant): void {
  const { ability, target, homingOn } = u.charge!;
  delete u.charge;
  resolve(b, rng, u, ability, target, homingOn);
}

/** An ability lands: every target, every hit (§10.6). */
export function resolve(b: Battle, rng: Rng, u: Combatant, ab: AbilityDef, at: Cell, homingOn?: number, doubleDown = 0): void {
  if (ab.song) return playSong(b, rng, u, ab);
  let targets = resolveTargets(b, rng, u, ab, at, homingOn);
  if (ab.dice) {
    const total = abilityDice(b, rng, u, targets[0], ab.dice.doubleDown ? doubleDown : 0);
    if (total === null) {
      b.events.push({ t: "use", unit: u.id, ability: ab.id, target: at });
      return;
    }
    const rolled = rolledAbility(ab, total);
    ab = rolled.ab;
    if (rolled.self) targets = [u];
  }
  b.events.push({ t: "use", unit: u.id, ability: ab.id, target: homingOn !== undefined && targets[0] ? cellOf(targets[0]) : at });
  const hits = (ab.hits ?? 1) + (ab.hitsMax ? rng.int(ab.hitsMax - (ab.hits ?? 1) + 1) : 0);
  // Hundred Fists: the power is shared among everyone it hits.
  if (ab.split && targets.length > 1) ab = { ...ab, power: ab.power / targets.length };
  for (const t of targets) {
    for (let i = 0; i < hits && !t.dead && !u.dead; i++) {
      const hit = strike(b, rng, u, t, ab, { telegraphed: !!ab.telegraph });
      // Multi-hit weapons sometimes strike again, weaker (§13.4).
      if (ab.id === "attack" && hit.hit && u.mods.multiHit && !t.dead && !u.dead && rng.int(100) < u.mods.multiHit)
        strike(b, rng, u, t, { ...ab, power: ab.power * C.props.multiHitPower });
    }
  }
  if (hasStatus(u, "hidden")) removeStatus(b, u, "hidden");
  if (ab.self?.tp) u.tp = Math.min(C.tp.max, u.tp + ab.self.tp);
  for (const x of ab.self?.statuses ?? []) addStatus(b, u, x.id, x.ticks, x.value === undefined ? undefined : { value: x.value });
  checkEnd(b);
}

/** Victory when every enemy is gone; defeat when every Scion is Down or dead (§10.12). */
export function checkEnd(b: Battle): void {
  if (b.outcome) return;
  if (!standing(b, "enemy").length) end(b, "victory");
  else if (!standing(b, "party").length) end(b, "defeat");
}

/** Ends the battle: the Down get up at 10% after a victory; the mortally wounded die (§10.9, §11.4). */
export function end(b: Battle, outcome: NonNullable<Battle["outcome"]>): undefined {
  if (b.outcome) return undefined;
  b.outcome = outcome;
  b.actor = null;
  for (const u of b.units) {
    delete u.charge;
    if (u.dead) continue;
    if (u.lastStand) kill(b, u);
    else if (u.down && outcome === "victory" && !u.catatonic) {
      u.down = false;
      u.hp = Math.max(1, Math.round((u.maxHp * C.getUpHp) / 100));
    }
  }
  b.events.push({ t: "end", outcome });
  return undefined;
}
