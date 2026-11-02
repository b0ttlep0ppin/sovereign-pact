// Each Seat's district on the Town Map (DECISIONS 8ai): where its hall stands, where buildings go up,
// and what fills the rest, so a Keep's walled yard reads differently from a Harbor House's quay.
// One string per row: '#' the hall (a rectangle), a digit a building plot (filled in that order),
// and the rest scenery: w wall, ~ water, t trees, f fields, + graves, ^ rocks.

export type Deco = "w" | "~" | "t" | "f" | "+" | "^";
export const DECO_NAMES: Record<Deco, string> = { w: "wall", "~": "water", t: "trees", f: "fields", "+": "graves", "^": "rocks" };

const LAYOUTS: Record<string, string[]> = {
  keep: ["w0##1", "w2##3", "w4567", "wwwww"],
  chateau: ["t0##1", "t2##3", "45t67", "ttftt"],
  manor: ["01##f", "23##f", "4567f", "fffff"],
  abbey: ["0##1+", "2##3+", "4567+", "+++++"],
  spire: ["01#23", "45#67", "^^#^^", "^^^^^"],
  catacomb_hall: ["+0+1+", "2+3+4", "5##67", "+##++"],
  longhall: ["###01", "###23", "4567t", "ttttt"],
  harbor_house: ["01##2", "34##5", "67~~~", "~~~~~"],
};

export interface SeatLayout {
  cols: number;
  rows: number;
  /** The hall's box, 1-based grid lines: column, row, width, height. */
  hall: [number, number, number, number];
  /** Plot cells in fill order, 1-based [column, row]. */
  plots: [number, number][];
  deco: { at: [number, number]; kind: Deco }[];
}

function parse(rows: string[]): SeatLayout {
  const plots: { n: number; at: [number, number] }[] = [];
  const deco: SeatLayout["deco"] = [];
  const hall: [number, number][] = [];
  rows.forEach((line, r) =>
    [...line].forEach((ch, c) => {
      const at: [number, number] = [c + 1, r + 1];
      if (ch === "#") hall.push(at);
      else if (/\d/.test(ch)) plots.push({ n: Number(ch), at });
      else if (ch in DECO_NAMES) deco.push({ at, kind: ch as Deco });
    }),
  );
  const cs = hall.map((h) => h[0]);
  const rs = hall.map((h) => h[1]);
  const [c0, r0] = [Math.min(...cs), Math.min(...rs)];
  return {
    cols: Math.max(...rows.map((l) => l.length)),
    rows: rows.length,
    hall: [c0, r0, Math.max(...cs) - c0 + 1, Math.max(...rs) - r0 + 1],
    plots: plots.sort((a, b) => a.n - b.n).map((p) => p.at),
    deco,
  };
}

const PARSED = Object.fromEntries(Object.entries(LAYOUTS).map(([k, v]) => [k, parse(v)]));

/** The Seat's layout, with plain rows added below until every building has a plot. */
export function layoutFor(seat: string, buildings: number): SeatLayout {
  const base = PARSED[seat] ?? PARSED.keep!;
  const plots = [...base.plots];
  let rows = base.rows;
  while (plots.length < buildings) {
    rows += 1;
    for (let c = 1; c <= base.cols; c++) plots.push([c, rows]);
  }
  return { ...base, rows, plots };
}

export const SEAT_LAYOUT_IDS = Object.keys(LAYOUTS);
