import { describe, expect, it } from "vitest";
import { ascendancy, categories, placements, standing } from "./score.ts";
import { campaign } from "./testing.ts";

describe("Ascendancy (§3.4)", () => {
  it("doubles the Ambition's category and halves its other", () => {
    const s = campaign(2);
    const h = s.houses[0]!;
    h.ambition = { double: "valor", halve: "lore" };
    const before = ascendancy(s, 0);
    h.score.valor += 10;
    expect(ascendancy(s, 0)).toBe(before + 20);
    h.score.lore += 10;
    expect(ascendancy(s, 0)).toBe(before + 25);
    h.score.renown += 10;
    expect(ascendancy(s, 0)).toBe(before + 35);
  });

  it("counts Treasury from Gold held, net of debt", () => {
    const s = campaign(1);
    s.houses[0]!.gold = 95;
    s.houses[0]!.debt = 25;
    expect(categories(s, 0).treasury).toBe(7);
  });

  it("shows Standing as a tier against the kingdom's mean, Steady when alone", () => {
    const s = campaign(4);
    for (const h of s.houses) h.ambition = { double: "relics", halve: "intrigue" };
    s.houses[0]!.score.valor = 200;
    s.houses[3]!.score.valor = -30;
    expect(standing(s, 0)).toBe("ascendant");
    expect(standing(s, 3)).toBe("waning");
    expect(standing(campaign(1), 0)).toBe("steady");
  });

  it("places the highest Ascendancy first, ties sharing a place", () => {
    const s = campaign(3);
    for (const h of s.houses) h.ambition = { double: "relics", halve: "intrigue" };
    const base = s.houses.map((_, i) => ascendancy(s, i));
    s.houses.forEach((h, i) => (h.score.valor = 1000 - base[i]!));
    s.houses[2]!.score.valor += 5;
    expect(placements(s)).toEqual([2, 2, 1]);
  });
});
