// Gambits (§6.11, §10.11, §14.1): an ordered list of if / do / target rules, the first that applies
// fires. Enemies, Sorties and bot seats all decide this way. Mental statuses override the list (§10.8).
import type { Rng } from "../../../rng.ts";
import { HAZARD_BY_ID } from "../content.ts";
import { TUNING } from "../tuning.ts";
import { abilityOf, cannotUse, type Action } from "./battle.ts";
import { roomFor } from "./bosses.ts";
import { canShift } from "./forms.ts";
import { holds } from "./conditions.ts";
import { cannotUseItem, itemAbility, itemPlan } from "./items.ts";
import { fallen, hasRoom, prey } from "./summons.ts";

export { holds };
import { hasStatus, isFree, other, pickWeighted, shapeCells, standing } from "./grid.ts";
import { allegiance, bestCell, cellOf, crossDistance, isSingle, singleTargets, targetSide } from "./targets.ts";
import type { Location } from "../state.ts";
import { COLS, type AbilityDef, type Battle, type Combatant, type GambitRule } from "./types.ts";

export interface Plan {
  /** Cell to move to before acting. */
  move?: [number, number];
  action: Action;
}

const frac = (u: Combatant) => (u.maxHp ? u.hp / u.maxHp : 1);
const foes = (b: Battle, u: Combatant) => standing(b, other(allegiance(u)));

/** Every gambit target rule `choose` knows (anything else falls back to the column rule). */
export const TARGET_RULES = ["column_weighted", "lob", "nearest", "lowest_hp", "ally_lowest_hp", "lowest_sanity", "marked", "rooted", "charging", "ally_down", "highest_might", "lowest_durability", "densest_row", "densest_cluster", "part", "empty_cell", "back_random", "self", "random"];

/** Picks one of `candidates` by a gambit target rule (§14.1). */
export function choose(rng: Rng, u: Combatant, candidates: Combatant[], rule: string): Combatant | undefined {
  if (!candidates.length) return undefined;
  const by = (f: (x: Combatant) => number) => [...candidates].sort((x, y) => f(x) - f(y) || x.id - y.id)[0];
  switch (rule) {
    case "column_weighted":
      return pickWeighted(rng, candidates, "column_weighted");
    case "lob":
      return pickWeighted(rng, candidates, "lob");
    case "nearest":
      return by((x) => crossDistance(u, x));
    case "lowest_hp":
    case "ally_lowest_hp":
      return by(frac);
    case "lowest_sanity":
      return by((x) => x.sanity);
    case "marked":
      return candidates.find((x) => hasStatus(x, "marked"));
    case "rooted":
      // Whoever cannot step away (a vine golem's crush, a spider's bite).
      return candidates.find((x) => hasStatus(x, "rooted")) ?? pickWeighted(rng, candidates);
    case "charging":
      return candidates.find((x) => !!x.charge);
    case "ally_down":
      return candidates.find((x) => x.down);
    case "highest_might":
      return by((x) => -x.might);
    case "lowest_durability":
      // A bruiser goes for the weakest location it can reach (§14.3).
      return by((x) => Math.min(1, ...Object.entries(x.dur ?? {}).map(([k, v]) => v / (x.maxDur?.[k as Location] || 1))));
    case "densest_row":
    case "densest_cluster":
      // The one with the most of its side around it (rows for densest_row, the 3×3 for a cluster).
      return by((x) => -candidates.filter((o) => (rule === "densest_row" ? o.row === x.row : Math.abs(o.row - x.row) <= 1 && Math.abs(o.col - x.col) <= 1)).length);
    case "part": {
      // A Part of a big foe, the most hurt first (§14.1).
      const parts = candidates.filter((x) => x.partOf !== undefined);
      return parts.length ? [...parts].sort((x, y) => frac(x) - frac(y) || x.id - y.id)[0] : undefined;
    }
    case "empty_cell":
    case "back_random": {
      const back = Math.max(...candidates.map((x) => x.col));
      return rng.pick(candidates.filter((x) => x.col === back));
    }
    case "self":
      return candidates.find((x) => x.id === u.id);
    case "random":
      return rng.pick(candidates);
    default:
      return pickWeighted(rng, candidates);
  }
}

