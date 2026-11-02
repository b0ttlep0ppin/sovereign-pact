import { describe, expect, it } from "vitest";
import { Content } from "@vibepulse/shared/games/sovereign-pact";
import { layoutFor, SEAT_LAYOUT_IDS } from "./seatLayouts";

describe("Seat districts (DECISIONS 8ai)", () => {
  it("lays out every Seat: a hall, at least 8 plots, and no two things on one cell", () => {
    expect([...SEAT_LAYOUT_IDS].sort()).toEqual(Content.SEATS.map((s) => s.id).sort());
    for (const id of SEAT_LAYOUT_IDS) {
      const L = layoutFor(id, 0);
      expect(L.plots.length).toBeGreaterThanOrEqual(8);
      const [c, r, w, h] = L.hall;
      const cells = [...L.plots, ...L.deco.map((d) => d.at)].map((x) => x.join());
      for (let x = c; x < c + w; x++) for (let y = r; y < r + h; y++) cells.push(`${x},${y}`);
      expect(new Set(cells).size).toBe(cells.length);
    }
  });

  it("adds rows of plots when a House outgrows its Seat", () => {
    const L = layoutFor("keep", 12);
    expect(L.plots.length).toBeGreaterThanOrEqual(12);
    expect(L.rows).toBeGreaterThan(layoutFor("keep", 0).rows);
  });
});
