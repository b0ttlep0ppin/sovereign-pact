// 2×4 expeditions (§9.3): two parties, two chains, Gates that wait on each other, one boss together.
import { describe, expect, it } from "vitest";
import { able, muster } from "./expedition.ts";
import { sovereignPact, type SovMove, type SovState } from "./index.ts";
import { find } from "./loot.ts";
import { levelUp } from "./progression.ts";
import type { NodeKind } from "./state.ts";
import type { TripEffect, TripOption } from "./content.ts";
import { resolve } from "./events.ts";
import { calm, campaign } from "./testing.ts";
import { view } from "./view.ts";

const g = sovereignPact;
const move = (s: SovState, player: string, m: SovMove): SovState => {
  const r = g.applyMove(s, player, m);
  if (!r.ok) throw new Error(r.error);
  return r.state;
};
const host = (s: SovState, id: number) => s.people.find((p) => p.id === id)!.host;
/** The player whose House leads the walking party. */
const leads = (s: SovState) => `p${host(s, s.expedition!.leader!) + 1}`;
const press = (s: SovState) => move(s, leads(s), { type: "press_on" });

/** Two Houses of four Scions each, strong enough to win, underway on a 2×4 card. */
function underway(seed = 5, level = 1): SovState {
  let s = calm(campaign(2, seed));
  for (let h = 0; h < 2; h++) {
    const one = s.people.find((p) => p.host === h && p.status === "scion")!;
    s.people.push({ ...structuredClone(one), id: s.nextId++, name: `${one.name} the Younger` });
  }
  for (const p of s.people) while (p.status === "scion" && p.level < 20) Object.assign(p, levelUp(p));
  s.phase = "expedition";
  muster(s, { type: "delve", pool: "beast_lands", level, size: "2x4" });
  for (let h = 0; h < 2; h++) s = move(s, `p${h + 1}`, { type: "field", people: able(s, h).map((p) => p.id) });
  const leader = s.expedition!.party[0]![0]!;
  for (let h = 0; h < 2; h++) s = move(s, `p${h + 1}`, { type: "lead", person: leader });
  return s;
}
/** Both parties' ways set by hand. */
function ways(s: SovState, a: NodeKind[], b: NodeKind[] = a): void {
  const x = s.expedition!.split!;
  x.chains = [[...a], [...b]];
  s.expedition!.chain = x.chains[0];
}

describe("setting out (§9.3)", () => {
  it("splits the eight into two parties of four, a House in each, the Leader's walking first", () => {
    const s = underway();
    const e = s.expedition!;
    const x = e.split!;
    expect(x.teams.map((t) => t.length)).toEqual([4, 4]);
    for (const t of x.teams) expect(new Set(t.map((id) => host(s, id)))).toEqual(new Set([0, 1]));
    expect(x.teams[0]).toContain(e.leader);
    expect(x.leaders[0]).toBe(e.leader);
    expect(x.teams[1]).toContain(x.leaders[1]);
    for (const c of x.chains) {
      expect(c.at(-1)).toBe("rally");
      expect(c.filter((k) => k === "gate")).toEqual(["gate"]);
      expect(c.includes("boss")).toBe(false);
    }
    expect(e.chain).toEqual(x.chains[0]);
  });

  it("shows only the nodes each party has passed", () => {
    const s = underway();
    ways(s, ["camp", "gate", "camp", "rally"]);
    const t = press(s);
    const v = view(t, "p2").expedition!;
    expect(v.split!.chains[1]).toEqual([]);
    expect(v.chain).toEqual(["camp"]);
  });
});

