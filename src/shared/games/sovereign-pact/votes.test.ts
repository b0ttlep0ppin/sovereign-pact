import { describe, expect, it } from "vitest";
import { sovereignPact, type SovMove, type SovState } from "./index.ts";
import { calm, campaign, playOut } from "./testing.ts";
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
/** A campaign whose Commons holds plenty of everything. */
const stocked = (H: number): SovState => {
  const s = campaign(H, 6);
  s.commons.gold = 500;
  s.commons.stores = { timber: 500, stone: 500, iron: 500, grain: 500 };
  return s;
};
const YES = 0;
const NO = 1;

describe("votes on the Commons (§8.1)", () => {
  it("spends the Commons on a project when the majority says yes, and Renown goes to the winners", () => {
    let s = stocked(3);
    s = move(s, "p1", { type: "propose", project: "granary" });
    expect(view(s, "p3").vote).toMatchObject({ subject: "granary", by: [null, null, null] });
    expect(error(s, "p2", { type: "propose", project: "walls" })).toMatch(/already open/);
    s = move(s, "p1", { type: "vote", choice: YES });
    s = move(s, "p2", { type: "vote", choice: YES });
    expect(error(s, "p2", { type: "vote", choice: NO })).toMatch(/already voted/);
    s = move(s, "p3", { type: "vote", choice: NO });
    expect(s.vote).toBeUndefined();
    expect(s.commons.funds.granary!.paid).toEqual({ timber: 26, gold: 26 });
    expect(s.commons.gold).toBe(500 - 26);
    expect(s.houses.map((h) => h.score.renown)).toEqual([TUNING.tracks.voteWonRenown, TUNING.tracks.voteWonRenown, 0]);
  });

  it("refuses the spend when the majority says no", () => {
    let s = stocked(2);
    s = move(s, "p1", { type: "propose", project: "granary" });
    s = move(move(s, "p1", { type: "vote", choice: NO }), "p2", { type: "vote", choice: NO });
    expect(s.commons.funds.granary).toBeUndefined();
    expect(s.commons.gold).toBe(500);
  });

  it("breaks a tie by the highest-Renown voter, at a cost of Accord", () => {
    let s = stocked(2);
    s.houses[1]!.score.renown = 5;
    const accord = s.accord;
    s = move(s, "p1", { type: "propose", project: "granary" });
    s = move(move(s, "p1", { type: "vote", choice: NO }), "p2", { type: "vote", choice: YES });
    expect(s.accord).toBe(accord - TUNING.tracks.tieCost);
    expect(s.commons.funds.granary).toBeDefined();
  });

  it("settles an open vote when the Year is sealed, those who did not vote abstaining", () => {
    let s = stocked(3);
    s = move(s, "p1", { type: "propose", project: "granary" });
    s = move(s, "p1", { type: "vote", choice: YES });
    for (const p of ["p1", "p2", "p3"]) s = move(s, p, { type: "seal" });
    expect(s.vote).toBeUndefined();
    expect(s.commons.funds.granary ?? s.commons.built.granary).toBeDefined();
  });

  it("lets a solo House decide alone, once a Year", () => {
    let s = stocked(1);
    s = move(s, "p1", { type: "propose", project: "granary" });
    expect(s.vote).toBeUndefined();
    expect(s.commons.funds.granary).toBeDefined();
    expect(error(s, "p1", { type: "propose", project: "walls" })).toMatch(/proposal for this Year/);
    s = move(s, "p1", { type: "seal" });
    expect(s.commons.built.granary).toBe(1);
    expect(() => move(s, "p1", { type: "propose", project: "walls" })).not.toThrow();
  });

  it("refuses a proposal the Commons cannot help", () => {
    const s = calm(campaign(2, 6));
    expect(error(s, "p1", { type: "propose", project: "granary" })).toMatch(/holds nothing/);
    expect(error(s, "p1", { type: "vote", choice: 0 })).toMatch(/nothing to vote on/);
  });

  it("is played by the bots over a whole campaign, raising shared projects", () => {
    const end = playOut(calm(campaign(4, 11)));
    expect(Object.keys(end.commons.built).length).toBeGreaterThanOrEqual(2);
  });
});
