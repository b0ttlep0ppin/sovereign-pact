// The chain and its walk (§9.3, §9.9): the nodes, the boss, Camps, battles and what they leave, coming home.
import { describe, expect, it } from "vitest";
import { able, muster } from "./expedition.ts";
import { sovereignPact, type SovMove, type SovState } from "./index.ts";
import { bossFor, rollChain } from "./journey.ts";
import { levelUp } from "./progression.ts";
import type { ExpeditionCard } from "./state.ts";
import { calm, campaign } from "./testing.ts";
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
const card = (level: number, type: ExpeditionCard["type"] = "resource", pool = "beast_lands"): ExpeditionCard => ({ type, pool, level, size: 4 });

/** A solo House underway on `c` with four Scions at `level`. */
function underway(c: ExpeditionCard, level = 1, seed = 5): SovState {
  let s = calm(campaign(1, seed));
  for (const p of s.people.filter((x) => x.status === "scion")) {
    let q = p;
    while (q.level < level) q = levelUp(q);
    Object.assign(p, q);
  }
  s.phase = "expedition";
  muster(s, c);
  s = move(s, "p1", { type: "field", people: able(s, 0).slice(0, 4).map((p) => p.id) });
  return s;
}

describe("the chain (§9.3)", () => {
  it("has 4 + level/2 nodes, 2 more when mandatory, then the boss, in the decided mix", () => {
    const s = underway(card(1));
    // An Arcana's node is its own rule (arcana.test.ts): one met already keeps it out of these counts.
    s.expedition!.arcana ??= "fool";
    const counts: Record<string, number> = {};
    for (const [level, type, n] of [[1, "resource", 4], [5, "delve", 6], [10, "mandatory", 11]] as const) {
      s.expedition!.card = card(level, type);
      for (let i = 0; i < 300; i++) {
        const chain = rollChain(s);
        expect(chain.length).toBe(n + 1);
        expect(chain.at(-1)).toBe("boss");
        for (const k of chain.slice(0, -1)) counts[k] = (counts[k] ?? 0) + 1;
      }
    }
    const total = Object.values(counts).reduce((a, b) => a + b, 0);
    for (const [kind, w] of TUNING.journey.nodes) expect(Math.abs((counts[kind] ?? 0) / total - w / 100), kind).toBeLessThan(0.04);
  });

  it("ends in the arc's boss, a pool boss near the level, or none", () => {
    const s = underway(card(1));
    s.expedition!.card = { ...card(3, "mandatory", "pit"), boss: "siege_beast" };
    expect(bossFor(s)).toBe("siege_beast");
    s.expedition!.card = card(1);
    expect(bossFor(s)).toBe("goblin_lord");
    s.expedition!.card = card(5, "resource", "deep_cold");
    expect(bossFor(s)).toBeUndefined();
  });

  it("shows only the nodes passed, and the chain's length", () => {
    const s = underway(card(1));
    s.expedition!.chain = ["camp", "event", "encounter", "cache", "boss"];
    s.expedition!.at = 2;
    expect(view(s, "p1").expedition).toMatchObject({ chain: ["camp", "event"], length: 5, at: 2 });
  });
});

