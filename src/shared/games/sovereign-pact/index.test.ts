import { describe, expect, it } from "vitest";
import { sovereignPact, type SovState } from "./index.ts";
import { campaign, playOut, seats } from "./testing.ts";
import { TUNING } from "./tuning.ts";

const g = sovereignPact;

const move = (s: SovState, player: string, m: Parameters<typeof g.applyMove>[2]): SovState => {
  const r = g.applyMove(s, player, m);
  if (!r.ok) throw new Error(r.error);
  return r.state;
};

describe("setup", () => {
  it.each([1, 2, 3, 4])("seats %i Houses with the §6.2 starting Scions and recruits", (H) => {
    const s = campaign(H);
    expect(s.houses).toHaveLength(H);
    for (let i = 0; i < H; i++) {
      const mine = s.people.filter((p) => p.host === i);
      expect(mine.filter((p) => p.status === "scion")).toHaveLength(TUNING.houses.startScions[H - 1]!);
      expect(mine.filter((p) => p.status === "recruit")).toHaveLength(TUNING.houses.startRecruits[H - 1]!);
    }
    expect(new Set(s.houses.map((h) => h.colors[0])).size).toBe(H);
    expect(new Set(s.houses.map((h) => h.name)).size).toBe(H);
    expect(s.year).toBe(1);
    expect(s.phase).toBe("settlement");
  });

  it("is the same campaign from the same seed, and a different one from another", () => {
    expect(campaign(3, 42)).toEqual(campaign(3, 42));
    expect(campaign(3, 42)).not.toEqual(campaign(3, 43));
  });

  it("reads the table options", () => {
    const s = campaign(2, 1, { display: "flavor", length: "short" });
    expect(s.opts).toEqual({ display: "flavor", length: "short" });
    expect(s.timeline.map((t) => t.year)).toEqual(TUNING.campaign.mandatoryYears.short);
  });

  it("puts the mandatory arc on the timeline", () => {
    expect(campaign(1).timeline.map((t) => t.year)).toEqual([5, 10, 15, 20]);
  });
});

describe("the Settlement Phase", () => {
  it("waits for every House to seal, then runs the Year and opens the next", () => {
    let s = campaign(3);
    expect(g.activePlayers(s)).toEqual(seats(3));
    s = move(s, "p2", { type: "seal" });
    expect(g.activePlayers(s)).toEqual(["p1", "p3"]);
    expect(g.passiveMoves!(s, "p2")).toEqual(["unseal"]);
    s = move(s, "p2", { type: "unseal" });
    expect(g.activePlayers(s)).toEqual(seats(3));
    for (const p of seats(3)) s = move(s, p, { type: "seal" });
    expect(s.year).toBe(2);
    expect(s.phase).toBe("settlement");
    expect(s.doom).toBe(TUNING.tracks.doomStart + TUNING.tracks.doomPerYear);
    expect(s.houses.every((h) => !h.sealed)).toBe(true);
  });

  it("refuses moves out of turn, from strangers, and malformed ones, without throwing", () => {
    const s = campaign(2);
    expect(g.applyMove(s, "stranger", { type: "seal" }).ok).toBe(false);
    expect(g.applyMove(s, "p1", { type: "unseal" }).ok).toBe(false);
    expect(g.applyMove(s, "p1", { type: "nonsense" } as never).ok).toBe(false);
    expect(g.applyMove(s, "p1", null as never).ok).toBe(false);
    const sealed = move(s, "p1", { type: "seal" });
    expect(g.applyMove(sealed, "p1", { type: "seal" }).ok).toBe(false);
  });

  it("never changes the state it is given", () => {
    const s = campaign(2);
    const before = JSON.stringify(s);
    move(move(s, "p1", { type: "seal" }), "p2", { type: "seal" });
    expect(JSON.stringify(s)).toBe(before);
  });

  it("pays income into the Treasury and the tithe into the Commons", () => {
    let s = campaign(4);
    const gold = s.houses.map((h) => h.gold);
    for (const p of seats(4)) s = move(s, p, { type: "seal" });
    expect(s.commons.gold).toBe(4 * Math.round(TUNING.economy.income.gold * TUNING.economy.tithe));
    // Income less tithe less upkeep for two Scions.
    expect(s.houses[0]!.gold).toBe(gold[0]! + 30 - 3 - 2 * TUNING.economy.upkeep.scionGold);
  });
});

describe("a whole campaign with bots", () => {
  it.each([1, 2, 3, 4])("runs %i Houses to an end: a Sovereign after Year 20, or a loss together", (H) => {
    const end = playOut(campaign(H, 7));
    const res = g.result(end)!;
    expect(res.kind).toBe("win");
    if (res.kind !== "win") return;
    expect(g.activePlayers(end)).toEqual([]);
    if (!end.outcome!.won) {
      // Crises can break the settlement before Year 20 (§3.3).
      expect(res.winners).toEqual([]);
      expect(end.accord <= 0 || end.doom >= 100).toBe(true);
      return;
    }
    expect(end.year).toBe(20);
    expect(res.winners).toEqual(seats(H));
    expect(Object.values(res.seats!).some((seat) => seat.placement === 1)).toBe(true);
    expect(g.describeResult!(end)).toMatch(/throne/);
    expect(g.activePlayers(end)).toEqual([]);
  });

  it("loses together when Doom reaches 100", () => {
    const s = campaign(2);
    s.doom = 99;
    const end = playOut(s);
    expect(end.year).toBe(1);
    expect(g.result(end)).toEqual({ kind: "win", winners: [] });
    expect(g.describeResult!(end)).toMatch(/overwhelmed/);
  });

  it("plays the Short campaign in 10 Years", () => {
    expect(playOut(campaign(2, 3, { length: "short" })).year).toBe(10);
  });
});
