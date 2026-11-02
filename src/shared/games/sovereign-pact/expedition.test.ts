// The Expedition Phase's muster (§9.2): seats shared among the Houses, each fielding its own Scions,
// declined seats passing on, the Leader vote and departure.
import { describe, expect, it } from "vitest";
import { able, muster, share } from "./expedition.ts";
import { sovereignPact, type SovMove, type SovState } from "./index.ts";
import type { ExpeditionCard } from "./state.ts";
import { calm, campaign, sealYear } from "./testing.ts";
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
const card = (size: ExpeditionCard["size"], type: ExpeditionCard["type"] = "resource"): ExpeditionCard => ({ type, pool: "beast_lands", level: 1, size });

/** A still Year at the Expedition Phase, mustering for `c`. */
function at(H: number, c: ExpeditionCard, seed = 5): SovState {
  const s = calm(campaign(H, seed));
  s.phase = "expedition";
  muster(s, c);
  return s;
}
const ids = (s: SovState, house: number, n: number): number[] => able(s, house).slice(0, n).map((p) => p.id);

describe("sharing the seats (§9.2)", () => {
  it("divides them equally, the spare to the House with the fewest expeditions, then by rotation", () => {
    const s = calm(campaign(3, 5));
    expect(share(s, 4, [0, 1, 2], () => 9)).toEqual({ 0: 1, 1: 2, 2: 1 });
    s.houses[1]!.attended = 1;
    expect(share(s, 4, [0, 1, 2], () => 9)).toEqual({ 0: 1, 1: 1, 2: 2 });
    expect(share(calm(campaign(4, 5)), 8, [0, 1, 2, 3], () => 9)).toEqual({ 0: 2, 1: 2, 2: 2, 3: 2 });
    expect(share(s, 8, [0, 1], (h) => (h === 0 ? 1 : 9))).toEqual({ 0: 1, 1: 7 });
  });

  it("offers seats only to Houses with able Scions; the Retired come back first", () => {
    const s = calm(campaign(2, 5));
    for (const p of s.people) if (p.host === 1 && p.status === "scion") p.status = "retired";
    s.phase = "expedition";
    muster(s, card(4));
    expect(s.expedition!.seats).toEqual([Math.min(4, able(s, 0).length), 0]);
    expect(g.activePlayers(s)).toEqual(["p1"]);
    expect(error(s, "p2", { type: "field", people: [] })).toMatch(/no seats/);
  });
});

describe("fielding the party (§9.2)", () => {
  it("takes only your own able Scions, up to your seats", () => {
    const s = at(2, card(4));
    const theirs = ids(s, 1, 1);
    expect(error(s, "p1", { type: "field", people: theirs })).toMatch(/your own/);
    expect(error(s, "p1", { type: "field", people: ids(s, 0, 3) })).toMatch(/2 seats/);
    expect(error(s, "p1", { type: "field", people: [ids(s, 0, 1)[0]!, ids(s, 0, 1)[0]!] })).toMatch(/one seat/);
    expect(error(s, "p1", { type: "lead", person: theirs[0]! })).toMatch(/No Leader/);
    const t = move(s, "p1", { type: "field", people: ids(s, 0, 2) });
    expect(error(t, "p1", { type: "field", people: ids(s, 0, 2) })).toMatch(/already fielded/);
    expect(g.activePlayers(t)).toEqual(["p2"]);
  });

  it("passes declined seats to a House that filled its own, and never back", () => {
    let s = at(2, card(4));
    s = move(s, "p1", { type: "field", people: ids(s, 0, 1) });
    s = move(s, "p2", { type: "field", people: ids(s, 1, 2) });
    expect(s.expedition!.seats).toEqual([1, 3]);
    expect(g.activePlayers(s)).toEqual(["p2"]);
    s = move(s, "p2", { type: "field", people: ids(s, 1, 3) });
    expect(s.expedition!.votes).toEqual([null, null]);
  });

  it("cannot depart with seats left empty, unless it is mandatory", () => {
    let s = at(2, card(8));
    s = move(s, "p1", { type: "field", people: [] });
    s = move(s, "p2", { type: "field", people: [] });
    expect(s.log.some((l) => l.includes("cannot depart"))).toBe(true);
    expect([s.year, s.phase]).toEqual([2, "settlement"]);
    let m = at(2, card(8, "mandatory"));
    m = move(m, "p1", { type: "field", people: ids(m, 0, 2) });
    m = move(m, "p2", { type: "field", people: [] });
    expect(m.expedition!.votes).toEqual([null, null]);
  });
});

