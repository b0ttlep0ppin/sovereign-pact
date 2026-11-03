// A battle's turns (§10.4–10.5, §10.12): advancing the clock to the next actor, moving, acting,
// charging and resolving, and the end. Plain functions over a mutable `Battle`; callers clone first.
import type { Rng } from "../../../rng.ts";
import { TUNING } from "../tuning.ts";
import { ELEMENTS, LOCATIONS, type Element } from "../state.ts";
import { bossPhases, spawnAdds } from "./bosses.ts";
import { fights, hazardStruck, springTrap } from "./hazards.ts";
import { chargeTicks, moveCost, nextActor, step } from "./clock.ts";
import { cannotCombo, comboCt, comboTp } from "./combos.ts";
import { abilityDice, castLots, rolledAbility } from "./dice.ts";
import { canShift, feralPick, graft, revert, shift } from "./forms.ts";
import { keepParts, missingParts, offerParts, spendParts } from "./parts.ts";
import { crescendo, playSong } from "./songs.ts";
import { atCap, deathThroes, devour, hasRoom, openingSummons, raise, sacrifice, summon } from "./summons.ts";
import { affinityMult, offHandStrike, strike } from "./damage.ts";
import { hasStatus, isFree, standing } from "./grid.ts";
import { kill } from "./injury.ts";
import { cannotUseItem, itemAbility, spendItem } from "./items.ts";
import { addStatus, endSongs, extraOf, meta, removeStatus, statusValue } from "./status.ts";
import { CONSUMABLES } from "../content.ts";
import { cellOf, isSingle, resolveTargets, rushCol, singleTargets } from "./targets.ts";
import type { AbilityDef, Battle, Cell, Combatant } from "./types.ts";

const C = TUNING.combat;

/** Every combatant can make a plain attack with its weapon. */
export const ATTACK: AbilityDef = { id: "attack", name: "Attack", shape: "single", side: "foe", power: 1 };

/** `doubleDown`: how many times a Gambler rolls an ability's dice again (§12.2); `rolled`: its total already thrown in the open (null: it fizzled). */
/** `keep`: the Components a Tinkerer keeps from this turn's offer (the bots' pick when missing, §12.2). */
export type Action = (
  | { do: "ability"; ability: string; target: Cell; doubleDown?: number; rolled?: number | null }
  /** A Pugilist's sequence of moves on one target (§12.2). */
  | { do: "combo"; moves: string[]; target: Cell }
  | { do: "wait" }
  | { do: "defend" }
  /** A consumable from the party satchel (§13.7). */
  | { do: "item"; item: string; target: Cell }
) & { keep?: string[] };

/** The battle stops after this many ticks with a retreat, so a stalemate cannot run forever. */
export const MAX_TICKS = 30_000;

export const unit = (b: Battle, id: number): Combatant => b.units.find((u) => u.id === id)!;

export function abilityOf(u: Combatant, id: string): AbilityDef | undefined {
  return id === "attack" ? ATTACK : u.abilities.find((a) => a.id === id);
}

/** MP an ability costs `u`: spells with the Scion's spell-MP mods (Attunement −10%, §12.3; its House's element −10%, §5.6); a summon after Pact of Blood is free. */
export function mpCost(u: Combatant, ab: AbilityDef): number {
  if (!ab.mp || (ab.summon && u.flags.includes("free_summon"))) return 0;
  const spell = ab.kind === "magic" || ab.kind === "heal";
  const pct = spell ? (u.mods.spellMpPct ?? 0) + (ab.element ? (u.mods[`spellMp.${ab.element}`] ?? 0) : 0) : 0;
  return Math.max(1, Math.round(ab.mp * (1 + pct / 100)));
}

/** TP an ability costs `u`: none for the first sword technique of a battle under Iaijutsu (§12.3). */
export const tpCost = (u: Combatant, ab: AbilityDef): number =>
  ab.tp && u.mods.iaijutsu && u.weapon.kind === "sword" && ab.id !== "attack" && !u.flags.includes("iaijutsu_used") ? 0 : (ab.tp ?? 0);

