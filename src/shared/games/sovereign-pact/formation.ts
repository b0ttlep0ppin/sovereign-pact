// The formation (§10.12 step 1): where each Scion stands when a battle opens, set by their House on the
// party's 3×8 grid (columns Front, Middle, Back; rows 0–7) and kept between expeditions. A Scion with no
// post, or whose post another Scion already holds, stands in their Job's column in the first free row.
import { LOADOUTS } from "./combat/roster.ts";
import { COLS, ROWS } from "./combat/types.ts";
import type { Person, SovState } from "./state.ts";

export interface PostMove {
  person: number;
  /** Null clears the post: the Scion stands by their Job again. */
  col: number | null;
  row: number | null;
}

/** Why `house` cannot post that Scion there, or null. */
export function cannotPost(s: SovState, house: number, m: PostMove): string | null {
  const p = s.people.find((x) => x.id === m.person);
  if (!p || p.host !== house || (p.status !== "scion" && p.status !== "retired")) return "Only your own Scions take a place in the formation.";
  if (m.col === null || m.row === null) return m.col === m.row ? null : "Choose a cell.";
  if (!Number.isInteger(m.col) || !Number.isInteger(m.row) || m.col < 0 || m.col >= COLS || m.row < 0 || m.row >= ROWS) return "That cell is off the grid.";
  return null;
}

/** Posts the Scion; one of the House's own already there takes the mover's old place (or none). */
export function post(s: SovState, house: number, m: PostMove): void {
  const p = s.people.find((x) => x.id === m.person)!;
  if (m.col === null || m.row === null) {
    delete p.post;
    return;
  }
  const there = s.people.find((x) => x.id !== p.id && x.host === house && x.post?.[0] === m.col && x.post?.[1] === m.row);
  if (there) {
    if (p.post) there.post = [...p.post];
    else delete there.post;
  }
  p.post = [m.col, m.row];
}

/** Where each of `party` stands at the start of a battle, in party order: their post if it is free, else their Job's column. */
export function deploy(party: readonly Pick<Person, "post" | "job">[]): [col: number, row: number][] {
  const taken = new Set<string>();
  const key = (c: number, r: number) => `${c}:${r}`;
  const cells: ([number, number] | null)[] = party.map((p) => {
    if (!p.post || taken.has(key(...p.post))) return null;
    taken.add(key(...p.post));
    return [p.post[0], p.post[1]];
  });
  return party.map((p, i) => {
    const had = cells[i];
    if (had) return had;
    const home = LOADOUTS[p.job!]?.col ?? 1;
    // Their Job's column first, then the nearest others.
    for (const col of [home, ...[0, 1, 2].filter((c) => c !== home).sort((a, b) => Math.abs(a - home) - Math.abs(b - home))]) {
      for (let row = 0; row < ROWS; row++) {
        if (!taken.has(key(col, row))) {
          taken.add(key(col, row));
          return [col, row];
        }
      }
    }
    return [home, 0];
  });
}
