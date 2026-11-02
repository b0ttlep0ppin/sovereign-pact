// Pugilist combos (§12.2, §12.10): a turn is a sequence of moves, each paying TP (+5 for each repeat of
// a move), ended by running out of TP or by a finisher whose pattern the moves before it make.
import { TUNING } from "../tuning.ts";
import type { AbilityDef, Combatant } from "./types.ts";

const K = TUNING.combat.combo;

/** Whether the tags before a finisher make its pattern: a tag list ending the sequence, or "distinct:n". */
export function fitsPattern(pattern: string, before: readonly Pick<AbilityDef, "id" | "move">[]): boolean {
  const distinct = /^distinct:(\d+)$/.exec(pattern);
  if (distinct) return new Set(before.map((m) => m.id)).size >= Number(distinct[1]);
  const tags = pattern.split(",");
  const tail = before.slice(-tags.length).map((m) => m.move?.tag);
  return tail.length === tags.length && tags.every((t, i) => t === tail[i]);
}

/** TP each move costs in this sequence: its own, +5 for every earlier use of the same move. */
export function comboTp(moves: AbilityDef[]): number[] {
  return moves.map((m, i) => (m.tp ?? 0) + K.repeatTp * moves.slice(0, i).filter((x) => x.id === m.id).length);
}

/** Why `u` cannot play this sequence, or null. A finisher must come last and fit its pattern. */
export function cannotCombo(u: Combatant, moves: AbilityDef[]): string | null {
  if (!moves.length) return "no moves";
  if (moves.some((m) => !m.move)) return "not a move";
  const tp = comboTp(moves);
  if (tp.reduce((a, b) => a + b, 0) > u.tp) return "tp";
  if (moves.reduce((n, m) => n + (m.mp ?? 0), 0) > u.mp) return "mp";
  for (let i = 0; i < moves.length; i++) {
    const f = moves[i]!.move!.finisher;
    if (!f) continue;
    if (i !== moves.length - 1) return "a finisher ends the sequence";
    if (!fitsPattern(f, moves.slice(0, i))) return `${moves[i]!.id} needs ${f}`;
  }
  return null;
}

/** CT for the whole sequence: 100, +10 for each move beyond the third. */
export const comboCt = (n: number): number => TUNING.combat.cost.action + K.extraCt * Math.max(0, n - K.freeMoves);
