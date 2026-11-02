import { describe, expect, it } from "vitest";
import { LOADOUTS } from "./combat/roster.ts";
import { deploy } from "./formation.ts";
import { sovereignPact, type SovMove, type SovState } from "./index.ts";
import { partyOf } from "./journey.ts";
import { calm, campaign } from "./testing.ts";

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
const scions = (s: SovState, house = 0) => s.people.filter((p) => p.host === house && p.status === "scion");

describe("the formation (§10.12)", () => {
  it("stands a Scion with no post in their Job's column, rows in order", () => {
    const s = calm(campaign(1, 5));
    const party = scions(s);
    const cells = deploy(party);
    party.forEach((p, i) => expect(cells[i]![0]).toBe(LOADOUTS[p.job!]?.col ?? 1));
    expect(new Set(cells.map((c) => c.join())).size).toBe(cells.length);
  });

  it("opens a battle with each Scion at their post", () => {
    let s = calm(campaign(1, 5));
    const [a, b] = scions(s);
    s = move(s, "p1", { type: "post", person: a!.id, col: 2, row: 7 });
    s = move(s, "p1", { type: "post", person: b!.id, col: 0, row: 3 });
    const units = partyOf(s, [a!.id, b!.id]);
    expect([units[0]!.col, units[0]!.row]).toEqual([2, 7]);
    expect([units[1]!.col, units[1]!.row]).toEqual([0, 3]);
    expect(g.view(s, "p1").people.find((p) => p.id === a!.id)?.post).toEqual([2, 7]);
  });

  it("swaps two of a House's Scions posted to the same cell, and clears a post", () => {
    let s = calm(campaign(1, 5));
    const [a, b] = scions(s);
    s = move(s, "p1", { type: "post", person: a!.id, col: 1, row: 1 });
    s = move(s, "p1", { type: "post", person: b!.id, col: 0, row: 0 });
    s = move(s, "p1", { type: "post", person: a!.id, col: 0, row: 0 });
    const at = (id: number) => s.people.find((p) => p.id === id)!.post;
    expect(at(a!.id)).toEqual([0, 0]);
    expect(at(b!.id)).toEqual([1, 1]);
    s = move(s, "p1", { type: "post", person: a!.id, col: null, row: null });
    expect(at(a!.id)).toBeUndefined();
  });

  it("gives a taken post to the first in the party; the other stands by their Job", () => {
    const s = calm(campaign(2, 5));
    const a = scions(s, 0)[0]!;
    const b = scions(s, 1)[0]!;
    a.post = [1, 4];
    b.post = [1, 4];
    const [ca, cb] = deploy([a, b]);
    expect(ca).toEqual([1, 4]);
    expect(cb).not.toEqual([1, 4]);
    expect(cb![0]).toBe(LOADOUTS[b.job!]?.col ?? 1);
  });

  it("refuses another House's Scion and a cell off the grid", () => {
    const s = calm(campaign(2, 5));
    const theirs = scions(s, 1)[0]!;
    const mine = scions(s, 0)[0]!;
    expect(error(s, "p1", { type: "post", person: theirs.id, col: 0, row: 0 })).toMatch(/own Scions/);
    expect(error(s, "p1", { type: "post", person: mine.id, col: 3, row: 0 })).toMatch(/off the grid/);
    expect(error(s, "p1", { type: "post", person: mine.id, col: 0, row: 8 })).toMatch(/off the grid/);
  });
});