describe("walking it", () => {
  it("is the Leader's House's call; there is no turning back at the boss", () => {
    let s = calm(campaign(2, 5));
    s.phase = "expedition";
    muster(s, card(1));
    s = move(s, "p1", { type: "field", people: able(s, 0).slice(0, 2).map((p) => p.id) });
    s = move(s, "p2", { type: "field", people: able(s, 1).slice(0, 2).map((p) => p.id) });
    const leader = s.expedition!.party[1]![0]!;
    s = move(move(s, "p1", { type: "lead", person: leader }), "p2", { type: "lead", person: leader });
    expect(error(s, "p1", { type: "press_on" })).toMatch(/Leader's House/);
    s.expedition!.chain = ["camp", "boss"];
    s = move(s, "p2", { type: "press_on" });
    expect(s.expedition!.at).toBe(1);
    expect(error(s, "p2", { type: "retreat" })).toMatch(/no turning back/);
  });

  it("rests at a Camp: Durability and Sanity come back", () => {
    let s = underway(card(1));
    const e = s.expedition!;
    e.chain = ["camp", "boss"];
    const id = e.party[0]![0]!;
    e.carry[id] = { dur: { head: 1, body: 1, arms: 1, legs: 0 }, broken: ["legs"] };
    const p = s.people.find((x) => x.id === id)!;
    p.sanity = 10;
    s = move(s, "p1", { type: "press_on" });
    expect(s.expedition!.carry[id]!.dur.legs).toBeGreaterThan(0);
    expect(s.expedition!.carry[id]!.broken).toEqual([]);
    expect(s.people.find((x) => x.id === id)!.sanity).toBeGreaterThan(10);
  });

  it("fights an encounter by gambits: the winners carry their wounds and earn XP and JP", () => {
    let s = underway(card(1), 12);
    s.expedition!.chain = ["encounter", "boss"];
    const ids = s.expedition!.party[0]!;
    const before = ids.map((id) => s.people.find((p) => p.id === id)!.xp);
    s = move(s, "p1", { type: "press_on" });
    expect(s.log.some((l) => l.includes("wins a battle"))).toBe(true);
    ids.forEach((id, i) => {
      const p = s.people.find((x) => x.id === id)!;
      expect(p.xp).toBe(before[i]! + TUNING.progression.battleXp);
      expect(p.jp[p.job!]).toBeGreaterThanOrEqual(TUNING.progression.battleJp);
      expect(s.expedition!.carry[id]).toBeDefined();
    });
  });

  it("comes home in triumph from the boss, with the expedition's XP", () => {
    let s = underway(card(1), 20);
    s.expedition!.chain = ["boss"];
    const valor = s.houses[0]!.score.valor;
    s = move(s, "p1", { type: "press_on" });
    expect(s.log.some((l) => l.includes("returns in triumph"))).toBe(true);
    expect(s.houses[0]!.score.valor).toBeGreaterThan(valor);
    expect([s.year, s.phase]).toEqual([2, "settlement"]);
  });

  it("turns back with Valor lost; from a mandatory one the settlement is Devastated", () => {
    let s = underway(card(1));
    s.houses[0]!.score.valor = 10;
    s.expedition!.chain = ["event", "boss"];
    s = move(s, "p1", { type: "retreat" });
    expect(s.houses[0]!.score.valor).toBe(10 - TUNING.journey.valor.retreat);
    let m = underway(card(3, "mandatory"));
    const doom = m.doom;
    m.expedition!.chain = ["event", "boss"];
    m = move(m, "p1", { type: "retreat" });
    expect(m.log.some((l) => l.startsWith("Devastation"))).toBe(true);
    expect(m.doom).toBeGreaterThan(doom + TUNING.tracks.doomPerYear);
  });

  it("wipes: the dead go to the Chronicle, about half the rest are Lost, and the final assault's failure ends the campaign", () => {
    let lost = 0;
    let walked = 0;
    for (let seed = 1; seed <= 8; seed++) {
      let s = underway(card(10, "resource", "outer_dark"), 1, seed);
      const ids = s.expedition!.party[0]!;
      s.expedition!.chain = ["encounter", "boss"];
      s = move(s, "p1", { type: "press_on" });
      expect(s.log.some((l) => l.includes("falls before an encounter"))).toBe(true);
      const gone = ids.filter((id) => !s.people.some((p) => p.id === id));
      expect(s.houses[0]!.chronicle.length).toBe(gone.length);
      walked += ids.length - gone.length;
      lost += ids.filter((id) => s.people.find((p) => p.id === id)?.status === "lost").length;
    }
    expect(lost / walked).toBeGreaterThan(0.25);
    expect(lost / walked).toBeLessThan(0.75);
    let f = underway({ ...card(10, "mandatory", "outer_dark"), boss: "end_ruler" });
    f.year = 20;
    f.expedition!.chain = ["encounter", "boss"];
    f = move(f, "p1", { type: "press_on" });
    expect(f.outcome).toEqual({ won: false, reason: expect.stringMatching(/assault on the rift failed/) });
  });

  it("fails a mandatory card nobody can take a seat on", () => {
    let s = calm(campaign(1, 5));
    for (const p of s.people) if (p.status === "scion") p.status = "retired";
    s.year = 5;
    s.gate = { cards: [{ ...card(3, "mandatory", "pit"), size: 8, boss: "siege_beast" }], votes: [null] };
    s = move(s, "p1", { type: "seal" });
    expect(s.log.some((l) => l.includes("No one answers"))).toBe(true);
    expect(s.log.some((l) => l.startsWith("Devastation"))).toBe(true);
    expect([s.year, s.phase]).toEqual([6, "settlement"]);
  });
});