/** HP an ability costs `u` (Blood Price): % of max HP. */
export const hpCost = (u: Combatant, ab: AbilityDef): number => (ab.hpCost ? Math.max(1, Math.round((u.maxHp * ab.hpCost) / 100)) : 0);

/** Why `u` cannot use `ab` now, or null if it can. */
export function cannotUse(u: Combatant, ab: AbilityDef): string | null {
  if (u.lost?.includes(ab.id)) return "part";
  if (ab.id !== "attack" && hasStatus(u, "berserk")) return "berserk";
  if (ab.kind === "magic" || ab.kind === "heal") {
    if (hasStatus(u, "silence") || hasStatus(u, "null_zone") || u.mods.mute) return "silenced";
  }
  if (ab.id === "attack" && hasStatus(u, "disarmed")) return "disarmed";
  if ((u.cooldowns[ab.id] ?? 0) > 0) return "cooldown";
  // A finisher only ends a combo whose moves fit its pattern (combos.ts).
  if (ab.move?.finisher) return "finisher";
  if (ab.requires && !ab.requires.some((w) => (w === "shield" ? u.offhand === "shield" : u.weapon.kind === w))) return `needs ${ab.requires.join(" or ")}`;
  if (ab.summon && atCap(u)) return "binding";
  // A feral Form allows only its pick (§12.17); Revert and Graft need a Form.
  if (u.feral && ab.id !== u.feral) return "feral";
  if ((ab.revert || ab.graft) && !u.form) return "no form";
  if (missingParts(u, ab).length) return "parts";
  if (ab.rig && (u.parts?.length ?? 0) < C.tinkerer.rigParts) return "parts";
  if (ab.finale && Object.values(u.songs ?? {}).filter(Boolean).length < 3) return "needs three songs";
  if (mpCost(u, ab) > u.mp) return "mp";
  if (tpCost(u, ab) > u.tp) return "tp";
  if (ab.hpCost && hpCost(u, ab) >= u.hp) return "hp";
  return null;
}

/** Runs the clock until someone may act; resolves charges as they come due. Returns the actor, or undefined when the battle is over. */
export function advance(b: Battle, rng: Rng): Combatant | undefined {
  if (!b.begun) {
    b.begun = true;
    openingSummons(b);
    // Ward-Sense (§12.14): the foes' buffs show with the ticks they have left.
    for (const side of ["party", "enemy"] as const) if (b.units.some((x) => x.side === side && x.mods.wardSense)) for (const x of b.units) if (x.side !== side) x.mods.sensed = 1;
  }
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
  // Last Stand (§12.5): a free Defend every turn while it lasts.
  if (hasStatus(u, "last_stand")) u.defending = true;
  // Cast Lots' and Reckless Swing's "until next turn" effects end here, and so does Mirror Stance.
  for (const k of Object.keys(u.mods)) if (k.startsWith("turn.")) delete u.mods[k];
  for (const s of [...u.statuses]) if (meta(s.id).endsOnTurn) removeStatus(b, u, s.id);
  u.flags = u.flags.filter((f) => f !== "lots_twelve");
  for (const k of Object.keys(u.cooldowns)) if (u.cooldowns[k]! > 0) u.cooldowns[k]!--;
  if (u.lastStand) u.tp = Math.min(C.tp.max, u.tp + C.lastStand.tp);
  // Attuned and Resolute accessories (§13.4).
  if (u.mods.mpPerTurn) u.mp = Math.min(u.maxMp, u.mp + u.mods.mpPerTurn);
  if (u.mods.sanityPerTurn) u.sanity = Math.min(u.maxSanity, u.sanity + u.mods.sanityPerTurn);
  if (u.mods.durPctPerTurn && u.dur && u.maxDur) for (const l of LOCATIONS) u.dur[l] = Math.min(u.maxDur[l], u.dur[l] + Math.round((u.maxDur[l] * u.mods.durPctPerTurn) / 100));
  if (hasStatus(u, "fear") && (u.mods.sanityTakenPct ?? 0) > -100) u.sanity = Math.max(0, u.sanity - 5);
  // An opening's Hiding ends at the next turn; Vanish's (value 1) only when the Vagabond acts.
  if (hasStatus(u, "hidden") && u.turns > 1 && statusValue(u, "hidden") !== 1) removeStatus(b, u, "hidden");
  // Valor (§12.4): each physical ailment may end early, a Resilience % chance apiece.
  if (u.mods.valor) for (const s of [...u.statuses]) if (meta(s.id).kind === "physical" && !meta(s.id).fixed && rng.int(100) < u.resilience) removeStatus(b, u, s.id);
  const lost = u.statuses.find((s) => meta(s.id).oneTurn || meta(s.id).blocks);
  if (lost) {
    if (meta(lost.id).oneTurn) removeStatus(b, u, lost.id);
    u.ct = Math.max(0, u.ct - C.cost.action);
    return false;
  }
  crescendo(b, u);
  // A Shrapnel Mine bursts on the first foe of its layer to act (§12.16).
  const mine = b.mines?.findIndex((m) => b.units.find((x) => x.id === m.by)?.side !== u.side) ?? -1;
  if (mine >= 0) {
    const m = b.mines!.splice(mine, 1)[0]!;
    const by = b.units.find((x) => x.id === m.by)!;
    if (!by.dead) resolve(b, rng, by, { ...m.ability, mine: undefined, parts: undefined, shape: "burst:3x3" }, cellOf(u));
    if (u.dead || u.down || b.outcome) return false;
  }
  if (u.mods.castLots) castLots(b, rng, u);
  offerParts(rng, u);
  feralPick(rng, u, (ab) => !cannotUse({ ...u, feral: undefined }, ab));
  b.actor = u.id;
  b.moved = false;
  b.acted = false;
  return true;
}