describe("the Leader (§9.2)", () => {
  it("is voted by each House; the Leader's House gains Renown and the party's counters rise", () => {
    let s = at(2, card(4));
    s = move(s, "p1", { type: "field", people: ids(s, 0, 2) });
    s = move(s, "p2", { type: "field", people: ids(s, 1, 2) });
    const leader = ids(s, 1, 1)[0]!;
    expect(view(s, "p1").expedition!.party[1]).toEqual(ids(s, 1, 2));
    expect(error(s, "p1", { type: "lead", person: 99_999 })).toMatch(/in the party/);
    s = move(s, "p1", { type: "lead", person: leader });
    expect(error(s, "p1", { type: "lead", person: leader })).toMatch(/already voted/);
    const renown = s.houses[1]!.score.renown;
    const party = [...s.expedition!.party[0]!, ...s.expedition!.party[1]!];
    s = move(s, "p2", { type: "lead", person: leader });
    expect(s.houses[1]!.score.renown).toBe(renown + TUNING.expedition.leaderRenown);
    const lead = s.people.find((p) => p.id === leader)!;
    expect(lead.hist.led).toBe(1);
    expect(party.every((id) => s.people.find((p) => p.id === id)!.hist.expeditions === 1)).toBe(true);
    expect(s.houses.map((h) => h.attended)).toEqual([1, 1]);
    expect(s.log.some((l) => l.includes(`${lead.name} of House`))).toBe(true);
    // Underway: the Leader's House walks the chain.
    expect([s.phase, s.expedition!.leader, s.expedition!.at]).toEqual(["expedition", leader, 0]);
    expect(g.activePlayers(s)).toEqual(["p2"]);
    expect(sealYear(s).year).toBe(2);
  });

  it("breaks a tie for the Scion with the most expeditions, at a cost in Accord", () => {
    let s = at(2, card(4));
    s = move(s, "p1", { type: "field", people: ids(s, 0, 2) });
    s = move(s, "p2", { type: "field", people: ids(s, 1, 2) });
    const [a, b] = [ids(s, 0, 1)[0]!, ids(s, 1, 1)[0]!];
    s.people.find((p) => p.id === b)!.hist.expeditions = 3;
    const accord = s.accord;
    s = move(move(s, "p1", { type: "lead", person: a }), "p2", { type: "lead", person: b });
    expect(s.people.find((p) => p.id === b)!.hist.led).toBe(1);
    expect(s.people.find((p) => p.id === a)!.hist.led).toBeUndefined();
    expect(s.accord).toBeLessThan(accord);
  });

  it("needs no vote with one House", () => {
    let s = at(1, card(4));
    s = move(s, "p1", { type: "field", people: ids(s, 0, 4) });
    expect(s.expedition!.leader).toBeDefined();
    expect(s.people.filter((p) => p.hist.led === 1)).toHaveLength(1);
  });
});

describe("the bots and the whole Year", () => {
  it("bots field their highest levels and vote their own best; a sealed Year runs to the next", () => {
    let s = campaign(3, 5);
    s.people.find((p) => p.host === 0 && p.status === "scion")!.level = 7;
    s = move(move(move(s, "p1", { type: "seal" }), "p2", { type: "seal" }), "p3", { type: "seal" });
    if (s.phase === "expedition") {
      const field = g.botMove!(s, "p1", undefined as never) as { type: "field"; people: number[] };
      expect(field.type).toBe("field");
      expect(s.people.find((p) => p.id === field.people[0])!.level).toBe(7);
    }
    s = sealYear(s);
    expect([s.year, s.phase]).toEqual([2, "settlement"]);
  });
});