/** Default rule when a gambit names none: the party focuses the weakest, enemies use the column rule (§10.3). */
const defaultTarget = (u: Combatant, ab: AbilityDef) => (ab.side === "ally" ? "ally_lowest_hp" : u.side === "party" ? "lowest_hp" : ab.shape === "lob" ? "lob" : "column_weighted");

/** An action for `ab` aimed by `rule`, or undefined if nothing valid is in reach. */
export function aim(b: Battle, rng: Rng, u: Combatant, ab: AbilityDef, rule = defaultTarget(u, ab)): Action | undefined {
  if (cannotUse(u, ab)) return undefined;
  if (ab.summon && !hasRoom(b, u, ab.summon)) return undefined;
  if (ab.raise) return fallen(b, u).length ? { do: "ability", ability: ab.id, target: cellOf(u) } : undefined;
  if (ab.call) return roomFor(b, ab.call) ? { do: "ability", ability: ab.id, target: cellOf(u) } : undefined;
  if (ab.devour) return prey(b, u, ab.devour).length ? { do: "ability", ability: ab.id, target: cellOf(u) } : undefined;
  // Bots take a Form when they have none and never Revert on their own.
  if ((ab.form && (u.form || !canShift(b, u, ab.form))) || ab.revert) return undefined;
  if (ab.shape === "self" || ab.side === "self") {
    // A stance or self-ward already up is not cast again.
    // Commune once: the read lasts the battle.
    if (ab.commune && foes(b, u).every((x) => hasStatus(x, "communed"))) return undefined;
    const wards = ab.statuses ?? ab.self?.statuses;
    if (ab.kind === "support" && wards?.length && wards.every((x) => hasStatus(u, x.id))) return undefined;
    return { do: "ability", ability: ab.id, target: cellOf(u) };
  }
  if (isSingle(ab)) {
    let pool = singleTargets(b, u, ab);
    if (ab.kind === "heal") pool = pool.filter((x) => x.hp < x.maxHp);
    // Sacrifice takes one of the user's summons; Banish only something summoned or added.
    if (ab.sacrifice) pool = pool.filter((x) => x.owner === u.id);
    // Bots leave a bait hazard alone (an alarm bell, §14.8).
    pool = pool.filter((x) => !x.hazard || !HAZARD_BY_ID.get(x.hazard)?.bait);
    if (ab.banish) pool = pool.filter((x) => !x.boss && (x.owner !== undefined || x.tags.includes("add")));
    const t = choose(rng, u, pool, rule);
    return t ? { do: "ability", ability: ab.id, target: cellOf(t) } : undefined;
  }
  const side = targetSide(u, ab);
  if (!standing(b, side).length) return undefined;
  return { do: "ability", ability: ab.id, target: bestCell(b, u, ab, side) };
}

/** A cell within 2 steps from which `ab` has a target, nearest first (melee closing in, §10.4). */
function approach(b: Battle, rng: Rng, u: Combatant, ab: AbilityDef, rule?: string, closeIn = true): Plan | undefined {
  if (u.mods.noMove || hasStatus(u, "rooted") || hasStatus(u, "frozen")) return undefined;
  const { col, row } = u;
  const options: [number, number, number][] = [];
  for (let dc = -2; dc <= 2; dc++) {
    for (let dr = -2; dr <= 2; dr++) {
      const d = Math.abs(dc) + Math.abs(dr);
      if (d < 1 || d > Math.min(TUNING.combat.move.maxCells, u.mods.maxMove ?? 9) || !isFree(b, u.side, col + dc, row + dr, u.size, u.id)) continue;
      options.push([col + dc, row + dr, d * 10 + (col + dc)]);
    }
  }
  options.sort((x, y) => x[2] - y[2]);
  for (const [c, r] of options) {
    u.col = c;
    u.row = r;
    const action = aim(b, rng, u, ab, rule);
    u.col = col;
    u.row = row;
    if (action) return { move: [c, r], action };
  }
  // Nothing in reach yet: close in on the nearest foe's rows (and the Front), then Wait (§10.4).
  if (!closeIn) return undefined;
  const rows = foes(b, u).flatMap((f) => Array.from({ length: f.size[1] }, (_, i) => f.row + i));
  if (!rows.length) return undefined;
  const gap = (r: number) => Math.min(...rows.map((x) => Math.max(0, Math.abs(x - r) - (u.size[1] - 1))));
  const best = options.map(([c, r]) => ({ c, r, score: gap(r) * 10 + c })).sort((x, y) => x.score - y.score)[0];
  if (!best || best.score >= gap(row) * 10 + col) return undefined;
  return { move: [best.c, best.r], action: { do: "wait" } };
}