describe("the Gates", () => {
  it("pass control A, B, A, B, then both meet for the boss", () => {
    let s = underway();
    ways(s, ["camp", "gate", "camp", "rally"]);
    const [a, b] = s.expedition!.split!.leaders;
    const walking = () => s.expedition!.leader;
    s = press(s); // A camps
    s = press(s); // A's Gate is sealed: B walks
    expect(walking()).toBe(b);
    expect(s.log.some((l) => l.includes("sealed Gate"))).toBe(true);
    s = press(s); // B camps
    s = press(s); // B's Gate waits on A getting through: A walks
    expect(walking()).toBe(a);
    s = press(s); // A's Gate opens now
    expect(s.log.at(-1)).toMatch(/grinds open/);
    s = press(s); // A camps
    s = press(s); // A at the meeting place: B walks
    expect(walking()).toBe(b);
    s = press(s); // B's Gate opens
    s = press(s);
    s = press(s); // B at the meeting place: together
    const e = s.expedition!;
    expect(e.split!.united).toBe(true);
    expect([e.chain, e.leader]).toEqual([["boss"], a]);
    expect(g.activePlayers(s)).toEqual([leads(s)]);
    s = press(s);
    expect(s.log.some((l) => l.includes("defeats the boss"))).toBe(true);
    expect(s.people.filter((p) => (p.hist.expeditions ?? 0) > 0).every((p) => p.status === "scion")).toBe(true);
  });

  it("no longer wait once the other party turns back; the one that turned back still drafts the haul", () => {
    let s = underway();
    ways(s, ["camp", "gate", "camp", "rally"]);
    const x = s.expedition!.split!;
    const gone = [...x.teams[0]];
    const valor = s.houses.map((h) => h.score.valor);
    s = move(s, leads(s), { type: "retreat" });
    expect(s.expedition!.leader).toBe(x.leaders[1]);
    expect(s.expedition!.out).toEqual(expect.arrayContaining(gone));
    expect(s.houses.every((h, i) => h.score.valor <= valor[i]!)).toBe(true);
    find(s, 3);
    find(s, 3);
    for (let i = 0; i < 4; i++) s = press(s); // B: camp, Gate (open), camp, the meeting place
    expect(s.expedition!.split!.united).toBe(true);
    expect(s.expedition!.leader).toBe(x.leaders[1]);
    s = press(s);
    expect(s.log.some((l) => l.includes("defeats the boss"))).toBe(true);
  });

  it("lose a fallen party (half Lost), and the other goes on", () => {
    let s = underway(7, 10);
    ways(s, ["encounter", "gate", "camp", "rally"], ["camp", "gate", "camp", "rally"]);
    const x = s.expedition!.split!;
    const first = [...x.teams[0]];
    for (const id of first) Object.assign(s.people.find((p) => p.id === id)!, { level: 1, base: [1, 1, 1, 1, 1, 10] });
    s = press(s);
    expect(s.log.some((l) => l.includes("party is overrun"))).toBe(true);
    expect(s.expedition!.result).toBeUndefined();
    expect(s.expedition!.split!.state[0]).toBe("wiped");
    expect(s.expedition!.leader).toBe(x.leaders[1]);
  });
});

describe("events on a split way", () => {
  const option = (fx: TripEffect): TripOption => ({ id: "x", label: "Test.", rule: "vote", outcomes: [{ w: 1, text: "It happens.", effects: [fx] }] });
  it("never Fork away or skip past a Gate", () => {
    const s = underway();
    ways(s, ["camp", "camp", "gate", "camp", "rally"]);
    resolve(s, option({ fork: { drop: 3 } }));
    expect(s.expedition!.chain).toEqual(["gate", "rally"]);
    ways(s, ["camp", "camp", "gate", "camp", "rally"]);
    s.expedition!.at = 0;
    resolve(s, option({ skip: 4 }));
    expect(s.expedition!.at).toBe(2);
  });
});

describe("the bots", () => {
  it("walk a 2×4 expedition to its end", () => {
    for (const seed of [3, 5, 8]) {
      let s = underway(seed, 2);
      for (let i = 0; i < 200 && s.expedition && !s.expedition.result; i++) {
        const p = g.activePlayers(s)[0]!;
        s = move(s, p, g.botMove!(s, p, undefined as never));
      }
      expect(s.expedition === undefined || s.expedition.result !== undefined).toBe(true);
      expect(s.log.some((l) => /Control passes|meet again|faces the boss alone|One party/.test(l))).toBe(true);
    }
  });
});
