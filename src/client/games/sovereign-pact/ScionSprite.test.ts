import { describe, expect, it } from "vitest";
import { scionCredits } from "./credits";
import LAYERS from "./scion-layers.json";
import { animFor, attackOf, kitOf, lookOf, lunges, piecesOf } from "./ScionSprite";

const person = (id: number, over: Partial<{ sex: "m" | "f"; age: number; job: string | null; status: "recruit" | "scion"; look: string[] }> = {}) =>
  ({ id, sex: "m" as const, age: 25, job: "knight", status: "scion", ...over }) as unknown as Parameters<typeof lookOf>[0];

describe("Scion sprites", () => {
  it("wears the House's restyling over the look they were born with (§5.8)", () => {
    const styled = lookOf(person(7, { look: ["hair=wavy", "hair_color=ginger", "beard=none"] }), undefined);
    expect([styled.hair, styled.hairColor, styled.beard]).toEqual(["wavy", "ginger", undefined]);
    const bearded = lookOf(person(7, { look: ["beard=medium"] }), undefined);
    expect([bearded.hair, bearded.beard]).toEqual([lookOf(person(7), undefined).hair, "medium"]);
  });

  it("draws the same person the same way every time", () => {
    expect(lookOf(person(7), ["gules", "or"])).toEqual(lookOf(person(7), ["gules", "or"]));
  });

  it("dresses each Job in its outfit and a recruit in plain clothes", () => {
    const knight = piecesOf(lookOf(person(1), ["azure", "argent"])).map((p) => p.layer.slot);
    expect(knight).toEqual(expect.arrayContaining(["body", "head", "armor", "weapon", "shield"]));
    const recruit = piecesOf(lookOf(person(1, { status: "recruit", job: null }), undefined)).map((p) => p.layer.slot);
    expect(recruit).not.toContain("weapon");
    expect(recruit).not.toContain("armor");
    expect(attackOf(lookOf(person(1, { job: "magus" }), undefined))).toBe("spellcast");
  });

  it("gives the old an elderly head and pale hair", () => {
    const look = lookOf(person(2, { sex: "f", age: 61 }), undefined);
    expect(look.elderly).toBe(true);
    expect(["gray", "white"]).toContain(look.hairColor);
    expect(piecesOf(look).find((p) => p.layer.slot === "head")?.layer.option).toBe("female_elderly");
  });

  it("stacks pieces back to front", () => {
    const z = piecesOf(lookOf(person(3), undefined)).map((p) => p.layer.z);
    expect(z).toEqual([...z].sort((a, b) => a - b));
  });

  it("ships only attribution-only art, every piece credited", () => {
    expect(LAYERS.credits.length).toBeGreaterThan(0);
    for (const c of LAYERS.credits) {
      expect(c.licenses.length).toBeGreaterThan(0);
      for (const l of c.licenses) expect(l).toMatch(/^(OGA-BY|CC-BY|CC0)/);
      expect(c.authors.length).toBeGreaterThan(0);
    }
    const lines = scionCredits().join(" ");
    expect(lines).toContain("Stephen Challener (Redshrike)");
    expect(lines).not.toContain("@");
    expect(lines).not.toMatch(/SA|GPL/);
  });

  it("animates what a Scion does, not only what they carry", () => {
    const knight = lookOf(person(4), undefined);
    const vagabond = lookOf(person(4, { job: "vagabond" }), undefined);
    expect(animFor(knight, { kind: "magic" })).toBe("spellcast");
    expect(animFor(knight, { kind: "heal" })).toBe("spellcast");
    expect(animFor(knight, { kind: "physical" })).toBe("slash");
    expect(animFor(vagabond, { kind: "physical", reach: "ranged" })).toBe("shoot");
    expect(animFor(vagabond, undefined)).toBe("shoot");
    expect(lunges("slash")).toBe(true);
    expect(lunges("spellcast")).toBe(false);
  });

  it("draws the gear a Scion wears over their Job's outfit (8aj)", () => {
    const items = [
      { id: 1, base: "greatsword" },
      { id: 2, base: "tower_shield" },
      { id: 3, base: "helm" },
      { id: 4, base: "jerkin" },
    ];
    expect(kitOf({ main: 1, off: 2, head: 3, body: 4 }, items)).toEqual({ weapon: "longsword", shield: "scutum", hat: "nasal", armor: "leather" });
    // A Magus who took up a bow and wears nothing on their body shoots, unarmored, in their wizard's hat.
    const magus = lookOf({ ...person(9, { job: "magus" }), gear: { main: 5 } } as never, undefined, [{ id: 5, base: "bow" }]);
    const option = (slot: string) => piecesOf(magus).find((p) => p.layer.slot === slot)?.layer.option;
    expect(option("weapon")).toBe("bow");
    expect(option("armor")).toBeUndefined();
    expect(option("hat")).toBe("wizard");
    expect(attackOf(magus)).toBe("shoot");
  });
});