/** Why the actor cannot move to (col, row) now, or null. */
export function cannotMove(b: Battle, u: Combatant, col: number, row: number): string | null {
  if (b.actor !== u.id || b.moved) return "not this combatant's move";
  if (u.mods.noMove || hasStatus(u, "rooted") || hasStatus(u, "frozen")) return "cannot move";
  const cells = Math.abs(col - u.col) + Math.abs(row - u.row);
  if (cells < 1 || cells > Math.min(C.move.maxCells, u.mods.maxMove ?? C.move.maxCells)) return "too far";
  const there = b.units.find((o) => o.id !== u.id && !o.dead && o.side === u.side && o.col === col && o.row === row);
  if (there) return cells !== 1 || there.size[0] * there.size[1] !== 1 || u.size[0] * u.size[1] !== 1 ? "cannot swap" : null;
  return isFree(b, u.side, col, row, u.size, u.id) ? null : "cell taken";
}

/** Moves the actor up to 2 cells on its own grid, or swaps it with an adjacent ally (§10.4). */
export function move(b: Battle, u: Combatant, col: number, row: number): void {
  const why = cannotMove(b, u, col, row);
  if (why) throw new Error(why);
  const cells = Math.abs(col - u.col) + Math.abs(row - u.row);
  const there = b.units.find((o) => o.id !== u.id && !o.dead && o.side === u.side && o.col === col && o.row === row);
  if (there) {
    there.col = u.col;
    there.row = u.row;
    b.events.push({ t: "move", unit: there.id, col: there.col, row: there.row });
  }
  u.col = col;
  u.row = row;
  u.ct = Math.max(0, u.ct - moveCost(u, cells));
  b.moved = true;
  b.events.push({ t: "move", unit: u.id, col, row });
}

