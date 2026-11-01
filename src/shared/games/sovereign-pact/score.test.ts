import { describe, expect, it } from "vitest";
import { ascendancy, categories, placements, standing } from "./score.ts";
import { mint } from "./items.ts";
import { campaign } from "./testing.ts";
import { TUNING } from "./tuning.ts";

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

  it("counts Treasury from Gold held, net of debt, and stores at a Gold a unit, rare ones at ten", () => {
    const s = campaign(1);
    s.houses[0]!.stores = {};
    s.houses[0]!.gold = 95;
    s.houses[0]!.debt = 25;
    expect(categories(s, 0).treasury).toBe(7);
    s.houses[0]!.stores = { timber: 20, wyrmbone: 1 };
    expect(categories(s, 0).treasury).toBe(Math.floor((70 + 20 * TUNING.scoring.storeGold + TUNING.scoring.rareGold) / TUNING.scoring.goldPerPoint));
  });

  it("counts Lineage from the living, their levels and potential, and Wards hosted", () => {
    const s = campaign(2);
    const L = TUNING.scoring.lineage;
    s.people = s.people.filter((p) => p.host !== 0);
    expect(categories(s, 0).lineage).toBe(0);
    const ward = { ...s.people.find((p) => p.host === 1 && p.status === "scion")!, id: 900, host: 0, level: 10, potential: "gifted" as const };
    s.people.push(ward);
    expect(categories(s, 0).lineage).toBe(L.scion + 10 / L.levelsPerPoint + L.potential.gifted + L.ward);
    s.people.push({ ...ward, id: 901, status: "lost" });
    expect(categories(s, 0).lineage).toBe(L.scion + 10 / L.levelsPerPoint + L.potential.gifted + L.ward);
  });

  it("counts Relics from Relic-tier and named items the House owns", () => {
    const s = campaign(2);
    const before = categories(s, 0).relics;
    mint(s, "sword", 0, 5);
    mint(s, "ring", 1, 5);
    mint(s, "ring", 0, 3).named = "x";
    expect(categories(s, 0).relics).toBe(before + TUNING.scoring.relic + TUNING.scoring.named);
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
