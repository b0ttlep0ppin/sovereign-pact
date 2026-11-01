// Individual traits (§6.3, §6.7): the content set, how recruits roll them, and what they carry into battle.
import { describe, expect, it } from "vitest";
import { createRng } from "../../rng.ts";
import { scionCombatant } from "./combat/build.ts";
import { TRAIT_BY_ID, TRAITS } from "./content.ts";
import { promote, rollRecruit, rollTraits } from "./generate.ts";

describe("the individual trait set (§6.7)", () => {
  it("names only battle mods the rules read", () => {
    const read = [
      /^(speed|accuracy|rangedAccuracy|evasion|crit|lucky|injurySteps|dualWieldMastery|moveCostPct)$/,
      /^(maxHp|maxMp|maxSanity|healingDealt|healingReceived|head)Pct$/,
      /^headDurabilityPct$/,
      /^(ward)\.(holy|dark|fire|water|earth|wind)$/,
      /^(resist|immune)\.\w+$/,
    ];
    for (const t of TRAITS) for (const key of Object.keys(t.mods ?? {})) expect(read.some((r) => r.test(key)), `${t.id}: ${key}`).toBe(true);
    expect(TRAITS.filter((t) => t.weight > 0).length).toBeGreaterThanOrEqual(40);
  });
});

describe("rolling individual traits (§6.3)", () => {
  const groupOf = (id: string) => TRAIT_BY_ID.get(id)!.group;

  it("gives 1–3 rollable traits, at most one of a group", () => {
    const rng = createRng(2);
    const counts = [0, 0, 0, 0];
    for (let n = 0; n < 600; n++) {
      const traits = rollTraits(rng);
      counts[traits.length]! += 1;
      expect(new Set(traits).size).toBe(traits.length);
      expect(traits.every((t) => TRAIT_BY_ID.get(t)!.weight > 0)).toBe(true);
      const groups = traits.map(groupOf).filter(Boolean);
      expect(new Set(groups).size).toBe(groups.length);
    }
    expect(counts[0]).toBe(0);
    expect(counts[1]! > counts[2]! && counts[2]! > counts[3]!).toBe(true);
  });

  it("rolls the House's innate traits by their chance, and its element's traits more often", () => {
    const rng = createRng(3);
    const fleet = { traits: ["fleet_of_foot"], element: null };
    const share = Array.from({ length: 500 }, () => rollTraits(rng, fleet)).filter((t) => t.includes("fleet")).length / 500;
    expect(share).toBeGreaterThan(0.25);
    expect(share).toBeLessThan(0.45);
    const holy = (element: "holy" | null) =>
      Array.from({ length: 800 }, () => rollTraits(rng, { traits: [], element })).flat().filter((t) => TRAIT_BY_ID.get(t)!.element === "holy").length;
    expect(holy("holy")).toBeGreaterThan(holy(null) * 1.4);
  });

  it("puts a new recruit's traits on the record, and carries them into battle", () => {
    const p = rollRecruit(createRng(5), 1, 0);
    expect(p.traits.length).toBeGreaterThanOrEqual(1);
    const scion = promote({ ...p, traits: [] }, "soldier");
    const plain = scionCombatant(scion, { id: 1, col: 0, row: 3 });
    const fleet = scionCombatant({ ...scion, traits: ["fleet", "thick_skull"] }, { id: 1, col: 0, row: 3 });
    expect(fleet.mods.speed).toBe(1);
    expect(fleet.maxDur!.head).toBeGreaterThan(plain.maxDur!.head);
  });
});
