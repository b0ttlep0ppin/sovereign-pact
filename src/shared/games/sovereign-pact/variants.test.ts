// Variants (§14.10): declared elemental ones, Hollow for living fodder and bruisers, Unknown-touched from
// Year 10 at +1 level; the name, leanings, tags, immunities, Sanity touch and attack element composed.
import { describe, expect, it } from "vitest";
import { createRng } from "../../rng.ts";
import { encounter, place, rollVariants } from "./combat/encounter.ts";
import { variantsFor, withVariant } from "./combat/variants.ts";
import { ENEMY_BY_ID, type EnemyDef } from "./content.ts";

const def = (id: string) => ENEMY_BY_ID.get(`barrow_${id}`)!;
const living: EnemyDef = { ...def("grave_robber"), id: "test_brute", role: "bruiser", tags: ["humanoid"], variants: ["ashen"] };

describe("variants", () => {
  it("compose name, leanings (clamped), tags, Sanity touch and the element of plain attacks", () => {
    const v = withVariant(def("skeleton"), "ashen");
    expect(v.name).toBe("Ashen Skeleton");
    expect(v.affinity).toMatchObject({ fire: 50, water: -50, holy: -50, dark: 50 });
    expect(v.tags).toContain("fire");
    expect(v.abilities[0]!.element).toBe("fire");
    const h = withVariant(living, "hollow");
    expect(h.tags).toContain("undead");
    expect(h.stats?.sanityTouch).toBe(2);
    expect(h.immune).toEqual(expect.arrayContaining(["poison", "fear"]));
    const banshee = withVariant(def("banshee"), "unknown_touched");
    expect(banshee.affinity?.dark).toBe(100);
    expect(banshee.abilities.find((a) => a.id === "wail")!.element).toBe("dark");
  });

  it("are the declared elemental ones, Hollow for living fodder and bruisers, Unknown-touched from Year 10", () => {
    expect(variantsFor(def("skeleton")).map((v) => v.id)).toEqual(["ashen", "stone"]);
    expect(variantsFor(living).map((v) => v.id)).toEqual(["ashen", "hollow"]);
    expect(variantsFor(def("lich")).map((v) => v.id)).toEqual([]);
    expect(variantsFor(def("lich"), 10).map((v) => v.id)).toEqual(["unknown_touched"]);
    expect(variantsFor(def("bride"), 12)).toEqual([]);
  });

  it("are rolled at their odds, and placed with their level and tint id", () => {
    const rng = createRng(4);
    let n = 0;
    let unknown = 0;
    for (let i = 0; i < 1000; i++) {
      const [a] = rollVariants(rng, [def("skeleton")]);
      if ("def" in a!) n++;
      const [b] = rollVariants(rng, [def("lich")], 12);
      if ("def" in b! && b.variant === "unknown_touched") unknown++;
    }
    expect(n / 1000).toBeGreaterThan(0.14);
    expect(n / 1000).toBeLessThan(0.26);
    expect(unknown / 1000).toBeGreaterThan(0.24);
    const [u] = place([{ def: def("lich"), variant: "unknown_touched" }], 6);
    expect(u!.level).toBe(7);
    expect(u!.variant).toBe("unknown_touched");
    expect(u!.name).toBe("Unknown-touched Lich");
  });

  it("show up in drawn encounters, Unknown-touched only late in the campaign", () => {
    const count = (year: number) => {
      let any = 0;
      let unknown = 0;
      for (let i = 0; i < 300; i++) {
        const e = encounter(createRng(i), { pool: "barrows", level: 5, party: 4, year, modifier: null });
        any += e.enemies.filter((u) => u.variant).length;
        unknown += e.enemies.filter((u) => u.variant === "unknown_touched").length;
      }
      return { any, unknown };
    };
    expect(count(3).any).toBeGreaterThan(0);
    expect(count(3).unknown).toBe(0);
    expect(count(12).unknown).toBeGreaterThan(0);
  });
});
