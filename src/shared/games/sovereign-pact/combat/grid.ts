// The two 3×8 grids (§10.1), targeting shapes (§10.2) and the reach rules (§10.3).
import type { Rng } from "../../../rng.ts";
import { COLS, ROWS, type Battle, type Cell, type Combatant, type Side } from "./types.ts";

export const other = (side: Side): Side => (side === "party" ? "enemy" : "party");

/** Beyond every blow, area or not: Submerged (Scylla) or Guarded by its Parts (Orochi's body). */
export const untouchable = (t: Combatant): boolean => hasStatus(t, "submerged") || hasStatus(t, "guarded");

/** Out of a foe's sight: Hidden (single targets) or untouchable (anything). */
export const unseen = (t: Combatant): boolean => hasStatus(t, "hidden") || untouchable(t);

/** Every cell a combatant stands on. */
export function cellsOf(u: Combatant): Cell[] {
  const out: Cell[] = [];
  for (let c = 0; c < u.size[0]; c++) for (let r = 0; r < u.size[1]; r++) out.push({ side: u.side, col: u.col + c, row: u.row + r });
  return out;
}

export const rowsOf = (u: Combatant): number[] => Array.from({ length: u.size[1] }, (_, i) => u.row + i);

export const covers = (u: Combatant, cell: Cell): boolean =>
  u.side === cell.side && cell.col >= u.col && cell.col < u.col + u.size[0] && cell.row >= u.row && cell.row < u.row + u.size[1];

export const inGrid = (cell: Cell): boolean => cell.col >= 0 && cell.col < COLS && cell.row >= 0 && cell.row < ROWS;

/** Combatants still on the field (dead ones are gone; Down Scions still lie on their cells, §10.9). */
export const present = (b: Battle): Combatant[] => b.units.filter((u) => !u.dead);
export const standing = (b: Battle, side?: Side): Combatant[] => b.units.filter((u) => !u.dead && !u.down && (!side || u.side === side));

/** Who stands on a cell: a Part over the body it sits on (§14.1). */
export function unitAt(b: Battle, cell: Cell): Combatant | undefined {
  const here = present(b).filter((u) => covers(u, cell));
  return here.find((u) => u.partOf !== undefined) ?? here[0];
}

export function isFree(b: Battle, side: Side, col: number, row: number, size: [number, number] = [1, 1], ignore?: number): boolean {
  for (let c = 0; c < size[0]; c++) {
    for (let r = 0; r < size[1]; r++) {
      const cell = { side, col: col + c, row: row + r };
      if (!inGrid(cell)) return false;
      const there = unitAt(b, cell);
      if (there && there.id !== ignore) return false;
    }
  }
  return true;
}

/** Manhattan distance between two combatants' nearest cells on the same side. */
export function distance(a: Combatant, b: Combatant): number {
  let best = Infinity;
  for (const x of cellsOf(a)) for (const y of cellsOf(b)) best = Math.min(best, Math.abs(x.col - y.col) + Math.abs(x.row - y.row));
  return best;
}

/**
 * Who a melee attack from `u` can reach (§10.3): in each row it occupies, the front-most opponent.
 * A `reach` weapon or monster also reaches the one behind it; a flyer reaches anyone in its rows.
 * Down Scions are not single-targetable (§10.9) and Hidden ones not at all.
 */
export function meleeTargets(b: Battle, u: Combatant, reach: "melee" | "reach" = "melee"): Combatant[] {
  const foes = standing(b, other(u.side)).filter((f) => !unseen(f));
  if (u.tags.includes("flyer")) return foes.filter((f) => rowsOf(f).some((r) => rowsOf(u).includes(r)));
  const out = new Set<Combatant>();
  for (const row of rowsOf(u)) {
    const inRow = present(b)
      .filter((f) => f.side !== u.side && rowsOf(f).includes(row))
      .sort((x, y) => x.col - y.col);
    // A Down Scion still blocks the row it lies in; only the standing can be struck. A body and its
    // Parts in the same column are one front: any of them can be struck.
    const group = (f: Combatant) => f.partOf ?? f.id;
    const fronts = [...new Set(inRow.map(group))].slice(0, reach === "reach" ? 2 : 1);
    for (const g of fronts) {
      const members = inRow.filter((f) => group(f) === g);
      members.filter((f) => f.col === members[0]!.col).forEach((f) => foes.includes(f) && out.add(f));
    }
  }
  return [...out];
}

export const hasStatus = (u: Combatant, id: string): boolean => u.statuses.some((s) => s.id === id);

/** Single-target weights by column: Front 45 / Middle 35 / Back 20, or Back-heavy for `lob` (§10.2–10.3). */
const COLUMN_WEIGHTS = { column_weighted: [45, 35, 20], lob: [20, 30, 50] } as const;

/**
 * Picks a single target among `candidates` by the column rule: a column first (among occupied ones; an
 * empty column's weight passes to the next one back), then a combatant within it, weighted by Provoke.
 */
