// Who an ability can be aimed at and whom it hits when it lands (§10.2–10.3).
import type { Rng } from "../../../rng.ts";
import { reachOf } from "./damage.ts";
import { cellsOf, frontEachRow, hasStatus, lineTargets, meleeTargets, other, shapeCells, standing, unitsIn, unseen } from "./grid.ts";
import type { AbilityDef, Battle, Cell, Combatant, Side } from "./types.ts";

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
 * melee from Middle reaches only E1–E2 and from Back needs a reach weapon. Down and Hidden are not
 * single-targetable by foes (§10.9, §10.8); allies can always be picked.
 */
export function singleTargets(b: Battle, u: Combatant, ab: AbilityDef): Combatant[] {
  const side = targetSide(u, ab);
  if (ab.side === "self") return [u];
  if (ab.side === "ally") return b.units.filter((t) => !t.dead && t.side === side && !t.hazard && (ab.kind !== "heal" || !t.down));
  const reach = reachOf(u, ab);
  if (reach === "ranged" || ab.leap || side === u.side) return standing(b, side).filter((t) => !unseen(t));
  // A lurker that leapt in stands among the Scions: every Scion's melee reaches it (§14.3).
  const exposed = standing(b, side).filter((t) => hasStatus(t, "exposed"));
  if (u.side === "party") {
    const found = u.col === 2 && reach !== "reach" ? [] : meleeTargets(b, u, reach);
    return [...new Set([...(u.col === 1 && reach === "melee" ? found.filter((t) => t.col <= 1) : found), ...exposed])];
  }
  return meleeTargets(b, u, reach);
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
      const there = unitsIn(b, [at]).filter((t) => t.side === side && (!hasStatus(t, "submerged") || ab.side !== "foe"));
      // A single strike on a Down Scion only lands if it was aimed at them while Down (finish, AoE); otherwise it misses the cell.
      return there.filter((t) => !t.down || ab.side !== "foe");
    }
    case "line":
      return lineTargets(b, u, n, u.row).filter((t) => t.side === side && (!hasStatus(t, "submerged") || ab.side !== "foe"));
    case "front_each_row":
      return frontEachRow(b, side).filter((t) => !t.dead && (!hasStatus(t, "submerged") || ab.side !== "foe"));
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
      return unitsIn(b, cells).filter((t) => (t.side === side && (!hasStatus(t, "submerged") || ab.side !== "foe")) || name === "self");
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
