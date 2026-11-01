// Retiring and reinstating (§6.12) and Fallen Houses (§6.13).
import { describe, expect, it } from "vitest";
import { sovereignPact, type SovMove, type SovState } from "./index.ts";
import { categories } from "./score.ts";
import { calm, campaign } from "./testing.ts";
import { upkeepDue } from "./town.ts";
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
const sealAll = (s: SovState): SovState => s.players.reduce((x, p, i) => (x.houses[i]!.sealed ? x : move(x, p, { type: "seal" })), s);

describe("the Retired (§6.12)", () => {
  it("retire with their gear back in the stash and half upkeep, and return at will", () => {
    let s = calm(campaign(2, 3));
    const p = s.people.find((x) => x.host === 0 && x.status === "scion")!;
    const gear = Object.values(p.gear);
    const upkeep = upkeepDue(s, 0).gold;
    expect(error(s, "p2", { type: "retire", person: p.id })).toMatch(/Only one of your Scions/);
    s = move(s, "p1", { type: "retire", person: p.id });
    const r = s.people.find((x) => x.id === p.id)!;
    expect([r.status, r.gear]).toEqual(["retired", {}]);
    expect(gear.every((id) => s.items.find((i) => i.id === id)!.house === 0)).toBe(true);
    expect(upkeepDue(s, 0).gold).toBe(upkeep - TUNING.economy.upkeep.scionGold + Math.ceil(TUNING.economy.upkeep.scionGold / 2));
    expect(error(s, "p1", { type: "retire", person: p.id })).toMatch(/Only one of your Scions/);
    s = move(s, "p1", { type: "reinstate", person: p.id });
    expect(s.people.find((x) => x.id === p.id)!.status).toBe("scion");
    expect(error(s, "p1", { type: "reinstate", person: p.id })).toMatch(/Retired/);
  });
});

describe("Fallen Houses (§6.13)", () => {
  it("shows a House with no one left as Fallen, with no Lineage, still playing", () => {
    let s = calm(campaign(2, 3));
    s.people = s.people.filter((p) => p.host !== 1);
    expect(view(s, "p1").houses.map((h) => h.fallen)).toEqual([false, true]);
    expect(categories(s, 1).lineage).toBe(0);
    s = move(s, "p2", { type: "build", building: "farm" });
    expect(s.houses[1]!.works).toEqual(["farm"]);
  });

  it("loses the campaign when every House is Fallen as a mandatory expedition departs", () => {
    let s = calm(campaign(2, 3));
    s.people = [];
    s = sealAll(s);
    expect(s.phase).not.toBe("over");
    s.year = TUNING.campaign.mandatoryYears.full[0]!;
    s.people = [];
    s = sealAll(s);
    expect(s.outcome).toMatchObject({ won: false });
    expect(s.outcome!.reason).toMatch(/no House had anyone/i);
  });
});
