import { describe, expect, it } from "vitest";
import { createRng } from "../../rng.ts";
import { scionCombatant } from "./combat/build.ts";
import { promote, rollRecruit } from "./generate.ts";
import { sovereignPact } from "./index.ts";
import { baseOf, cannotEquip, carry, equip, equipStarter, gearTotals, itemSheet, mint, stash, weaponOf } from "./items.ts";
import { ITEM_BASES } from "./content.ts";
import type { BASE_JOBS, Person, SovState } from "./state.ts";
import { campaign } from "./testing.ts";

const scion = (s: SovState, job: (typeof BASE_JOBS)[number], house = 0): Person => {
  const p = promote(rollRecruit(createRng(s.nextId), s.nextId++, house), job);
  s.people.push(p);
  return p;
};

describe("weapons (§13.2)", () => {
  it("grow with item level and tier, from the power index", () => {
    const s = campaign(1);
    const sword = (tier: 1 | 2 | 3 | 4 | 5, ilvl: number) => weaponOf(mint(s, "sword", 0, tier, ilvl)).power;
    expect(sword(2, 1)).toBe(9); // 100% of the level-1 block (6 + 3 + 0.1)
    expect(sword(2, 10)).toBe(46);
    expect(sword(5, 10)).toBeGreaterThan(sword(2, 10));
    expect(sword(1, 10)).toBeLessThan(sword(2, 10));
    expect(weaponOf(mint(s, "greatsword", 0, 2, 10)).power).toBeGreaterThan(sword(2, 10));
  });

  it("carry their quirks into battle", () => {
    const s = campaign(1);
    const axe = weaponOf(mint(s, "axe", 0));
    expect(axe.critStatus).toBe("bleed");
    expect(axe.aims).toEqual(["arms", "body"]);
  });
});

describe("wearing gear (§12.3, §13.1)", () => {
  it("keeps to the Job's weapons, armor and shields, and the House's own items", () => {
    const s = campaign(2);
    const vag = scion(s, "vagabond");
    expect(cannotEquip(s, vag, mint(s, "bow", 0), "main")).toBeNull();
    expect(cannotEquip(s, vag, mint(s, "greatsword", 0), "main")).toMatch(/Job/);
    expect(cannotEquip(s, vag, mint(s, "plate", 0), "body")).toMatch(/heavy/);
    expect(cannotEquip(s, vag, mint(s, "bow", 1), "main")).toMatch(/House/);
    expect(cannotEquip(s, vag, mint(s, "hood", 0), "body")).toMatch(/slot/);
  });

  it("frees the off hand for a two-hander and moves an item between wearers", () => {
    const s = campaign(1);
    const knight = scion(s, "knight");
    equip(s, knight, mint(s, "sword", 0), "main");
    equip(s, knight, mint(s, "heater_shield", 0), "off");
    const spear = mint(s, "spear", 0);
    expect(baseOf(spear).hands).toBe(2);
    equip(s, knight, spear, "main");
    expect(knight.gear.off).toBeUndefined();
    const other = scion(s, "knight");
    equip(s, other, spear, "main");
    expect(knight.gear.main).toBeUndefined();
    expect(other.gear.main).toBe(spear.id);
    expect(stash(s, 0).map((i) => i.id)).not.toContain(spear.id);
  });

  it("adds worn armor up, and slows a Scion carrying too much", () => {
    const s = campaign(1);
    const soldier = scion(s, "soldier");
    for (const [base, slot] of [["helm", "head"], ["plate", "body"], ["gauntlets", "arms"], ["sabatons", "legs"], ["tower_shield", "off"]] as const)
      equip(s, soldier, mint(s, base, 0, 2, 5), slot);
    const t = gearTotals(s, soldier);
    expect(t.defense).toBeGreaterThan(0);
    expect(t.durabilityPct.body).toBe(50);
    expect(t.guard).toBe(35);
    expect(t.weight).toBe(15);
    expect(t.evasion).toBe(-24 - Math.max(0, 15 - carry(soldier)));
  });
});

describe("starting kit", () => {
  it("gives every starting Scion a Crude weapon and armor their Job allows", () => {
    const s = campaign(4);
    const scions = s.people.filter((p) => p.status === "scion");
    expect(scions.length).toBeGreaterThan(0);
    for (const p of scions) {
      expect(p.gear.main, p.job ?? "").toBeDefined();
      expect(p.gear.body).toBeDefined();
      for (const [slot, id] of Object.entries(p.gear)) {
        const item = s.items.find((i) => i.id === id)!;
        expect(item.tier).toBe(1);
        expect(item.house).toBe(p.host);
        expect(cannotEquip(s, p, item, slot as keyof Person["gear"])).toBeNull();
      }
    }
  });

  it("brings that kit into battle", () => {
    const s = campaign(1);
    const p = scion(s, "soldier");
    const bare = scionCombatant(p, { id: 1, col: 0, row: 0 });
    equipStarter(s, p);
    const armed = scionCombatant(p, { id: 1, col: 0, row: 0, gear: gearTotals(s, p) });
    expect(armed.weapon.kind).not.toBe("unarmed");
    expect(armed.maxDur!.body).toBeGreaterThan(bare.maxDur!.body);
  });

  it("is the same for the same seed", () => {
    const players = ["a", "b"];
    const a = sovereignPact.setup(players, createRng(5), {});
    const b = sovereignPact.setup(players, createRng(5), {});
    expect(a.items).toEqual(b.items);
  });
});

describe("an item's sheet (Josh 2026-11-03: gear stats from a dropdown are hard to read)", () => {
  it("gives a weapon's power, accuracy and crit as combat reads them, an armor piece its defense, and properties in words", () => {
    const s = campaign(1, 1);
    const sword = mint(s, "sword", 0, 3, 4);
    const sheet = itemSheet(sword);
    const w = weaponOf(sword);
    expect(sheet.stats.find((x) => x.key === "power")?.value).toBe(w.power);
    expect(sheet.stats.find((x) => x.key === "acc")?.value).toBe(w.acc);
    expect(sheet.stats.find((x) => x.key === "weight")?.low).toBe(true);
    const helm = mint(s, ITEM_BASES.find((b) => b.slot === "head" && b.armor === "heavy")!.id, 0, 2, 3);
    const h = itemSheet(helm);
    expect(h.stats.find((x) => x.key === "defense")!.value).toBeGreaterThan(0);
    expect(h.stats.find((x) => x.key === "durability")).toMatchObject({ label: "Head Durability", unit: "%" });
    expect(h.notes).toContain("Heavy armor");
    sword.props = [["keen", 9], ["massive_crits", 1]];
    expect(itemSheet(sword).props).toEqual([
      { name: "Keen", value: 9, text: "Crit chance up", bad: false },
      { name: "Massive crits", text: "Crits deal ×2.5 instead of ×1.5", bad: false },
    ]);
  });
});