/** The actor's action; ends the turn. */
export function act(b: Battle, rng: Rng, u: Combatant, action: Action): void {
  if (b.actor !== u.id || b.acted) throw new Error("not this combatant's action");
  if (b.moved) springTrap(b, rng, u);
  keepParts(u, action.keep);
  let cost: number;
  if (action.do === "wait") {
    cost = C.cost.wait + (u.mods.restCt ?? 0);
    b.events.push({ t: "wait", unit: u.id });
  } else if (action.do === "defend" && u.mods.noDefend) {
    // A curse that forbids Defending (§13.5): the turn is a Wait.
    cost = C.cost.wait + (u.mods.restCt ?? 0);
    b.events.push({ t: "wait", unit: u.id });
  } else if (action.do === "defend") {
    // Iron Discipline (§5.7) and the like: `restCt` shifts Wait and Defend alike.
    cost = (u.mods.defendCost ?? C.cost.defend) + (u.mods.restCt ?? 0);
    u.defending = true;
    b.events.push({ t: "defend", unit: u.id });
  } else if (action.do === "item") {
    cost = useItem(b, rng, u, action.item, action.target);
  } else if (action.do === "combo") {
    cost = playCombo(b, rng, u, action.moves, action.target);
  } else if (abilityOf(u, action.ability)?.move) {
    // A single Pugilist move is a sequence of one (a finisher alone never fits its pattern).
    cost = playCombo(b, rng, u, [action.ability], action.target);
  } else {
    let ab = abilityOf(u, action.ability);
    if (!ab) throw new Error(`unknown ability ${action.ability}`);
    const why = cannotUse(u, ab);
    if (why) throw new Error(`cannot use ${ab.id}: ${why}`);
    let homingOn: number | undefined;
    if (isSingle(ab)) {
      const t = singleTargets(b, u, ab).find((x) => x.side === action.target.side && x.col === action.target.col && x.row === action.target.row);
      if (!t) throw new Error("no valid target there");
      if (ab.homing !== false) homingOn = t.id;
    }
    if (ab.summon && !hasRoom(b, u, ab.summon)) throw new Error("no room for the summon");
    if (ab.form && !canShift(b, u, ab.form)) throw new Error("no room for the Form");
    u.mp -= mpCost(u, ab);
    if (ab.summon) u.flags = u.flags.filter((f) => f !== "free_summon");
    spendParts(u, ab.parts ?? []);
    // Bolt with a Lens never misses; Precision adds crit to it (§12.16).
    if (ab.lens && u.parts?.includes("lens")) {
      spendParts(u, ["lens"]);
      u.flags.push("sure_hit");
      if (u.mods.precision) ab = { ...ab, crit: (ab.crit ?? 0) + u.mods.precision };
    }
    const tp = tpCost(u, ab);
    if (ab.tp && !tp) u.flags.push("iaijutsu_used");
    u.tp -= tp;
    const paid = hpCost(u, ab);
    u.hp -= paid;
    // Siphon (§12.8): the blood paid comes back as MP.
    if (ab.mpFromHp) u.mp = Math.min(u.maxMp, u.mp + Math.round(paid * ab.mpFromHp));
    if (ab.cooldown) u.cooldowns[ab.id] = ab.cooldown + 1;
    // Frenzy: attacks cost less.
    cost = ab.cost ?? (ab.song ? (u.mods.songCt ?? C.cost.song) : ab.id === "attack" ? (u.weapon.attackCost ?? C.cost.action) + (u.mods.attackCt ?? 0) : C.cost.action);
    const instant = u.flags.indexOf("instant_charge");
    if (ab.charge && instant < 0) {
      // Quick Rites: summons come sooner (§12.15).
      const ticks = Math.round(chargeTicks(u, ab.charge) * (ab.summon ? 1 + (u.mods.summonChargePct ?? 0) / 100 : 1));
      u.charge = { ability: ab, target: action.target, homingOn, ticks };
      // A read enemy's charge shows, telegraphed or not (Commune, §12.9).
      b.events.push({ t: "charge", unit: u.id, ability: ab.id, target: action.target, ticks, telegraph: !!ab.telegraph || hasStatus(u, "communed") });
    } else {
      if (ab.charge) u.flags.splice(instant, 1);
      resolve(b, rng, u, ab, action.target, homingOn, action.doubleDown, action.rolled);
    }
  }
  if (u.mods.nextActionCt) {
    cost += u.mods.nextActionCt;
    delete u.mods.nextActionCt;
  }
  // Quickened (the Dark General's Infernal Order): every action costs half, so it acts twice as often.
  if (hasStatus(u, "quickened")) cost = Math.round(cost / 2);
  u.ct = Math.max(0, u.ct - cost);
  b.acted = true;
  b.actor = null;
  checkEnd(b);
}

