import { describe, expect, it } from "vitest";
import { scionCredits } from "./credits";
import LAYERS from "./scion-layers.json";
import { attackOf, lookOf, piecesOf } from "./ScionSprite";

const person = (id: number, over: Partial<{ sex: "m" | "f"; age: number; job: string | null; status: "recruit" | "scion" }> = {}) =>
  ({ id, sex: "m" as const, age: 25, job: "knight", status: "scion", ...over }) as unknown as Parameters<typeof lookOf>[0];

describe("Scion sprites", () => {
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
});
