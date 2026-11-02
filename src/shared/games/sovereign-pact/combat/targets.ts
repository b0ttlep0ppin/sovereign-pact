// Who an ability can be aimed at and whom it hits when it lands (§10.2–10.3).
import type { Rng } from "../../../rng.ts";
import { TUNING } from "../tuning.ts";
import { reachOf } from "./damage.ts";
import { cellsOf, frontEachRow, hasStatus, isFree, lineTargets, meleeTargets, other, shapeCells, standing, unitsIn, unseen, untouchable } from "./grid.ts";
import { ROWS, type AbilityDef, type Battle, type Cell, type Combatant, type Side } from "./types.ts";

/** The side `u` fights for: a Charmed combatant fights for the other one (§10.8). */
export const allegiance = (u: Combatant): Side => (hasStatus(u, "charm") ? other(u.side) : u.side);

/** The grid an ability lands on, from the user's point of view. */
export const targetSide = (u: Combatant, ab: AbilityDef): Side => (ab.side === "foe" ? other(allegiance(u)) : allegiance(u));

/** Shapes that are aimed at one combatant rather than an area. */
export const isSingle = (ab: AbilityDef) => ab.shape === "single" || ab.shape === "lob";

/** Distance across the gap, for `nearest`: both sides' columns count from the gap. */
export const crossDistance = (a: Combatant, b: Combatant) =>
  a.side === b.side ? Math.abs(a.col - b.col) + Math.abs(a.row - b.row) : a.col + b.col + 1 + Math.abs(a.row - b.row);

/**
 * Combatants `u` may pick for a single-target `ab` (§10.3): melee follows the reach rules, and a Scion's
 * melee from Middle reaches only E1–E2 and from Back needs a reach weapon. A Scion's melee is lenient
 * about rows (DECISIONS 8am): it reaches the front-most foe of every row (tuning `scionMelee.rowReach`),
 * so any foe with nothing standing in front of it. Down and Hidden are not single-targetable by foes
 * (§10.9, §10.8); allies can always be picked.
 */
export function singleTargets(b: Battle, u: Combatant, ab: AbilityDef): Combatant[] {
  // Charge! picks from where the run ends.
  if (ab.rush) {
    const col = rushCol(b, u, ab.rush);
    if (col !== u.col) {
      const from = u.col;
      u.col = col;
      try {
        return singleTargets(b, u, { ...ab, rush: undefined });
      } finally {
        u.col = from;
      }
    }
  }
  const side = targetSide(u, ab);
  if (ab.side === "self") return [u];
  // Rescue swaps with a one-cell ally in the user's own row.
  if (ab.swap) return b.units.filter((t) => !t.dead && t.side === side && t.id !== u.id && !t.hazard && t.row === u.row && t.size[0] * t.size[1] === 1 && t.partOf === undefined);
  if (ab.side === "ally") return b.units.filter((t) => !t.dead && t.side === side && !t.hazard && (ab.kind !== "heal" || !t.down) && (!ab.interpose || t.id !== u.id));
  const reach = reachOf(u, ab);
  if (reach === "ranged" || ab.leap || side === u.side) return standing(b, side).filter((t) => !unseen(t));
  // A lurker that leapt in stands among the Scions: every Scion's melee reaches it (§14.3).
  const exposed = standing(b, side).filter((t) => hasStatus(t, "exposed"));
  if (u.side === "party") {
    const { rowReach, nearestIfNone } = TUNING.combat.scionMelee;
    const within = (n: number) => {
      const found = meleeTargets(b, u, reach, n);
      return u.col === 1 && reach === "melee" ? found.filter((t) => t.col <= 1) : found;
    };
    // From Back, melee needs a reach weapon.
    const can = u.col !== 2 || reach === "reach";
    let found = can ? within(rowReach) : [];
    for (let n = rowReach + 1; can && nearestIfNone && !found.length && n < ROWS; n++) found = within(n);
    return [...new Set([...found, ...exposed])];
  }
  return meleeTargets(b, u, reach);
}

/** Where a run of up to `cells` toward the Front of `u`'s row stops: the last free cell before anything in the way. */
export function rushCol(b: Battle, u: Combatant, cells: number): number {
  let col = u.col;
  while (col > 0 && u.col - col < cells && u.size[0] * u.size[1] === 1 && isFree(b, u.side, col - 1, u.row, u.size, u.id)) col--;
  return col;
}

/** The cell a combatant stands on (its top-left), for aiming. */
export const cellOf = (t: Combatant): Cell => ({ side: t.side, col: t.col, row: t.row });

/** Whom an ability hits when it resolves at `at` (each combatant once, §14.1). */
export function resolveTargets(b: Battle, rng: Rng, u: Combatant, ab: AbilityDef, at: Cell, homingOn?: number): Combatant[] {
  const side = targetSide(u, ab);
  const [name, arg] = ab.shape.split(":") as [string, string | undefined];
  const n = Number(arg ?? 1);
  const foes = () => standing(b, side).filter((t) => !unseen(t) || ab.side !== "foe");
  switch (name) {
    case "single":
    case "lob": {
      const followed = homingOn !== undefined ? b.units.find((t) => t.id === homingOn && !t.dead) : undefined;
      if (followed) return [followed];
      const there = unitsIn(b, [at]).filter((t) => t.side === side && (!untouchable(t) || ab.side !== "foe"));
      // A single strike on a Down Scion only lands if it was aimed at them while Down (finish, AoE); otherwise it misses the cell.
      return there.filter((t) => !t.down || ab.side !== "foe");
    }
    case "line":
      return lineTargets(b, u, n, u.row).filter((t) => t.side === side && (!untouchable(t) || ab.side !== "foe"));
    case "front_each_row":
      return frontEachRow(b, side).filter((t) => !t.dead && (!untouchable(t) || ab.side !== "foe"));
    case "nearest":
      return foes()
        .sort((x, y) => crossDistance(u, x) - crossDistance(u, y) || x.id - y.id)
        .slice(0, n);
    case "random": {
      const pool = foes();
      return pool.length ? Array.from({ length: n }, () => rng.pick(pool)) : [];
    }
    default: {
      const cells = shapeCells(ab.shape, at, u).map((c) => ({ ...c, side: name === "self" || name === "adjacent" || name === "ring" ? u.side : side }));
      return unitsIn(b, cells).filter((t) => (t.side === side && (!untouchable(t) || ab.side !== "foe")) || name === "self");
    }
  }
}

/** For AoE aiming: the cell of `side` whose shape covers the most standing combatants. */
export function bestCell(b: Battle, u: Combatant, ab: AbilityDef, side: Side): Cell {
  let best: Cell = { side, col: 0, row: 0 };
  let most = -1;
  for (let col = 0; col < 3; col++) {
    for (let row = 0; row < 8; row++) {
      const cell = { side, col, row };
      const hit = unitsIn(b, shapeCells(ab.shape, cell, u)).filter((t) => t.side === side && !t.dead && !t.down).length;
      if (hit > most) {
        most = hit;
        best = cell;
      }
    }
  }
  return best;
}

export const occupies = (t: Combatant, cell: Cell) => cellsOf(t).some((c) => c.col === cell.col && c.row === cell.row && c.side === cell.side);
