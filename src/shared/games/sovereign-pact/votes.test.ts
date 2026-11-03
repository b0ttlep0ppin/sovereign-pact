import { describe, expect, it } from "vitest";
import { sovereignPact, type SovMove, type SovState } from "./index.ts";
import { calm, campaign, playOut } from "./testing.ts";
import { TUNING } from "./tuning.ts";
import { view } from "./view.ts";
import { goAlong } from "./votes.ts";

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
  const s = calm(campaign(H, 6));
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

  it("lets no House seal the Year with a vote unanswered, and calls the sealed back to vote (Josh 2026-11-03)", () => {
    let s = stocked(3);
    s = move(s, "p3", { type: "seal" });
    s = move(s, "p1", { type: "propose", project: "granary" });
    expect(s.houses[2]!.sealed).toBe(false);
    s = move(s, "p1", { type: "vote", choice: YES });
    expect(error(s, "p2", { type: "seal" })).toBe("Vote first: spending the Commons on the Granary.");
    s = move(move(s, "p2", { type: "vote", choice: YES }), "p3", { type: "vote", choice: YES });
    for (const p of ["p1", "p2", "p3"]) s = move(s, p, { type: "seal" });
    expect(s.vote).toBeUndefined();
    expect(s.commons.funds.granary ?? s.commons.built.granary).toBeDefined();
  });

  it("lets a bot come round to the people's choice, more often as Accord falls (Josh 2026-11-03)", () => {
    const came = (accord: number) => {
      let n = 0;
      for (let seed = 1; seed <= 40; seed++) {
        const s = stocked(2);
        s.rng = seed;
        s.accord = accord;
        s.botSeats = [1];
        const votes = [YES, 1 - YES];
        goAlong(s, votes);
        if (votes[1] === YES) n++;
      }
      return n;
    };
    expect(came(60)).toBeGreaterThan(10);
    expect(came(60)).toBeLessThan(40);
    expect(came(10)).toBeGreaterThan(came(60));
    // People never change their vote, and bots alone keep theirs.
    const s = stocked(2);
    s.botSeats = [0, 1];
    const votes = [YES, 1 - YES];
    goAlong(s, votes);
    expect(votes).toEqual([YES, 1 - YES]);
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
