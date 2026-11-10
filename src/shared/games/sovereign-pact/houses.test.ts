// House traits and the House element (§5.3, §5.6, §5.7): the content set, what houseEffects sums, and
// what rides into battle and into each new recruit.
import { describe, expect, it } from "vitest";
import { createRng } from "../../rng.ts";
import { ATTACK, act, mpCost } from "./combat/battle.ts";
import { caps, enemyCombatant, newBattle, scionCombatant } from "./combat/build.ts";
import { hitChance, strike } from "./combat/damage.ts";
import { atLevel } from "./combat/fixtures.ts";
import { ABILITY_SETS, HOUSE_TRAIT_BY_ID, HOUSE_TRAITS, JOB_BY_ID } from "./content.ts";
import { promote, rollRecruit } from "./generate.ts";
import { jpFor } from "./assign.ts";
import { byPct, houseEffects, opposite } from "./houses.ts";
import { sovereignPact, type SovState } from "./index.ts";
import { listPrice, priceFor } from "./market.ts";
import { categories } from "./score.ts";
import { buildCost, upkeepDue } from "./town.ts";
import { BASE_JOBS, ELEMENTS, SCORE_CATEGORIES, type House } from "./state.ts";
import { calm, campaign } from "./testing.ts";
import { TUNING } from "./tuning.ts";

const E = TUNING.houses.element;
type Blood = Pick<House, "traits" | "element" | "bane">;
const blood = (traits: string[], element: House["element"] = "fire", bane?: House["bane"]): Blood => ({ traits, element, ...(bane ? { bane } : {}) });

describe("the House trait set (§5.7)", () => {
  it("has every kind, with the spec's Major, Flaw and Bloodline counts", () => {
    const count = (kind: string) => HOUSE_TRAITS.filter((t) => t.kind === kind).length;
    expect([count("major"), count("major_flaw"), count("bloodline")]).toEqual([20, 15, 10]);
    expect(count("minor")).toBeGreaterThanOrEqual(20);
    expect(count("minor_flaw")).toBeGreaterThanOrEqual(12);
  });

  it("only names battle mods the rules read, real Jobs and real score categories", () => {
    const read = [
      /^(accuracy|crit|evasion|ctStart|restCt|rangedAccuracy|meleeDrainPct|injurySteps|moveCostPct|itemHealPct)$/,
      /^(maxHp|maxMp|maxSanity|healingDealt|healingReceived|head|body|arms|legs(Durability)?)Pct$/,
      /^(arms|body|legs|head)DurabilityPct$/,
      /^ward\.(holy|dark|fire|water|earth|wind)$/,
      /^resist\.\w+$/,
      /^immune\.tipsy$/,
    ];
    for (const t of HOUSE_TRAITS) {
      for (const key of Object.keys(t.mods ?? {})) expect(read.some((r) => r.test(key)), `${t.id}: ${key}`).toBe(true);
      for (const job of Object.keys(t.jobXp ?? {})) expect(JOB_BY_ID.has(job as never), `${t.id}: ${job}`).toBe(true);
      for (const cat of Object.keys(t.score ?? {})) expect(SCORE_CATEGORIES, t.id).toContain(cat);
      expect(t.flavor.length && t.crunch.length, t.id).toBeTruthy();
    }
  });
});

describe("houseEffects (§5.3)", () => {
  it("aligns a House with its element and against the opposite, or gives Unaligned resistance", () => {
    expect(ELEMENTS.map(opposite)).toEqual(["dark", "holy", "water", "fire", "wind", "earth"]);
    const fire = houseEffects(blood([], "fire")).mods;
    expect(fire).toEqual({ "ward.fire": E.aligned, "ward.water": -E.aligned, "spellMp.fire": -E.spellMpPct });
    expect(houseEffects(blood([], null)).mods).toEqual({ "resist.physical": E.unaligned, "resist.mental": E.unaligned });
  });

  it("sums traits, spreads `all` growth over every stat but Speed, and applies Elemental Bane's choice", () => {
    const fx = houseEffects(blood(["sun_blessed", "elemental_bane"], "holy", "earth"));
    expect(fx.mods["ward.holy"]).toBe(E.aligned + 20);
    expect(fx.mods["ward.earth"]).toBe(-E.bane);
    expect(fx.growth.sagacity).toBe(10);
    expect(fx.tags).toContain("elemental_bane");
    const all = HOUSE_TRAITS.find((t) => t.growth?.all)!;
    const g = houseEffects(blood([all.id])).growth;
    expect(g.might).toBe(all.growth!.all! + (all.growth!.might ?? 0));
    expect(g.speed).toBeUndefined();
    expect(houseEffects(blood(["no_such_trait"])).growth).toEqual({});
  });
});

