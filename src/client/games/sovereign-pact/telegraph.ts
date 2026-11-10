// Telegraphed attacks (§10.5): while a foe winds one up, every cell it will strike is marked, from the
// turn it begins until it lands (Josh 2026-11-10: the Tree King "occasionally telegraphs one attack
// always in the top left even if no one is there"; only the aimed cell was marked, and only that turn).
import { areaCells, Content, FLAG, type Cell, type Replay, type Vitals } from "@vibepulse/shared/games/sovereign-pact";

const COLS = 3;
const ROWS = 8;

/** Each ability's shape, from the creatures' own tables and the Jobs'. */
const SHAPES: ReadonlyMap<string, string> = new Map([
  ...[...Content.ENEMIES, ...Content.BOSSES].flatMap((e) => e.abilities.map((a) => [a.id, a.shape] as [string, string])),
  ...Content.ABILITY_SETS.flatMap((set) => set.actives.map((a) => [a.id, a.shape] as [string, string])),
]);

const whole = (side: Cell["side"]): Cell[] => Array.from({ length: COLS * ROWS }, (_, i) => ({ side, col: i % COLS, row: Math.floor(i / COLS) }));

/**
 * The cells a wound-up ability will strike. A line runs along its user's row; a shape that picks its
 * own victims as it lands (random, the front of each row) can hit anyone on that side.
 */
export function telegraphCells(shape: string | undefined, at: Cell, userRow?: number): Cell[] {
  const name = (shape ?? "single").split(":")[0];
  if (name === "line") return Array.from({ length: COLS }, (_, col) => ({ side: at.side, col, row: userRow ?? at.row }));
  if (name === "random" || name === "front_each_row") return whole(at.side);
  const cells = areaCells(shape ?? "single", at);
  return cells.length ? cells : [at];
}

/** Every cell marked by a telegraphed attack still winding up after `at` frames, as "side:col:row". */
export function telegraphed(replay: Replay, at: number, vit: ReadonlyMap<number, Vitals>): Set<string> {
  const winding = new Map<number, { ability: string; target: Cell }>();
  for (const f of replay.frames.slice(0, at)) {
    for (const e of f.ev) {
      if (e.t === "charge") {
        if (e.telegraph) winding.set(e.unit, e);
        else winding.delete(e.unit);
      } else if (e.t === "use") winding.delete(e.unit);
    }
  }
  const out = new Set<string>();
  for (const [unit, c] of winding) {
    const v = vit.get(unit);
    // Struck down, frozen or broken out of it: the wind-up is lost.
    if (!v || !(v[7] & FLAG.charging)) continue;
    for (const cell of telegraphCells(SHAPES.get(c.ability), c.target, v[6])) out.add(`${cell.side}:${cell.col}:${cell.row}`);
  }
  return out;
}
