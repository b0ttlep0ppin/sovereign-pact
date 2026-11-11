import { describe, expect, it } from "vitest";
import { Content } from "@vibepulse/shared/games/sovereign-pact";
import { ITEM_ICONS, ITEM_SHAPES } from "./itemIcons";

describe("consumable icons", () => {
  it("draws every consumable, each shape 12×12", () => {
    for (const c of Content.CONSUMABLES) expect(ITEM_SHAPES[ITEM_ICONS[c.id]?.[0] ?? ""], c.id).toBeDefined();
    for (const [k, rows] of Object.entries(ITEM_SHAPES)) {
      expect(rows.length, k).toBe(12);
      for (const r of rows) expect(r, k).toMatch(/^[.#o+]{12}$/);
    }
  });
});
