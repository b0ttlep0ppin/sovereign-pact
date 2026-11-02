import { describe, expect, it } from "vitest";
import { slots } from "./assign.ts";
import { loseAccord, projectCost, stillNeeded } from "./commons.ts";
import { PROJECTS } from "./content.ts";
import { sovereignPact, type SovMove, type SovState } from "./index.ts";
import { calm, campaign, sealYear } from "./testing.ts";
import { TUNING } from "./tuning.ts";
import { view } from "./view.ts";

const g = sovereignPact;
const C = TUNING.commons;

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
const sealAll = sealYear;
/** A campaign whose Houses can pay for anything. */
const rich = (H: number): SovState => {
  const s = campaign(H, 4);
  for (const h of s.houses) Object.assign(h, { gold: 5000, stores: { grain: 500, timber: 500, stone: 500, iron: 500, essence: 500 } });
  return s;
};

describe("shared projects (§8.5)", () => {
  it("prices each level at 1.3× a House building of its tier", () => {
    const s = calm(campaign(2, 4));
    for (const p of PROJECTS.filter((x) => !x.requires && !x.unlockedBy)) {
      const base = TUNING.town.costs[p.cost][p.tiers[0]! - 1]!;
      expect(projectCost(s, p.id), p.id).toEqual(Object.fromEntries(Object.entries(base).map(([k, n]) => [k, Math.round(n! * C.costMult)])));
    }
  });

  it("takes public pledges up to what is needed, grants Renown by share, and stands at the Reckoning", () => {
    let s = rich(2);
    const cost = projectCost(s, "granary")!;
    s = move(s, "p1", { type: "pledge", project: "granary", give: { gold: 1000, timber: 5 } });
    expect(s.houses[0]!.gold).toBe(5000 - cost.gold!);
    expect(s.commons.funds.granary!.paid).toEqual({ gold: cost.gold, timber: 5 });
    expect(view(s, "p2").commons.funds.granary!.by).toEqual([cost.gold! + 5, 0]);
    expect(s.houses[0]!.score.renown).toBe(Math.floor((cost.gold! + 5) / C.renownPer));
    expect(error(s, "p2", { type: "pledge", project: "granary", give: { gold: 10 } })).toMatch(/nothing the project still needs/);
    s = move(s, "p2", { type: "pledge", project: "granary", give: { timber: 1000 } });
    expect(stillNeeded(s, "granary")).toEqual({});
    s = sealAll(s);
    expect(s.commons.built.granary).toBe(1);
    expect(s.commons.funds.granary).toBeUndefined();
    expect(error(s, "p1", { type: "pledge", project: "granary", give: { gold: 1 } })).toMatch(/complete/);
  });

  it("keeps a part-paid project open across Years", () => {
    let s = rich(2);
    s = sealAll(move(s, "p1", { type: "pledge", project: "walls", give: { gold: 5 } }));
    expect(s.commons.built.walls).toBeUndefined();
    expect(s.commons.funds.walls!.paid).toEqual({ gold: 5 });
  });

  it("builds Walls level by level, and the shops only after the Great Market", () => {
    let s = rich(1);
    expect(error(s, "p1", { type: "pledge", project: "armorer", give: { gold: 100 } })).toMatch(/wait/);
    const full = (x: SovState, id: string) => move(x, "p1", { type: "pledge", project: id, give: { gold: 999, timber: 999, stone: 999, iron: 999, essence: 999 } });
    s = sealAll(full(full(s, "walls"), "great_market"));
    expect(s.commons.built).toEqual({ walls: 1, great_market: 1 });
    expect(projectCost(s, "walls")).toEqual(Object.fromEntries(Object.entries(TUNING.town.costs.standard[1]!).map(([k, n]) => [k, Math.round(n! * C.costMult)])));
    s = full(s, "armorer");
    expect(s.commons.funds.armorer).toBeDefined();
  });

  it("refuses pledges a House cannot cover, and unknown projects", () => {
    const s = calm(campaign(2, 4));
    s.houses[0]!.gold = 3;
    expect(error(s, "p1", { type: "pledge", project: "granary", give: { gold: 10 } })).toMatch(/do not have/);
    expect(error(s, "p1", { type: "pledge", project: "colosseum", give: { gold: 1 } })).toMatch(/no such/);
  });
});

describe("what shared projects do", () => {
  it("Great Market: Gold for every House; Granary: less Grain upkeep", () => {
    const s = calm(campaign(2, 4));
    const a = sealAll(s);
    s.commons.built = { great_market: 1, granary: 1 };
    const b = sealAll(s);
    const market = C.marketGold - Math.round(C.marketGold * TUNING.economy.tithe);
    expect(b.houses[0]!.gold).toBe(a.houses[0]!.gold + market);
    expect(b.houses[0]!.stores.grain).toBeGreaterThanOrEqual(a.houses[0]!.stores.grain!);
  });

  it("Cathedral: Chapel slots for every House; Aqueduct: an Infirmary level; University: unlimited Study", () => {
    const s = calm(campaign(2, 4));
    s.houses[0]!.buildings.scriptorium = 1;
    expect([slots(s, 1, "chapel"), slots(s, 1, "infirmary"), slots(s, 0, "study")]).toEqual([0, 0, 1]);
    s.commons.built = { cathedral: 1, aqueduct: 1, university: 1 };
    expect([slots(s, 1, "chapel"), slots(s, 1, "infirmary"), slots(s, 1, "study")]).toEqual([C.cathedralChapelSlots, TUNING.assignments.infirmarySlots[0], Infinity]);
  });

  it("Court of Peers softens Accord losses", () => {
    const s = calm(campaign(2, 4));
    s.accord = 50;
    loseAccord(s, 20);
    expect(s.accord).toBe(30);
    s.commons.built.court_of_peers = 1;
    loseAccord(s, 20);
    expect(s.accord).toBe(30 - Math.round((20 * (100 - C.courtAccordPct)) / 100));
  });
});
