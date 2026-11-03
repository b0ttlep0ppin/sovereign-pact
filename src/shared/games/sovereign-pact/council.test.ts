// The Commons Council (Josh 2026-11-03: "these things should be debated by the players"): a proposal names
// the district a project would stand in, its host takes a perk every Year, and a levy can be moved.
import { describe, expect, it } from "vitest";
import { PROJECT_BY_ID } from "./content.ts";
import { sovereignPact as g, type SovMove, type SovState } from "./index.ts";
import { calm, campaign } from "./testing.ts";
import { TUNING } from "./tuning.ts";
import { reckoning } from "./year.ts";

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
/** Three Houses and a Commons stocked to pay for a Granary outright. */
const council = () => {
  const s = calm(campaign(3, 4));
  s.commons.built = {};
  s.commons.gold = 500;
  s.commons.stores = { timber: 200, stone: 200, iron: 200, grain: 200 };
  for (const h of s.houses) h.gold = 100;
  return s;
};

describe("the Commons Council", () => {
  it("sites a project where the proposal says, and its host takes the perk every Year", () => {
    let s = council();
    s = move(s, "p1", { type: "propose", project: "granary", host: 2 });
    expect(s.vote).toMatchObject({ kind: "spend", host: 2 });
    for (const p of ["p1", "p2", "p3"]) s = move(s, p, { type: "vote", choice: 0 });
    expect(s.commons.funds.granary?.host).toBe(2);
    const grain = s.houses.map((h) => h.stores.grain ?? 0);
    reckoning(s);
    expect(s.commons.built.granary).toBe(1);
    expect(s.commons.hosts?.granary).toBe(2);
    expect(s.log.some((l) => String(typeof l === "string" ? l : JSON.stringify(l)).includes(`in House ${s.houses[2]!.name}'s district`))).toBe(true);
    // Everyone's Grain moves at the Reckoning; the host's moves by the perk more.
    const perk = PROJECT_BY_ID.get("granary")!.host!.resources!.grain!;
    const gained = s.houses.map((h, i) => (h.stores.grain ?? 0) - grain[i]!);
    expect(gained[2]! - gained[1]!).toBe(perk);
  });

  it("refuses to site a project a second time somewhere else", () => {
    let s = council();
    s.commons.hosts = { granary: 1 };
    expect(error(s, "p1", { type: "propose", project: "walls", host: 9 })).toMatch(/no such House/);
    s.commons.built.walls = 1;
    s.commons.hosts.walls = 1;
    expect(error(s, "p1", { type: "propose", project: "walls", host: 0 })).toMatch(/already sited in House/);
    s = move(s, "p1", { type: "propose", project: "walls", host: 1 });
    expect(s.vote?.host).toBe(1);
  });

  it("hosts an unsited project in the biggest pledger's district", () => {
    let s = council();
    s.commons.gold = 0;
    s.commons.stores = {};
    for (const h of s.houses) Object.assign(h, { gold: 500, stores: { timber: 500, stone: 500, iron: 500, grain: 500 } });
    s = move(s, "p2", { type: "pledge", project: "beacon", give: { timber: 10 } });
    s = move(s, "p3", { type: "pledge", project: "beacon", give: { timber: 200, gold: 200 } });
    reckoning(s);
    expect(s.commons.hosts?.beacon).toBe(2);
  });

  it("moves a levy that every House pays when it passes, and nobody when it fails", () => {
    let s = council();
    const before = s.commons.gold;
    s.houses[2]!.gold = 5;
    s = move(s, "p1", { type: "levy" });
    expect(s.vote?.kind).toBe("levy");
    expect(error(s, "p1", { type: "levy" })).toMatch(/proposal for this Year/);
    s = move(s, "p1", { type: "vote", choice: 0 });
    s = move(s, "p2", { type: "vote", choice: 0 });
    s = move(s, "p3", { type: "vote", choice: 1 });
    const L = TUNING.commons.levyGold;
    expect(s.houses.map((h) => h.gold)).toEqual([100 - L, 100 - L, 0]);
    expect(s.commons.gold).toBe(before + 2 * L + 5);
    let no = council();
    no = move(no, "p2", { type: "levy" });
    for (const p of ["p1", "p2", "p3"]) no = move(no, p, { type: "vote", choice: 1 });
    expect(no.houses.every((h) => h.gold === 100)).toBe(true);
  });

  it("has no levy with one House", () => {
    expect(error(calm(campaign(1, 4)), "p1", { type: "levy" })).toMatch(/nobody to levy/);
  });
});