/** Uses a consumable on `at`: it leaves the satchel and acts as its ability. Returns the CT. */
function useItem(b: Battle, rng: Rng, u: Combatant, id: string, at: Cell): number {
  const why = cannotUseItem(b, u, id);
  if (why) throw new Error(`cannot use ${id}: ${why}`);
  const ab = itemAbility(u, id)!;
  let homingOn: number | undefined;
  if (isSingle(ab)) {
    const t = singleTargets(b, u, ab).find((x) => x.side === at.side && x.col === at.col && x.row === at.row);
    if (!t) throw new Error("no valid target there");
    homingOn = t.id;
  }
  spendItem(b, id);
  resolve(b, rng, u, ab, at, homingOn);
  return ab.cost!;
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
export function resolve(b: Battle, rng: Rng, u: Combatant, ab: AbilityDef, at: Cell, homingOn?: number, doubleDown = 0, thrown?: number | null): void {
  if (ab.song) return playSong(b, rng, u, ab);
  if (ab.summon || ab.form || ab.revert || ab.raise || ab.devour || ab.call) {
    b.events.push({ t: "use", unit: u.id, ability: ab.id, target: at });
    if (ab.raise) raise(b, u, ab.raise);
    else if (ab.devour) devour(b, u, ab.devour);
    else if (ab.call) spawnAdds(b, u, ab.call);
    else if (ab.summon) summon(b, u, ab.summon, at);
    else if (ab.form) shift(b, u, ab.form);
    else revert(b, u);
    return;
  }
  // Charge!: the run comes first (§12.5).
  if (ab.rush) {
    const col = rushCol(b, u, ab.rush);
    if (col !== u.col) {
      u.col = col;
      b.events.push({ t: "move", unit: u.id, col: u.col, row: u.row });
    }
  }
  if (ab.defend) {
    u.defending = true;
    b.events.push({ t: "defend", unit: u.id });
  }
  let targets = resolveTargets(b, rng, u, ab, at, homingOn);
  if (counterspelled(b, rng, u, ab, targets)) return;
  if (ab.dice) {
    const total = abilityDice(b, rng, u, targets[0], ab.dice.doubleDown ? doubleDown : 0, ab.dice.doubleDown ? thrown : undefined);
    if (total === null) {
      b.events.push({ t: "use", unit: u.id, ability: ab.id, target: at });
      return;
    }
    const rolled = rolledAbility(ab, total);
    ab = rolled.ab;
    if (rolled.self) targets = [u];
  }
  // Shrapnel Mine: laid now, to burst later.
  if (ab.mine) {
    b.events.push({ t: "use", unit: u.id, ability: ab.id, target: at });
    (b.mines ??= []).push({ by: u.id, ability: ab });
    return;
  }
  // Jury-Rig: three Components into a magic consumable.
  if (ab.rig) {
    b.events.push({ t: "use", unit: u.id, ability: ab.id, target: at });
    u.parts!.splice(0, C.tinkerer.rigParts);
    const id = rng.pick(C.tinkerer.rigItems);
    (b.satchel ??= []).push(id);
    (b.stolen ??= []).push(id);
    b.events.push({ t: "pocket", unit: u.id, item: id });
    return;
  }
  // Nova (§12.8): the element that hurts what it covers most.
  if (ab.bestElement && targets.length) ab = { ...ab, element: [...ELEMENTS].sort((x, y) => sumMult(targets, y) - sumMult(targets, x))[0]! };
  // Dirty Trick: one trick of several.
  if (ab.pick?.length) ab = { ...ab, ...rng.pick(ab.pick) };
  b.events.push({ t: "use", unit: u.id, ability: ab.id, target: homingOn !== undefined && targets[0] ? cellOf(targets[0]) : at });
  // Vanish: the Backstab from hiding lands half again as hard (§12.6).
  const vanished = u.flags.indexOf("vanish");
  if (vanished >= 0 && ab.id === "backstab") {
    u.flags.splice(vanished, 1);
    ab = { ...ab, power: ab.power * (1 + C.vagabond.vanishPct / 100), powerIfMarked: ab.powerIfMarked && ab.powerIfMarked * (1 + C.vagabond.vanishPct / 100) };
  }
  // Still Water: the next technique hits harder (§12.13).
  const still = u.flags.indexOf("still_water");
  if (still >= 0 && ab.power > 0 && ab.id !== "attack") {
    u.flags.splice(still, 1);
    ab = { ...ab, power: ab.power * (1 + C.jobs.stillWaterPct / 100) };
  }
  const hits = (ab.hits ?? 1) + (ab.hitsMax ? rng.int(ab.hitsMax - (ab.hits ?? 1) + 1) : 0);
  // Hundred Fists: the power is shared among everyone it hits.
  if (ab.split && targets.length > 1) ab = { ...ab, power: ab.power / targets.length };
  for (const t of targets) {
    for (let i = 0; i < hits && !t.dead && !u.dead; i++) {
      const hit = strike(b, rng, u, t, ab, { telegraphed: !!ab.telegraph });
      // Multi-hit weapons sometimes strike again, weaker (§13.4).
      if (ab.id === "attack" && hit.hit && u.mods.multiHit && !t.dead && !u.dead && rng.int(100) < u.mods.multiHit)
        strike(b, rng, u, t, { ...ab, power: ab.power * C.props.multiHitPower });
      // Knife Flurry (§12.6): a Guile/4 % chance of another stab.
      if (ab.id === "attack" && hit.hit && u.mods.knifeFlurry && u.weapon.kind === "knife" && !t.dead && !u.dead && rng.int(100) < Math.floor(u.guile / C.vagabond.flurryDiv)) strike(b, rng, u, t, ab);
      // Dual wield: the off hand follows the Attack (§13.2).
      if (ab.id === "attack" && u.offWeapon && !t.dead && !u.dead) offHandStrike(b, rng, u, t, ab);
    }
  }
  for (const t of targets) {
    // Grapple Line: pulled toward the gap if the cell is free.
    if (ab.pull && !t.dead && t.col > 0 && t.partOf === undefined && !b.units.some((o) => o.partOf === t.id) && isFree(b, t.side, Math.max(0, t.col - ab.pull), t.row, t.size, t.id)) {
      t.col = Math.max(0, t.col - ab.pull);
      b.events.push({ t: "move", unit: t.id, col: t.col, row: t.row });
    }
    if (ab.graft) graft(b, u, t, C.jobs.graftTicks);
    if (ab.steal && !t.dead) steal(b, rng, u, t);
    if (ab.ctToAlly && !t.dead) reap(b, u, t, ab.ctToAlly);
    // Rescue (§12.4): the Knight and the ally trade places.
    if (ab.swap && t.id !== u.id && !t.dead && !u.dead) {
      [u.col, t.col] = [t.col, u.col];
      [u.row, t.row] = [t.row, u.row];
      b.events.push({ t: "move", unit: u.id, col: u.col, row: u.row }, { t: "move", unit: t.id, col: t.col, row: t.row });
    }
    // Sacrifice and Banish (§12.15): only summons and adds answer them.
    if (ab.sacrifice) sacrifice(b, u, t, ab.sacrifice);
    if (ab.banish && !t.dead && !t.boss && (t.owner !== undefined || t.tags.includes("add"))) kill(b, t);
    if (t.dead) deathThroes(b, rng, t);
    hazardStruck(b, rng, t);
  }
  // Acting ends Hiding, unless the act was hiding (Vanish).
  if (hasStatus(u, "hidden") && !ab.statuses?.some((x) => x.id === "hidden")) removeStatus(b, u, "hidden");
  if (ab.leap && !u.dead) addStatus(b, u, "exposed");
  if (ab.finale) endSongs(b, u);
  if (ab.self?.tp) u.tp = Math.min(C.tp.max, u.tp + ab.self.tp);
  for (const x of ab.self?.statuses ?? []) addStatus(b, u, x.id, x.ticks, extraOf(x.value, x.mods));
  for (const [k, v] of Object.entries(ab.self?.mods ?? {})) u.mods[k] = (u.mods[k] ?? 0) + v;
  if ((ab.flee || ab.selfDestruct) && !u.dead) {
    if (ab.flee) {
      u.flags.push("fled");
      b.events.push({ t: "flee", unit: u.id });
    }
    kill(b, u);
  }
  checkEnd(b);
}

const sumMult = (ts: Combatant[], el: Element) => ts.reduce((n, t) => n + affinityMult(t, el), 0);

/** Steal (§12.6): the target's newest buff moves to the thief; with none, a Guile % chance (once a foe) to lift a consumable. */
function steal(b: Battle, rng: Rng, u: Combatant, t: Combatant): void {
  const buff = [...t.statuses].reverse().find((x) => meta(x.id).kind === "buff" && !meta(x.id).fixed && x.id !== "shield");
  if (buff) {
    removeStatus(b, t, buff.id);
    addStatus(b, u, buff.id, buff.ticks, extraOf(buff.value, buff.mods));
    return;
  }
  if (t.flags.includes("robbed") || u.side !== "party" || rng.int(100) >= u.guile) return;
  t.flags.push("robbed");
  const id = rng.pick(LOOT);
  (b.satchel ??= []).push(id);
  (b.stolen ??= []).push(id);
  b.events.push({ t: "pocket", unit: u.id, target: t.id, item: id });
}

/** What a Steal can lift: the cheap battle consumables a shop sells from the start. */
const LOOT = CONSUMABLES.filter((c) => c.use === "battle" && c.sold.some((x) => x.level === 1)).map((c) => c.id);

/** Pickpocket the Reaper (§12.6): CT from the target, bosses half, to the most hurt ally standing. */
function reap(b: Battle, u: Combatant, t: Combatant, n: number): void {
  if (t.mods.readinessImmune) return;
  const took = Math.min(t.ct, Math.round(n * (t.boss ? C.bossReadiness : 1)));
  t.ct -= took;
  const to = standing(b, u.side).filter((x) => x.id !== u.id).sort((x, y) => x.hp / x.maxHp - y.hp / y.maxHp || x.id - y.id)[0] ?? u;
  to.ct += took;
}

/** Counterspell (§12.14): a hostile spell on someone beside an Abjurer may be dispelled before it lands. */
function counterspelled(b: Battle, rng: Rng, u: Combatant, ab: AbilityDef, targets: Combatant[]): boolean {
  if (ab.kind !== "magic") return false;
  const near = (o: Combatant, t: Combatant) => o.id !== t.id && Math.abs(o.col - t.col) + Math.abs(o.row - t.row) === 1;
  const warders = b.units.filter((o) => o.side !== u.side && o.mods.counterspell && !o.dead && !o.down && targets.some((t) => t.side === o.side && near(o, t)));
  const warder = warders.find((o) => rng.int(100) < o.mods.counterspell!);
  if (!warder) return false;
  b.events.push({ t: "counterspell", unit: warder.id, target: u.id });
  b.events.push({ t: "cancel", unit: u.id, ability: ab.id });
  return true;
}

/** Victory when every enemy is gone; defeat when every Scion is Down or dead (§10.12). */
export function checkEnd(b: Battle): void {
  if (b.outcome) return;
  bossPhases(b);
  if (!standing(b, "enemy").some(fights)) end(b, "victory");
  // Summons cannot hold the field alone (§10.12: defeat when every Scion is Down or dead).
  else if (!standing(b, "party").some((u) => u.owner === undefined)) end(b, "defeat");
}

/** Ends the battle: the Down get up at 10% after a victory; the mortally wounded die (§10.9, §11.4). */
export function end(b: Battle, outcome: NonNullable<Battle["outcome"]>): undefined {
  if (b.outcome) return undefined;
  b.outcome = outcome;
  b.actor = null;
  // Summons vanish at battle end (§12.2).
  for (const u of b.units) {
    if (u.owner === undefined || u.dead) continue;
    u.dead = true;
    b.events.push({ t: "vanish", unit: u.id });
  }
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
