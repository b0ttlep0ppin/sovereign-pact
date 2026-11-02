import { describe, expect, it } from "vitest";
import { BUILDINGS } from "./content.ts";
import { sovereignPact, type SovMove, type SovState } from "./index.ts";
import { ascendancy, categories } from "./score.ts";
import { ashore, calm, campaign, playOut } from "./testing.ts";
import { buildCost } from "./town.ts";
import { TUNING } from "./tuning.ts";
import { view } from "./view.ts";

const g = sovereignPact;

const move = (s: SovState, player: string, m: SovMove): SovState => {
  const r = g.applyMove(s, player, m);
  if (!r.ok) throw new Error(r.error);
  return r.state;
};
const error = (s: SovState, player: string, m: SovMove): string => {
  const r = g.applyMove(s, player, m);
  if (r.ok) throw new Error("expected a refusal");
  return r.error;
};
/** Seals every House: the Year turns over. */
const sealAll = (s: SovState): SovState => s.players.reduce((x, p, i) => (x.houses[i]!.sealed ? x : move(x, p, { type: "seal" })), s);

describe("House buildings (§8.3–8.4)", () => {
  it("shows the House what each building's next level costs, and why it cannot build", () => {
    let s = calm(campaign(2, 3));
    s.commons.gold = 100;
    s = move(s, "p1", { type: "build", building: "farm" });
    const builds = view(s, "p1").mine!.builds;
    expect(builds.find((b) => b.id === "farm")).toEqual({ id: "farm", level: 1, cost: buildCost("farm", 1), why: null });
    expect(builds.find((b) => b.id === "quarry")!.why).toMatch(/busy/);
    const open = view(s, "p1").mine!.projects;
    expect(open.find((p) => p.id === "granary")).toMatchObject({ level: 1, propose: null });
    expect(open.every((p) => Object.keys(p.need).length > 0)).toBe(true);
  });

  it("costs every building by its class at every level", () => {
    for (const b of BUILDINGS) for (const level of [1, 2, 3]) expect(buildCost(b.id, level), `${b.id} L${level}`).toEqual(TUNING.town.costs[b.cost][level - 1]);
    expect(buildCost("farm", 4)).toBeNull();
    expect(buildCost("nowhere", 1)).toBeNull();
  });

  it("pays at once and stands at the Reckoning, one build a Year", () => {
    let s = calm(campaign(2, 3));
    const h0 = s.houses[0]!;
    const before = { gold: h0.gold, timber: h0.stores.timber! };
    s = move(s, "p1", { type: "build", building: "farm" });
    const cost = buildCost("farm", 1)!;
    expect(s.houses[0]!.gold).toBe(before.gold - cost.gold!);
    expect(s.houses[0]!.stores.timber).toBe(before.timber - cost.timber!);
    expect(s.houses[0]!.works).toEqual(["farm"]);
    expect(s.houses[0]!.buildings.farm).toBeUndefined();
    expect(error(s, "p1", { type: "build", building: "quarry" })).toMatch(/busy/);
    s = sealAll(s);
    expect(s.year).toBe(2);
    expect(s.houses[0]!.buildings.farm).toBe(1);
    expect(s.houses[0]!.works).toEqual([]);
  });

  it("refunds a build taken back the same Year", () => {
    const s = calm(campaign(2, 3));
    const t = move(move(s, "p1", { type: "build", building: "farm" }), "p1", { type: "unbuild", building: "farm" });
    expect(t.houses[0]).toEqual(s.houses[0]);
    expect(error(t, "p1", { type: "unbuild", building: "farm" })).toMatch(/not going up/);
  });

  it("refuses what a House cannot pay for, an unknown building, and building while sealed", () => {
    let s = calm(campaign(2, 3));
    s.houses[0]!.stores.timber = 0;
    expect(error(s, "p1", { type: "build", building: "farm" })).toMatch(/pay/);
    expect(error(s, "p1", { type: "build", building: "palace" })).toMatch(/no such/);
    s = move(s, "p2", { type: "seal" });
    expect(error(s, "p2", { type: "build", building: "farm" })).toMatch(/Unseal/);
  });

  it("stops at level 3", () => {
    const s = calm(campaign(1, 3));
    s.houses[0]!.buildings.farm = 3;
    expect(error(s, "p1", { type: "build", building: "farm" })).toMatch(/highest/);
  });

  it("runs producers from the Year after they stand, the Commons taking its tithe", () => {
    let s = calm(campaign(2, 3));
    s.houses[0]!.buildings.quarry = 2;
    const stone = s.houses[0]!.stores.stone ?? 0;
    // A recruit with nothing to do lends the Quarry a hand (8ae).
    const hand = s.people.some((p) => p.host === 0 && p.status === "recruit" && !s.assign[p.id]) ? TUNING.assignments.work : 0;
    s = sealAll(s);
    const made = TUNING.town.produce[1]! + hand;
    const tithe = Math.round(made * TUNING.economy.tithe);
    expect(s.houses[0]!.stores.stone).toBe(stone + made - tithe);
    expect(s.commons.stores.stone).toBe(tithe);
  });

  it("gives Essence from a Shrine and interest from a Vault at L2", () => {
    let s = calm(campaign(1, 3));
    s.houses[0]!.buildings = { shrine: 1, vault: 2 };
    s.houses[0]!.gold = 1000;
    s = sealAll(s);
    expect(s.houses[0]!.stores.essence).toBe(TUNING.town.shrineEssence - Math.round(TUNING.town.shrineEssence * TUNING.economy.tithe));
    // Interest on the Gold held before the Year's income and upkeep.
    expect(s.houses[0]!.gold).toBeGreaterThan(1000 + (1000 * TUNING.town.vaultInterestPct) / 100 - 50);
  });

  it("counts building levels as Holdings, and the Vault raises Treasury", () => {
    const s = calm(campaign(1, 3));
    s.houses[0]!.buildings = { farm: 2, chapel: 1 };
    expect(categories(s, 0).holdings).toBe(3 * TUNING.town.holdingsPerLevel);
    s.houses[0]!.gold = 1000;
    const plain = categories(s, 0).treasury;
    s.houses[0]!.buildings.vault = 3;
    expect(categories(s, 0).treasury).toBe(Math.floor(plain * (1 + TUNING.town.vaultTreasuryPct[2]! / 100)));
    expect(ascendancy(s, 0)).toBeGreaterThan(0);
  });

  it("shows every House's works on the Town Map", () => {
    const s = move(calm(campaign(2, 3)), "p1", { type: "build", building: "farm" });
    expect(view(s, "p2").houses[0]!.works).toEqual(["farm"]);
  });
});

describe("the settlement bot builds", () => {
  it("keeps its upkeep reserve and raises a town over a campaign", () => {
    for (const H of [1, 4]) {
      let negative = false;
      const end = playOut(ashore(campaign(H, 11)), (s) => {
        if (s.houses.some((h) => h.gold < 0)) negative = true;
      });
      expect(negative).toBe(false);
      const levels = end.houses.map((h) => Object.values(h.buildings).reduce<number>((a, b) => a + (b ?? 0), 0));
      expect(Math.min(...levels), `H=${H}`).toBeGreaterThanOrEqual(5);
    }
  });
});