/** A plan for the actor: the mental statuses first, then its gambits in order, then attack or Defend. */
export function decide(b: Battle, rng: Rng, u: Combatant): Plan {
  const attack = abilityOf(u, "attack")!;
  if (hasStatus(u, "fear") || hasStatus(u, "turned")) {
    // Must move away or Wait (§10.8); the Turned undead too (Grave Dust, §13.7).
    const back = u.col + 1;
    if (back < 3 && !u.mods.noMove && !hasStatus(u, "rooted") && isFree(b, u.side, back, u.row, u.size, u.id)) return { move: [back, u.row], action: { do: "wait" } };
    return { action: { do: "wait" } };
  }
  if (hasStatus(u, "berserk")) {
    const plan = aimOrApproach(b, rng, u, attack, "nearest");
    return plan ?? { action: { do: "wait" } };
  }
  if (hasStatus(u, "confusion") || hasStatus(u, "madness") || u.mods.madness) {
    const usable = [attack, ...u.abilities].filter((a) => !cannotUse(u, a));
    const plan = usable.length ? aimOrApproach(b, rng, u, rng.pick(usable), "random") : undefined;
    if (plan) return plan;
  }
  // A feral Form's pick is the only thing to do.
  if (u.feral) return aimOrApproach(b, rng, u, abilityOf(u, u.feral)!) ?? { action: { do: "wait" } };
  if (u.side === "party") {
    const out = dodge(b, rng, u);
    if (out) return out;
  }
  return usual(b, rng, u);
}

/** What `u` does by its lists: a Scion's own gambits first, then the satchel, its usual ways and the attack; with `closeIn`, a step toward the foe and Wait when nothing can be done. */
function usual(b: Battle, rng: Rng, u: Combatant, closeIn = true): Plan {
  const attack = abilityOf(u, "attack")!;
  // A Scion's own gambits come first (gambitset.ts); after them, as for one without, the satchel when
  // someone needs it (§13.7) and their usual ways. A creature's list is all it knows.
  const own = u.side === "party" && u.person !== undefined ? u.gambits : [];
  const mine = own.length ? follow(b, rng, u, own) : undefined;
  if (mine) return mine;
  if (!u.gambits.length || own.length) {
    const item = itemPlan(b, u);
    if (item) return { action: item };
  }
  const plan = follow(b, rng, u, u.gambits.length && !own.length ? u.gambits : defaultGambits(u)) ?? aimOrApproach(b, rng, u, attack);
  if (plan) return plan;
  return (closeIn && u.side === "party" ? approach(b, rng, u, attack, undefined, true) : undefined) ?? { action: { do: "defend" } };
}

/** The first of `rules` that holds and can be done now, or undefined. */
function follow(b: Battle, rng: Rng, u: Combatant, rules: readonly GambitRule[]): Plan | undefined {
  for (const g of rules) {
    if (!holds(b, u, g.if)) continue;
    if (g.do.startsWith("item:")) {
      const id = g.do.slice(5);
      const ab = cannotUseItem(b, u, id) ? undefined : itemAbility(u, id);
      const a = ab && aim(b, rng, u, ab, g.target);
      if (a?.do === "ability") return { action: { do: "item", item: id, target: a.target } };
      continue;
    }
    if (g.do === "wait" || g.do === "defend") return { action: { do: g.do } };
    if (g.do === "retreat") {
      // A captain falls back to E3 in its row and Defends (§14.5, the Apostate Court); nothing if it is there or cannot move.
      const back = COLS - u.size[0];
      if (u.col < back && !u.mods.noMove && !hasStatus(u, "rooted") && isFree(b, u.side, back, u.row, u.size, u.id)) return { move: [back, u.row], action: { do: "defend" } };
      continue;
    }
    const ab = abilityOf(u, g.do);
    if (!ab) continue;
    const plan = aimOrApproach(b, rng, u, ab, g.target);
    if (plan) return plan;
  }
  return undefined;
}

