// The Gambler's dice (§12.2, §12.7): Cast Lots at the start of each turn, and abilities that roll 2d6
// for their own value with Double Down. Every number is in tuning.combat.dice.
import type { Rng } from "../../../rng.ts";
import { TUNING } from "../tuning.ts";
import { hasStatus } from "./grid.ts";
import { removeStatus } from "./status.ts";
import type { AbilityDef, Battle, Combatant } from "./types.ts";

const D = TUNING.combat.dice;

/** Two six-sided dice, as they land (the same draws as a 2d6 total). */
export const throwDice = (rng: Rng): [number, number] => [1 + rng.int(6), 1 + rng.int(6)];

/** How much lower a Double Down roll must come to fizzle the ability (House Edge, Risk Taker). */
export const fizzleMargin = (u: Combatant): number => D.fizzleMargin + (u.mods.fizzleAt ?? 0);

/** Cast Lots: 2d6 at the start of a Gambler's turn and the total's effect (§12.7). */
export function castLots(b: Battle, rng: Rng, u: Combatant): number {
  const dice = throwDice(rng);
  let total = dice[0] + dice[1];
  if (total === 2 && u.mods.weighted) total = 3;
  const floor = u.flags.indexOf("lots_floor7");
  if (floor >= 0) {
    total = Math.max(total, 7);
    u.flags.splice(floor, 1);
  }
  b.events.push({ t: "lots", unit: u.id, total, dice, cast: true });
  // Lucky Streak: each 7+ in a row adds crit; a 6 or lower resets it.
  u.mods.lotsStreak = total >= 7 ? (u.mods.lotsStreak ?? 0) + 1 : 0;
  const pctOf = (max: number, p: number) => Math.round((max * p) / 100);
  if (total === 2) u.mods.nextActionCt = (u.mods.nextActionCt ?? 0) + D.snakeEyesCt;
  else if (total <= 4) u.tp = Math.max(0, u.tp - D.tp);
  else if (total === 6) u.mods["turn.evasion"] = D.evasion;
  else if (total === 7) u.hp = Math.min(u.maxHp, u.hp + pctOf(u.maxHp, D.restorePct));
  else if (total === 8) u.mp = Math.min(u.maxMp, u.mp + pctOf(u.maxMp, D.restorePct));
  else if (total === 9) u.tp = Math.min(TUNING.combat.tp.max, u.tp + D.tp);
  else if (total === 10) u.mods["turn.accuracy"] = D.accuracy;
  else if (total === 11) u.flags.push("sure_hit");
  else if (total === 12) u.flags.push("next_crit", "lots_twelve");
  return total;
}

/**
 * An ability's own 2d6, Doubled Down `times` (at most 3): each new roll replaces the total unless it is
 * lower by the fizzle margin or more, which fizzles the ability (null). Marked Card makes it 11.
 * `rolled` is a roll already made in the open (fight.ts: the commander saw each throw and chose to stop),
 * its throws already in the events.
 */
export function abilityDice(b: Battle, rng: Rng, u: Combatant, target: Combatant | undefined, times = 0, rolled?: number | null): number | null {
  if (target && hasStatus(target, "loaded_card")) {
    removeStatus(b, target, "loaded_card");
    return 11;
  }
  if (rolled !== undefined) return rolled;
  let dice = throwDice(rng);
  let total = dice[0] + dice[1];
  const margin = fizzleMargin(u);
  for (let i = 0; i < Math.min(times, D.maxDoubleDown); i++) {
    const next = throwDice(rng);
    if (total - next[0] - next[1] >= margin) {
      b.events.push({ t: "fizzle", unit: u.id, total: next[0] + next[1], dice: next });
      return null;
    }
    dice = next;
    total = next[0] + next[1];
  }
  b.events.push({ t: "lots", unit: u.id, total, dice });
  return total;
}

/** The ability as the dice made it: its power or restore set by the total; `self` when it backfires on the user. */
export function rolledAbility(ab: AbilityDef, total: number): { ab: AbilityDef; self?: boolean } {
  const d = ab.dice!;
  if (d.scale) return { ab: { ...ab, power: (total * d.scale) / 100 } };
  if (d.restorePct) return { ab: { ...ab, restore: { ...ab.restore, hpPct: total * d.restorePct } } };
  if (d.high !== undefined && total >= d.high) return { ab: { ...ab, power: d.highPower ?? ab.power } };
  if (d.low !== undefined && total <= d.low) return d.lowHitsSelf ? { ab, self: true } : { ab: { ...ab, power: d.lowPower ?? ab.power } };
  return { ab: { ...ab, power: d.otherwise ?? ab.power } };
}
