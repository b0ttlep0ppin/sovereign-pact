import { describe, expect, it } from "vitest";
import { Content } from "@vibepulse/shared/games/sovereign-pact";
import { BUILDING_ICONS, JOB_ICONS, SEAT_ART } from "./icons";

const square = (art: Record<string, readonly string[]>, n: number) => {
  for (const [id, rows] of Object.entries(art)) {
    expect(rows.length, id).toBe(n);
    for (const row of rows) expect(row, id).toMatch(new RegExp(`^[.#o+]{${n}}$`));
  }
};

describe("the Town Map's pixel art", () => {
  it("draws every Job (and the recruit), every Seat and every House building", () => {
    expect(Object.keys(JOB_ICONS).sort()).toEqual([...Content.JOBS.map((j) => j.id), "recruit"].sort());
    expect(Object.keys(SEAT_ART).sort()).toEqual(Content.SEATS.map((s) => s.id).sort());
    expect(Object.keys(BUILDING_ICONS).sort()).toEqual(Content.BUILDINGS.map((b) => b.id).sort());
    square(JOB_ICONS, 12);
    square(SEAT_ART, 16);
    square(BUILDING_ICONS, 12);
  });
});
