import { describe, expect, it } from "vitest";
import { scionCredits } from "./credits";
import LAYERS from "./scion-layers.json";
import { animFor, attackOf, HELMS, kitOf, lookOf, lunges, piecesOf, underHat, type Pixels } from "./ScionSprite";

const person = (id: number, over: Partial<{ sex: "m" | "f"; age: number; job: string | null; status: "recruit" | "scion"; look: string[] }> = {}) =>
  ({ id, sex: "m" as const, age: 25, job: "knight", status: "scion", ...over }) as unknown as Parameters<typeof lookOf>[0];

describe("Scion sprites", () => {
  it("draws hair under headwear: kept inside its outline and below it, cut where it pokes out (§5.8)", () => {
    // One 8 px frame: a hat covering rows 1-3, columns 2-5, with an opening at row 2, columns 3-4.
    const frame = (on: (x: number, y: number) => boolean): Pixels => {
      const data = new Uint8ClampedArray(8 * 8 * 4);
      for (let y = 0; y < 8; y++) for (let x = 0; x < 8; x++) data[(y * 8 + x) * 4 + 3] = on(x, y) ? 255 : 0;
      return { data, width: 8, height: 8 };
    };
    const hat = frame((x, y) => y >= 1 && y <= 3 && x >= 2 && x <= 5 && !(y === 2 && (x === 3 || x === 4)));
    const hair = frame(() => true);
    const cut = underHat(hair, hat, 8);
    const shows = (x: number, y: number) => cut.data[(y * 8 + x) * 4 + 3]! > 0;
    expect(shows(3, 0)).toBe(false); // above the hat
    expect(shows(0, 2)).toBe(false); // beside it
    expect(shows(3, 2)).toBe(true); // through its opening
    expect(shows(0, 5)).toBe(true); // falling below it
  });

  it("bares the head when headwear is off", () => {
    const worn = piecesOf(lookOf(person(1, { job: "magus" }), undefined)).map((p) => p.layer.slot);
    const off = piecesOf(lookOf(person(1, { job: "magus", look: ["headwear=off"] }), undefined)).map((p) => p.layer.slot);
    expect(worn).toContain("hat");
    expect(off).not.toContain("hat");
    expect(off).toContain("hair");
  });

  it("ties a Pugilist's hood as a kerchief; the hood is the Vagabond's (8at: a Hood keeps a Job's own hat)", () => {
    const hats = (job: string, hat?: string) =>
      piecesOf({ ...lookOf(person(2, { job }), undefined), ...(hat ? { kit: { weapon: "", armor: "", hat } } : {}) })
        .filter((p) => p.layer.slot === "hat")
        .map((p) => p.layer.id);
    expect(hats("pugilist").join()).toMatch(/kerchief|bandana|thick|tied/);
    expect(hats("pugilist", "hood").join()).not.toMatch(/hood/);
    expect(hats("vagabond").join()).toMatch(/hood/);
    // A Hood item keeps a Job's own cloth hat: the Magus stays in their wizard's hat.
    expect(hats("magus", "hood").join()).toMatch(/wizard/);
    expect(hats("recruit", "hood").join()).toMatch(/hood/);
    // A Soothsayer in a Hauberk wears their House's vestment over the mail.
    const slots = piecesOf({ ...lookOf(person(2, { job: "soothsayer" }), undefined), kit: { weapon: "staff", armor: "chainmail" } }).map((p) => p.layer.slot);
    expect(slots).toEqual(expect.arrayContaining(["armor", "tabard"]));
  });

  it("gives each Scion their own pieces of their Job's outfit, in their House's colors (8aq)", () => {
    const knights = Array.from({ length: 12 }, (_, i) => piecesOf(lookOf(person(100 + i), ["crimson", "amber"])));
    const helms = new Set(knights.map((ps) => ps.find((p) => p.layer.slot === "hat")?.layer.option));
    expect(helms.size).toBeGreaterThan(2);
    for (const ps of knights) {
      expect(HELMS.has(ps.find((p) => p.layer.slot === "hat")!.layer.option)).toBe(true);
      // The cape is always in the House's first color.
      expect(ps.find((p) => p.layer.slot === "cape")?.tones?.[4]).toBe("#9b1c24");
    }
    // A plume sits on a helmet; under a hood it stays home.
    const plumed = Array.from({ length: 30 }, (_, i) => lookOf(person(200 + i), ["crimson", "amber"])).find((l) => piecesOf(l).some((p) => p.layer.slot === "crest"))!;
    expect(piecesOf({ ...plumed, kit: { weapon: "sword", armor: "plate", hat: "hood" } }).some((p) => p.layer.slot === "crest")).toBe(false);
    // A Helm item keeps the helmet the Knight already wears.
    const own = piecesOf(plumed).find((p) => p.layer.slot === "hat")!.layer.option;
    expect(piecesOf({ ...plumed, kit: { weapon: "sword", armor: "plate", hat: "nasal" } }).find((p) => p.layer.slot === "hat")!.layer.option).toBe(own);
  });

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
    expect(option("hat")).toMatch(/^wizard/);
    expect(attackOf(magus)).toBe("shoot");
  });
});
