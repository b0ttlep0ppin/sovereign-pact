// House creation (§5.1): Random House drafts, the design rules, two Ambitions in secret, swearing.
import { describe, expect, it } from "vitest";
import { createRng } from "../../rng.ts";
import { HOUSE_TRAIT_BY_ID } from "./content.ts";
import { cannotTraits, draftHouse } from "./founding.ts";
import { sovereignPact, type SovMove, type SovState } from "./index.ts";
import { seats } from "./testing.ts";
import { view } from "./view.ts";

const g = sovereignPact;
const fresh = (H = 2, seed = 4): SovState => g.setup(seats(H), createRng(seed), undefined, undefined);
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

describe("founding the Houses (§5.1)", () => {
  it("starts every seat on a valid Random House draft, with no people until all have sworn", () => {
    const s = fresh(4);
    expect(s.phase).toBe("founding");
    expect(s.people).toEqual([]);
    expect(g.activePlayers(s)).toEqual(seats(4));
    expect(new Set(s.houses.map((h) => h.colors[0])).size).toBe(4);
    for (const h of s.houses) expect(cannotTraits(h.traits, h.bane)).toBeNull();
    expect(error(s, "p1", { type: "seal" })).toMatch(/Found your House/);
  });

  it("rolls Bloodlines about one House in four, and names a bane for Elemental Bane", () => {
    const rng = createRng(7);
    const drafts = Array.from({ length: 400 }, () => draftHouse(rng, [], 2));
    const bloodlines = drafts.filter((h) => h.traits.some((t) => HOUSE_TRAIT_BY_ID.get(t)!.kind === "bloodline")).length;
    expect(bloodlines / 400).toBeGreaterThan(0.17);
    expect(bloodlines / 400).toBeLessThan(0.33);
    for (const h of drafts) {
      expect(cannotTraits(h.traits, h.bane), h.traits.join()).toBeNull();
      expect(h.dealt![0]).not.toEqual(h.dealt![1]);
    }
  });

  it("checks a design: name, colors, Seat, element and the trait rules", () => {
    const s = fresh();
    expect(error(s, "p1", { type: "design", house: { name: "X" } })).toMatch(/2 to 24/);
    expect(error(s, "p1", { type: "design", house: { colors: ["crimson", "crimson"] } })).toMatch(/two different/);
    expect(error(s, "p1", { type: "design", house: { seat: "palace" } })).toMatch(/Seat/);
    expect(error(s, "p1", { type: "design", house: { element: "lightning" as never } })).toMatch(/element/);
    const two = s.houses[0]!.traits.slice(0, 2);
    expect(error(s, "p1", { type: "design", house: { traits: two } })).toMatch(/2 Major Traits/);
    expect(error(s, "p1", { type: "design", house: { traits: [...s.houses[0]!.traits.slice(1), s.houses[0]!.traits[1]!] } })).toMatch(/twice/);
    const bane = ["sun_blessed", "iron_discipline", "pious", "thrifty", "elemental_bane", "drunkards"];
    expect(error(s, "p1", { type: "design", house: { traits: bane } })).toMatch(/Name the element/);
    const t = move(s, "p1", { type: "design", house: { name: "Ashgrave", traits: bane, bane: "water" } });
    expect(t.houses[0]).toMatchObject({ name: "Ashgrave", traits: bane, bane: "water" });
    const blood = ["sanguine", "iron_discipline", "pious", "thrifty", "drunkards"];
    expect(move(t, "p1", { type: "design", house: { traits: blood } }).houses[0]!.bane).toBeUndefined();
  });

  it("rerolls one step or the whole House", () => {
    const s = fresh();
    const t = move(s, "p1", { type: "random_house", step: "seat" });
    expect({ ...t.houses[0]!, seat: s.houses[0]!.seat }).toEqual(s.houses[0]);
    const u = move(s, "p1", { type: "random_house" });
    expect(u.houses[0]!.name === s.houses[0]!.name && u.houses[0]!.traits.join() === s.houses[0]!.traits.join()).toBe(false);
    expect(u.houses[0]!.dealt).toEqual(s.houses[0]!.dealt);
    expect(error(s, "p1", { type: "random_house", step: "everything" as never })).toMatch(/no such step/);
  });

  it("deals two Ambitions only the House sees, and keeps the one it swears with", () => {
    let s = fresh();
    const dealt = s.houses[0]!.dealt!;
    expect(view(s, "p1").mine!.dealt).toEqual(dealt);
    expect(view(s, "p2").mine!.dealt).toEqual(s.houses[1]!.dealt);
    expect(JSON.stringify(view(s, "p2"))).not.toContain(JSON.stringify(dealt));
    expect(error(s, "p1", { type: "swear", ambition: 2 as never })).toMatch(/one of the two/);
    s = move(s, "p1", { type: "swear", ambition: 1 });
    expect(error(s, "p1", { type: "design", house: { name: "Other" } })).toMatch(/take back/);
    expect(g.passiveMoves!(s, "p1")).toEqual(["unseal"]);
    s = move(move(s, "p1", { type: "unseal" }), "p1", { type: "swear", ambition: 1 });
    s = move(s, "p2", { type: "swear", ambition: 0 });
    expect(s.phase).toBe("settlement");
    expect(s.houses[0]!.ambition).toEqual(dealt[1]);
    expect(s.houses.every((h) => h.dealt === undefined && !h.sealed)).toBe(true);
    expect(s.people.filter((p) => p.house === 0).length).toBeGreaterThan(0);
  });

  it("refuses a primary color another House has sworn under; the bot rerolls its own", () => {
    let s = fresh();
    s = move(s, "p1", { type: "swear", ambition: 0 });
    const taken = s.houses[0]!.colors[0];
    s = move(s, "p2", { type: "design", house: { colors: [taken, taken === "crimson" ? "moss" : "crimson"] } });
    expect(error(s, "p2", { type: "swear", ambition: 0 })).toMatch(/sworn under that color/);
    expect(g.botMove!(s, "p2", undefined as never)).toEqual({ type: "random_house", step: "colors" });
  });

  it("gives Debt-Ridden its debt when the campaign begins", () => {
    let s = fresh(1);
    const traits = ["sun_blessed", "iron_discipline", "pious", "thrifty", "debt_ridden", "drunkards"];
    s = move(s, "p1", { type: "design", house: { traits } });
    s = move(s, "p1", { type: "swear", ambition: 0 });
    expect(s.houses[0]!.debt).toBe(HOUSE_TRAIT_BY_ID.get("debt_ridden")!.economy!.startDebt);
  });
});