export function pickWeighted(rng: Rng, candidates: Combatant[], rule: keyof typeof COLUMN_WEIGHTS = "column_weighted"): Combatant | undefined {
  if (!candidates.length) return undefined;
  const base = COLUMN_WEIGHTS[rule];
  const weights = [0, 0, 0];
  let carry = 0;
  for (let col = 0; col < COLS; col++) {
    const occupied = candidates.some((c) => c.col === col);
    if (occupied) {
      weights[col] = base[col]! + carry;
      carry = 0;
    } else carry += base[col]!;
  }
  // Weight left over at the back goes to the nearest occupied column.
  if (carry) weights[Math.max(...candidates.map((c) => c.col))]! += carry;
  const scored = candidates.map((c) => {
    const inCol = candidates.filter((x) => x.col === c.col).length;
    const provoke = hasStatus(c, "provoke") ? 3 : 1;
    return { c, w: (weights[c.col]! / inCol) * provoke };
  });
  const total = scored.reduce((s, x) => s + x.w, 0);
  let roll = rng.next() * total;
  for (const x of scored) {
    roll -= x.w;
    if (roll < 0) return x.c;
  }
  return scored.at(-1)!.c;
}

/** The cells a shape covers when aimed at `at` (§10.2). Shapes that pick their own targets return []. */
export function shapeCells(shape: string, at: Cell, user: Combatant): Cell[] {
  const [name, arg] = shape.split(":") as [string, string | undefined];
  const cells: Cell[] = [];
  const add = (col: number, row: number) => {
    const c = { side: at.side, col, row };
    if (inGrid(c)) cells.push(c);
  };
  const box = (n: number) => {
    const h = Math.floor(n / 2);
    for (let dc = -h; dc <= h; dc++) for (let dr = -h; dr <= h; dr++) add(at.col + dc, at.row + dr);
  };
  switch (name) {
    case "single":
    case "lob":
      add(at.col, at.row);
      break;
    case "row":
      for (let col = 0; col < COLS; col++) add(col, at.row);
      break;
    case "column": {
      const col = arg ? { F: 0, M: 1, B: 2 }[arg] ?? at.col : at.col;
      for (let row = 0; row < ROWS; row++) add(col, row);
      break;
    }
    case "band": {
      const n = Number(arg ?? 3);
      const top = Math.min(Math.max(0, at.row - Math.floor((n - 1) / 2)), ROWS - n);
      for (let row = top; row < top + n; row++) for (let col = 0; col < COLS; col++) add(col, row);
      break;
    }
    case "cross":
      add(at.col, at.row);
      add(at.col - 1, at.row);
      add(at.col + 1, at.row);
      add(at.col, at.row - 1);
      add(at.col, at.row + 1);
      break;
    case "burst":
      box(arg === "5x5" ? 5 : 3);
      break;
    case "checker": {
      const parity = arg === "b" ? 1 : 0;
      for (let col = 0; col < COLS; col++) for (let row = 0; row < ROWS; row++) if ((col + row) % 2 === parity) add(col, row);
      break;
    }
    case "all":
      for (let col = 0; col < COLS; col++) for (let row = 0; row < ROWS; row++) add(col, row);
      break;
    case "self":
      return [...cellsOf(user)];
    case "adjacent":
    case "ring": {
      const self = cellsOf(user);
      const near = new Map<string, Cell>();
      for (const c of self) {
        for (let dc = -1; dc <= 1; dc++) {
          for (let dr = -1; dr <= 1; dr++) {
            if (name === "adjacent" && Math.abs(dc) + Math.abs(dr) !== 1) continue;
            const n = { side: user.side, col: c.col + dc, row: c.row + dr };
            if (inGrid(n) && !self.some((s) => s.col === n.col && s.row === n.row)) near.set(`${n.col},${n.row}`, n);
          }
        }
      }
      return name === "adjacent" ? [...self, ...near.values()] : [...near.values()];
    }
    default:
      break;
  }
  return cells;
}

/** The combatants a shape hits, each once however many of its cells are covered (§14.1). */
export function unitsIn(b: Battle, cells: Cell[]): Combatant[] {
  const hit = new Set<Combatant>();
  for (const cell of cells) {
    const u = unitAt(b, cell);
    if (u) hit.add(u);
  }
  return [...hit];
}

/** `line:n`: from the user's row straight across the other side, the first n occupied cells' combatants. */
export function lineTargets(b: Battle, user: Combatant, n: number, row = user.row): Combatant[] {
  const side = other(user.side);
  const out: Combatant[] = [];
  for (let col = 0; col < COLS && out.length < n; col++) {
    const u = unitAt(b, { side, col, row });
    if (u && !out.includes(u)) out.push(u);
  }
  return out;
}

/** `front_each_row`: the front-most combatant of every row on a side. */
export function frontEachRow(b: Battle, side: Side): Combatant[] {
  const out = new Set<Combatant>();
  for (let row = 0; row < ROWS; row++) {
    const front = present(b)
      .filter((u) => u.side === side && rowsOf(u).includes(row))
      .sort((x, y) => x.col - y.col)[0];
    if (front) out.add(front);
  }
  return [...out];
}