describe("House traits in battle", () => {
  const person = (job: (typeof BASE_JOBS)[number] = "magus") => atLevel(promote(rollRecruit(createRng(4), 1, 0), job), 6);
  const at = { id: 1, col: 0, row: 3 };

  it("shift affinity by the House element, and cheapen its spells", () => {
    const p = person();
    const plain = scionCombatant(p, at);
    const u = scionCombatant(p, { ...at, house: blood([], "fire") });
    expect((u.affinity.fire ?? 0) - (plain.affinity.fire ?? 0)).toBe(E.aligned);
    expect((u.affinity.water ?? 0) - (plain.affinity.water ?? 0)).toBe(-E.aligned);
    const ember = ABILITY_SETS.flatMap((s) => s.actives).find((a) => a.id === "ember")!;
    expect(mpCost(u, ember)).toBeLessThan(mpCost(plain, ember));
    const unaligned = scionCombatant(p, { ...at, house: blood([], null) });
    expect(unaligned.resist.mental - plain.resist.mental).toBe(E.unaligned);
  });

  it("carry Iron Discipline's cheaper rest, Slow to Wake's late start and Students' extra MP", () => {
    const p = person();
    const u = scionCombatant(p, { ...at, ct: 100, house: blood(["iron_discipline", "slow_to_wake", "students_of_the_arcane"]) });
    expect(u.ct).toBe(80);
    expect(u.maxMp).toBe(Math.floor(scionCombatant(p, at).maxMp * 1.1));
    u.ct = 100;
    const foe = enemyCombatant("barrow_skeleton", { id: 9, level: 2, col: 0, row: 3 });
    const b = newBattle(1, [u, foe]);
    b.actor = u.id;
    act(b, createRng(1), u, { do: "wait" });
    expect(u.ct).toBe(100 - (TUNING.combat.cost.wait - 10));
  });

  it("lets Sanguine blood drain on a melee blow, not a bow shot", () => {
    const p = person("soldier");
    const healed = (reach: "melee" | "ranged") => {
      const weapon = { kind: reach === "melee" ? "sword" : "bow", power: 200, acc: 500, crit: 0, reach, hands: 1 } as const;
      const u = { ...scionCombatant(p, { ...at, weapon, house: blood(["sanguine"]) }), hp: 1 };
      const foe = { ...enemyCombatant("barrow_skeleton", { id: 9, level: 2, col: 0, row: 3 }), evasion: 0, hp: 9999, maxHp: 9999 };
      strike(newBattle(1, [u, foe]), createRng(5), u, foe, ATTACK);
      return u.hp - 1;
    };
    expect(healed("melee")).toBeGreaterThan(0);
    expect(healed("ranged")).toBe(0);
  });

  it("gives Hunters of the Deep Wood a truer bow", () => {
    const p = person("vagabond");
    const bow = { kind: "bow", power: 10, acc: 40, crit: 0, reach: "ranged", hands: 2 } as const;
    const foe = { ...enemyCombatant("barrow_skeleton", { id: 9, level: 2, col: 0, row: 3 }), evasion: 30 };
    const chance = (traits: string[]) => hitChance(scionCombatant(p, { ...at, weapon: bow, house: blood(traits) }), foe, ATTACK);
    expect(chance(["hunters_of_the_deep_wood"]) - chance([])).toBe(10);
  });
});

describe("House traits in recruits and in town", () => {
  it("scale each rolled growth rate after the roll, keeping the draws", () => {
    const plain = rollRecruit(createRng(9), 1, 0);
    const bred = rollRecruit(createRng(9), 1, 0, blood(["sun_blessed"]));
    expect(bred.name).toBe(plain.name);
    expect(bred.growth[4]).toBe(Math.round(plain.growth[4] * 1.1));
    expect(bred.growth[0]).toBe(plain.growth[0]);
  });

  it("raises the town ceilings a battle starts from: the Year's MP refill reaches a House's extra MP", () => {
    const s = calm(campaign(1, 3));
    s.houses[0]!.traits = ["students_of_the_arcane"];
    const p = s.people.find((x) => x.status === "scion")!;
    const { mp } = caps(s, p);
    const u = scionCombatant(p, { id: 1, col: 0, row: 3, house: s.houses[0]! });
    expect(mp).toBeGreaterThanOrEqual(u.maxMp);
  });
});

