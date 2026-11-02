import { describe, expect, it } from "vitest";
import { Content } from "@vibepulse/shared/games/sovereign-pact";
import { CHARGES } from "./charges";

describe("the heraldic charges", () => {
  it("draws every charge a House can take, and nothing else, each 16 by 16 in the four marks", () => {
    expect(Object.keys(CHARGES).sort()).toEqual([...Content.HERALDRY.charges].sort());
    for (const [id, rows] of Object.entries(CHARGES)) {
      expect(rows.length, id).toBe(16);
      for (const row of rows) expect(row, id).toMatch(/^[.#o+]{16}$/);
    }
  });
});
