// Promotion (§6.5) and the Tarot's bonuses (§6.8).
import { describe, expect, it } from "vitest";
import { createRng } from "../../rng.ts";
import { scionCombatant } from "./combat/build.ts";
import { promote, rollRecruit } from "./generate.ts";
import { sovereignPact, type SovMove, type SovState } from "./index.ts";
import { passiveBudget, tarotMods } from "./progression.ts";
import { ashore, calm, campaign, playOut } from "./testing.ts";
import { TUNING } from "./tuning.ts";
import { view } from "./view.ts";

const g = sovereignPact;
const P = TUNING.promotion;
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
const recruits = (s: SovState, house: number) => s.people.filter((p) => p.host === house && p.status === "recruit");

describe("promotion (§6.5)", () => {
  it("makes a recruit a Scion in a base Job for Gold, with plain gear, and shows the Tarot", () => {
    let s = calm(campaign(2, 3));
    const r = recruits(s, 0)[0]!;
    expect(view(s, "p1").people.find((p) => p.id === r.id)!.tarot).toBeUndefined();
    const gold = s.houses[0]!.gold;
    s = move(s, "p1", { type: "promote", person: r.id, job: "magus" });
    const p = s.people.find((x) => x.id === r.id)!;
    expect([p.status, p.job, p.level]).toEqual(["scion", "magus", r.level]);
    expect(s.houses[0]!.gold).toBe(gold - P.gold);
    expect(Object.keys(p.gear).length).toBeGreaterThan(0);
    expect(view(s, "p2").people.find((x) => x.id === r.id)!.tarot).toBe(r.tarot);
    expect(s.log.at(-1)).toMatch(/raises .* to Scion/);
    // The newest Scion is listed last (Josh 2026-11-11).
    expect(view(s, "p1").people.filter((x) => x.host === 0 && x.status === "scion").at(-1)!.id).toBe(r.id);
  });

  it("holds one ceremony a Year, two with a Chapel, and refuses what it cannot do", () => {
    let s = calm(campaign(2, 3));
    const [a, b, c] = recruits(s, 0);
    const scion = s.people.find((p) => p.host === 0 && p.status === "scion")!;
    expect(error(s, "p1", { type: "promote", person: scion.id, job: "soldier" })).toMatch(/recruits/);
    expect(error(s, "p2", { type: "promote", person: a!.id, job: "soldier" })).toMatch(/recruits/);
    expect(error(s, "p1", { type: "promote", person: a!.id, job: "ravager" })).toMatch(/base Job/);
    s = move(s, "p1", { type: "promote", person: a!.id, job: "soldier" });
    expect(error(s, "p1", { type: "promote", person: b!.id, job: "soldier" })).toMatch(/no ceremony/);
    s.houses[0]!.buildings.chapel = 1;
    s = move(s, "p1", { type: "promote", person: b!.id, job: "soldier" });
    expect(error(s, "p1", { type: "promote", person: c!.id, job: "soldier" })).toMatch(/no ceremony/);
    s = move(move(s, "p1", { type: "seal" }), "p2", { type: "seal" });
    s.houses[0]!.gold = 0;
    expect(error(s, "p1", { type: "promote", person: c!.id, job: "soldier" })).toMatch(/costs/);
  });

  it("lets the bot grow its roster over a campaign", () => {
    const start = ashore(campaign(2, 5));
    const end = playOut(start);
    const scions = (s: SovState) => s.people.filter((p) => p.host === 0 && p.status === "scion").length;
    expect(scions(end)).toBeGreaterThan(scions(start));
  });
});

describe("the Tarot (§6.8)", () => {
  const scion = (tarot: string, reversed = false) => ({ ...promote(rollRecruit(createRng(1), 1, 0), "soldier"), traits: [], tarot, ...(reversed ? { reversed: true as const } : {}) });

  it("gives its bonus in battle, and Reversed takes it away instead", () => {
    const at = { id: 1, col: 0, row: 3 };
    const plain = scionCombatant(scion("emperor"), at);
    expect(scionCombatant(scion("strength"), at).might).toBe(plain.might + 2);
    expect(scionCombatant(scion("strength", true), at).might).toBe(plain.might - 2);
    expect(tarotMods({ tarot: "sun", reversed: true })).toEqual({ "ward.holy": -5 });
    expect(scionCombatant(scion("sun"), at).mods["immune.blind"]).toBe(1);
  });

  it("gives The World a passive point", () => {
    expect(passiveBudget(scion("world"))).toBe(passiveBudget(scion("fool")) + 1);
    expect(passiveBudget(scion("world", true))).toBe(passiveBudget(scion("fool")) - 1);
  });

  it("deals a Superstitious House's cards Reversed about a quarter of the time", () => {
    const rng = createRng(8);
    const n = Array.from({ length: 400 }, (_, i) => rollRecruit(rng, i, 0, { traits: ["superstitious"], element: null })).filter((p) => p.reversed).length;
    expect(n / 400).toBeGreaterThan(0.18);
    expect(n / 400).toBeLessThan(0.32);
    expect(Array.from({ length: 50 }, (_, i) => rollRecruit(rng, i, 0)).some((p) => p.reversed)).toBe(false);
  });
});