// A Scion's rule only steps somewhere if it can act from there; closing in and Waiting is the last
// resort, after every rule and the attack (Josh 2026-11-10: allied bots kept "move 1 square, then
// end turn"). A creature still closes in on its first rule that cannot reach.
function aimOrApproach(b: Battle, rng: Rng, u: Combatant, ab: AbilityDef, rule?: string, closeIn = u.side !== "party"): Plan | undefined {
  const action = aim(b, rng, u, ab, rule);
  if (action) return { action };
  return isSingle(ab) && ab.side === "foe" ? approach(b, rng, u, ab, rule, closeIn) : undefined;
}

/** Every cell of `u`'s side that a foe's shown charge (telegraphed, or read by Commune) will strike where it stands. */
export function dangerCells(b: Battle, u: Combatant): Set<string> {
  const out = new Set<string>();
  for (const f of b.units) {
    const c = f.charge;
    if (!c || f.dead || f.side === u.side || c.target.side !== u.side || c.homingOn !== undefined) continue;
    if (!c.ability.telegraph && !hasStatus(f, "communed")) continue;
    const cells = (c.ability.shape ?? "single") === "single" ? [c.target] : shapeCells(c.ability.shape, c.target, f);
    for (const x of cells) out.add(`${x.col}:${x.row}`);
  }
  return out;
}

/** A Scion standing where a shown attack will land steps out of it, acting from the new cell if it can (Josh 2026-11-10). */
function dodge(b: Battle, rng: Rng, u: Combatant): Plan | undefined {
  if (u.mods.noMove || hasStatus(u, "rooted") || hasStatus(u, "frozen")) return undefined;
  const danger = dangerCells(b, u);
  const covers = (c: number, r: number) => Array.from({ length: u.size[0] * u.size[1] }, (_, i) => `${c + (i % u.size[0])}:${r + Math.floor(i / u.size[0])}`).some((k) => danger.has(k));
  if (!danger.size || !covers(u.col, u.row)) return undefined;
  const reach = Math.min(TUNING.combat.move.maxCells, u.mods.maxMove ?? 9);
  const safe: [number, number, number][] = [];
  for (let dc = -2; dc <= 2; dc++) {
    for (let dr = -reach; dr <= reach; dr++) {
      const c = u.col + dc;
      const r = u.row + dr;
      const d = Math.abs(dc) + Math.abs(dr);
      if (d < 1 || d > reach || !isFree(b, u.side, c, r, u.size, u.id) || covers(c, r)) continue;
      safe.push([c, r, d * 10 + c]);
    }
  }
  if (!safe.length) return undefined;
  safe.sort((x, y) => x[2] - y[2]);
  const { col, row } = u;
  try {
    for (const [c, r] of safe) {
      u.col = c;
      u.row = r;
      const plan = usual(b, rng, u, false);
      if (!plan.move && plan.action.do !== "wait" && plan.action.do !== "defend") return { move: [c, r], action: plan.action };
    }
  } finally {
    u.col = col;
    u.row = row;
  }
  return { move: [safe[0]![0], safe[0]![1]], action: { do: "defend" } };
}

/** Without a list: heal the hurt if it can, then each ability in order, then attack. */
export function defaultGambits(u: Combatant): GambitRule[] {
  const out: GambitRule[] = [];
  for (const ab of u.abilities) {
    // Heals, Interpose and Rescue wait for an ally in trouble.
    if (ab.kind === "heal" || ab.interpose || ab.swap) out.push({ if: "ally.hp<0.5", do: ab.id, target: "ally_lowest_hp" });
    // Siphon only when MP runs low and HP can spare it.
    else if (ab.mpFromHp) out.push({ if: "self.hp>0.6&&self.mp<20", do: ab.id });
    // Brace and Last Stand wait until the user is badly hurt.
    else if (ab.defend || ab.self?.statuses?.some((x) => x.mods?.noHeal)) out.push({ if: "self.hp<0.5", do: ab.id });
    else out.push({ do: ab.id });
  }
  return out;
}
