// The outcome card and nominations (Josh's playtest, 2026-11-02): what an event did, told per House,
// and a House naming its own Scion for a choice that asks someone to step up.
import { describe, expect, it } from "vitest";
import type { TripEffect, TripOption } from "./content.ts";
import { foresee, nominable, resolve } from "./events.ts";
import { able, muster } from "./expedition.ts";
import { sovereignPact, type SovMove, type SovState } from "./index.ts";
import { calm, campaign } from "./testing.ts";
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

function underway(H: number, seed = 5): SovState {
  let s = calm(campaign(H, seed));
  s.phase = "expedition";
  muster(s, { type: "delve", pool: "barrows", level: 2, size: 4 });
  for (let h = 0; h < H; h++) s = move(s, `p${h + 1}`, { type: "field", people: able(s, h).slice(0, s.expedition!.seats[h]).map((p) => p.id) });
  const leader = s.expedition!.party[0]![0]!;
  if (H > 1) for (let h = 0; h < H; h++) s = move(s, `p${h + 1}`, { type: "lead", person: leader });
  return s;
}
const option = (rule: string, ...effects: TripEffect[]): TripOption => ({ id: "x", label: "Test.", rule, outcomes: [{ w: 1, text: "It happens.", effects }] });
const meetChapel = (s: SovState) => {
  s.expedition!.seen.push("collapsed_chapel");
  s.expedition!.event = { id: "collapsed_chapel", votes: s.houses.map(() => null) };
};

describe("the outcome card (told.ts)", () => {
  it("tells what no before-and-after shows: the fight it starts, a shorter way, the next battle's start (Josh: 'something answers, nothing happens')", () => {
    const s = underway(1);
    resolve(s, option("leader", { skip: 1 }, { to: "party", status: "protect" }, { encounter: {} }));
    const lines = s.expedition!.told!.parts.at(-1)!.lines.map((l) => l.text);
    expect(lines).toContain("A shorter way: the next place on the road is passed by.");
    expect(lines).toContain("The party starts the next battle with Protect.");
    expect(lines).toContain("It comes to a fight.");
  });


  it("says when a restore finds the party already whole (Josh: 'it just has to say they are healed (full hp)')", () => {
    const s = underway(1);
    for (const c of Object.values(s.expedition!.carry)) delete c.hurt;
    resolve(s, option("leader", { to: "party", hp: 10 }));
    const lines = s.expedition!.told!.parts.at(-1)!.lines.map((l) => l.text);
    expect(lines).toContain("The party is already at full HP.");
  });

  it("tells what an outcome did: wounds to all, Sanity and a House's stores to that House alone", () => {
    const s = underway(2);
    s.expedition!.seen.push("collapsed_chapel");
    const id = s.expedition!.party[1]![0]!;
    s.expedition!.leader = id;
    resolve(s, option("leader", { sanity: -10 }, { hp: -20 }, { resources: { essence: 2 } }));
    const told = s.expedition!.told!;
    expect(told.id).toBe("collapsed_chapel");
    expect(told.parts).toHaveLength(1);
    const name = s.people.find((p) => p.id === id)!.name;
    expect(told.parts[0]!.who).toBe(name);
    expect(told.parts[0]!.text).toBe("It happens.");
    const lines = told.parts[0]!.lines;
    expect(lines.some((l) => l.open && l.text.startsWith(`${name}: HP −`))).toBe(true);
    expect(lines.find((l) => l.text.includes("Sanity"))).toMatchObject({ of: 1, open: false });
    expect(lines.find((l) => l.text.includes("Essence"))).toMatchObject({ of: 1, open: false });
    // The House it concerns sees it all; the other sees only the open lines.
    const mine = view(s, "p2").expedition!.told!.parts[0]!.lines;
    const theirs = view(s, "p1").expedition!.told!.parts[0]!.lines;
    expect(mine).toHaveLength(lines.length);
    expect(theirs.every((l) => l.open)).toBe(true);
    expect(theirs.some((l) => l.text.includes("Sanity"))).toBe(false);
  });

  it("starts a new card for the next event, and says when nothing changed", () => {
    const s = underway(1);
    s.expedition!.seen.push("collapsed_chapel");
    resolve(s, option("vote"));
    expect(s.expedition!.told!.parts[0]!.lines).toEqual([]);
    expect(s.expedition!.told!.parts[0]!.who).toBe("");
    s.expedition!.seen.push("bread_on_the_water");
    resolve(s, option("vote"));
    expect(s.expedition!.told).toMatchObject({ id: "bread_on_the_water", parts: [{ label: "Test." }] });
  });
});

describe("nominations (Josh, 2026-11-02: each player names their own pawn; nobody named, the rule decides)", () => {
  it("lets a House name its own Scion for a choice that asks someone to step up", () => {
    expect(nominable("scion:highest:might")).toBe(true);
    expect(nominable("scion:random")).toBe(true);
    expect(nominable("scion:heaviest_gear")).toBe(false);
    expect(nominable("leader")).toBe(false);
    expect(nominable("vote")).toBe(false);
    let s = underway(2);
    meetChapel(s);
    const [a, b] = s.expedition!.party[0]!;
    const theirs = s.expedition!.party[1]![0]!;
    expect(error(s, "p1", { type: "decide", option: 0, person: theirs })).toMatch(/own Scions/);
    expect(error(s, "p1", { type: "decide", option: 1, person: a! })).toMatch(/does not fall on a Scion/);
    const auto = foresee(s, "scion:highest:might");
    const named = auto === a ? b! : a!;
    s = move(s, "p1", { type: "decide", option: 0, person: named });
    s = move(s, "p2", { type: "decide", option: 0 });
    expect(s.expedition!.told!.parts[0]!.who).toBe(s.people.find((p) => p.id === named)!.name);
  });

  it("with nobody named, falls on whom the rule picks, as the view foretold", () => {
    let s = underway(2);
    meetChapel(s);
    const ahead = view(s, "p1").expedition!.ahead!;
    expect(ahead[0]).toBe(foresee(s, "scion:highest:might"));
    expect(ahead[1]).toBeNull();
    expect(ahead[2]).toBe(s.expedition!.leader);
    s = move(move(s, "p1", { type: "decide", option: 0 }), "p2", { type: "decide", option: 0 });
    expect(s.expedition!.told!.parts[0]!.who).toBe(s.people.find((p) => p.id === ahead[0])!.name);
  });

  it("prefers the Leader's House's nominee when two Houses name someone", () => {
    let s = underway(2);
    meetChapel(s);
    const leadHouse = s.people.find((p) => p.id === s.expedition!.leader)!.host;
    const other = 1 - leadHouse;
    const ours = s.expedition!.party[leadHouse]![1]!;
    const theirs = s.expedition!.party[other]![0]!;
    s = move(s, `p${other + 1}`, { type: "decide", option: 0, person: theirs });
    s = move(s, `p${leadHouse + 1}`, { type: "decide", option: 0, person: ours });
    expect(s.expedition!.told!.parts[0]!.who).toBe(s.people.find((p) => p.id === ours)!.name);
  });
});
