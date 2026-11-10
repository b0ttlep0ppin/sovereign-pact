import { describe, expect, it } from "vitest";
import { FLAG, type Replay, type Vitals } from "@vibepulse/shared/games/sovereign-pact";
import { telegraphCells, telegraphed } from "./telegraph";

const vit = (id: number, row: number, flags: number): Vitals => [id, 10, 0, 0, 0, 0, row, flags, [], []];
const replay = (ev: Replay["frames"][number]["ev"][]): Replay => ({ title: "t", seed: 1, outcome: "retreat", units: [], start: [], frames: ev.map((e) => ({ ev: e, vit: [] })) }) as unknown as Replay;
const cell = { side: "party" as const, col: 0, row: 2 };

describe("telegraphed attacks (Josh 2026-11-10)", () => {
  it("marks the whole area an attack will strike, not just the cell it is aimed at", () => {
    // The Tree King's Canopy Fall: three rows across the whole width.
    expect(telegraphCells("band:3", cell)).toHaveLength(9);
    expect(telegraphCells("row", cell)).toHaveLength(3);
    expect(telegraphCells("all", cell)).toHaveLength(24);
    expect(telegraphCells("line:2", cell, 5).map((c) => c.row)).toEqual([5, 5, 5]);
    expect(telegraphCells("random:3", cell)).toHaveLength(24);
    expect(telegraphCells("single", cell)).toEqual([cell]);
  });

  it("keeps the mark up from the wind-up until the blow lands or the wind-up is broken", () => {
    const charge = { t: "charge" as const, unit: 9, ability: "canopy_fall", target: cell, ticks: 200, telegraph: true };
    const r = replay([[charge], [{ t: "turn", unit: 1, ct: 0 } as never], [{ t: "use", unit: 9, ability: "canopy_fall", target: cell }]]);
    const winding = new Map([[9, vit(9, 0, FLAG.charging)]]);
    expect(telegraphed(r, 1, winding).size).toBe(9);
    expect(telegraphed(r, 2, winding).has("party:2:3")).toBe(true);
    expect(telegraphed(r, 3, winding).size).toBe(0);
    // Stunned out of it: no longer charging.
    expect(telegraphed(r, 2, new Map([[9, vit(9, 0, 0)]])).size).toBe(0);
  });
});