describe("House traits in the economy (§5.7)", () => {
  const solo = (traits: string[]) => {
    const s = calm(campaign(1, 3));
    s.houses[0]!.traits = traits;
    return s;
  };
  const seal = (s: SovState) => {
    const r = sovereignPact.applyMove(s, "p1", { type: "seal" });
    if (!r.ok) throw new Error(r.error);
    return r.state;
  };
  const income = (traits: string[]) => {
    const s = solo(traits);
    s.people = s.people.filter((p) => p.status === "recruit").slice(0, 0);
    const before = s.houses[0]!.gold;
    return seal(s).houses[0]!.gold - before;
  };

  it("moves Gold income and upkeep by the House's %", () => {
    const plain = income([]);
    expect(income(["deep_coffers"])).toBeGreaterThan(plain);
    expect(income(["poor_lands"])).toBeLessThan(plain);
    const s = solo([]);
    const base = upkeepDue(s, 0).gold;
    s.houses[0]!.traits = ["gluttonous"];
    expect(upkeepDue(s, 0).gold).toBe(byPct(base, 10));
  });

  it("yields resources each Year by trait, tithed like any income (Josh 2026-11-10)", () => {
    const iron = (traits: string[]) => {
      const s = solo(traits);
      const before = s.houses[0]!.stores.iron ?? 0;
      return (seal(s).houses[0]!.stores.iron ?? 0) - before;
    };
    const made = HOUSE_TRAIT_BY_ID.get("deep_delvers")!.economy!["yield.iron"]!;
    expect(iron(["deep_delvers"]) - iron([])).toBe(made - Math.round(made * TUNING.economy.tithe));
  });

  it("charges Debt-Ridden interest, pays debts down from Gold, and lets Light-Fingered Servants steal", () => {
    let s = solo(["debt_ridden", "light_fingered_servants"]);
    s.people = [];
    Object.assign(s.houses[0]!, { gold: 0, debt: 100, stores: { stone: 100 } });
    s = seal(s);
    const paid = income([]);
    expect(s.houses[0]!.debt).toBe(110 - paid);
    expect(s.houses[0]!.gold).toBe(0);
    expect(s.houses[0]!.stores.stone).toBe(95);
  });

  it("brings Barren recruits every other Year, Many-Branched Tree an extra chance, Bad Blood a smaller pool", () => {
    const arrived = (traits: string[], year: number, keep = 0) => {
      const s = solo(traits);
      s.year = year;
      const recruits = s.people.filter((p) => p.status === "recruit");
      s.people = s.people.filter((p) => p.status !== "recruit").concat(recruits.slice(0, keep));
      return seal(s).people.filter((p) => p.status === "recruit").length - keep;
    };
    expect([arrived([], 1), arrived(["barren"], 1), arrived(["barren"], 2)]).toEqual([1, 0, 1]);
    expect([arrived(["many_branched_tree"], 1), arrived(["many_branched_tree"], 2)]).toEqual([1, 2]);
    const cap = TUNING.houses.recruitPoolCap;
    expect([arrived([], 1, cap - 1), arrived(["bad_blood"], 1, cap - 1)]).toEqual([1, 0]);
  });

  it("discounts Patrons of the Guilds in the shops and Scholarly on the Scriptorium", () => {
    const s = solo(["patrons_of_the_guilds", "scholarly"]);
    const item = { id: s.nextId++, base: "sword", tier: 2 as const, ilvl: 1, house: -1 };
    s.market = [{ item, shop: "weaponsmith", price: listPrice(item), auction: false, bids: [null] }];
    expect(priceFor(s, 0, s.market[0]!)).toBe(byPct(listPrice(item), -10));
    expect(buildCost("scriptorium", 1, s.houses[0]!)!.gold).toBe(byPct(buildCost("scriptorium", 1)!.gold!, -20));
    expect(buildCost("farm", 1, s.houses[0]!)).toEqual(buildCost("farm", 1));
  });

  it("moves a score category, the JP a Job earns, and Sanity in town", () => {
    const s = solo([]);
    const lineage = categories(s, 0).lineage;
    s.houses[0]!.traits = ["old_blood_of_kings", "martial_lineage", "fond_of_wine"];
    expect(categories(s, 0).lineage).toBe(Math.floor(lineage * 1.1));
    const p = { ...s.people.find((x) => x.status === "scion")!, job: "soldier" as const, jp: {} };
    expect(jpFor(s, p, 100).jp.soldier).toBe(115);
    expect(jpFor(s, { ...p, job: "magus" }, 100).jp.magus).toBe(100);
    const rested = (traits: string[]) => {
      const t = solo(traits);
      const id = t.people.find((x) => x.status === "scion")!.id;
      t.people.find((x) => x.id === id)!.sanity = 0;
      return seal(t).people.find((x) => x.id === id)!.sanity;
    };
    expect(rested(["fond_of_wine"])).toBeGreaterThan(rested([]));
  });
});
