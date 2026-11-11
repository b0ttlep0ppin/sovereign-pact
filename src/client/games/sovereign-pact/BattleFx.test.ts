import type { ReplayUnit } from "@vibepulse/shared/games/sovereign-pact";
import { describe, expect, it } from "vitest";
import { landsAt, strikesOf, WAVE_MS } from "./BattleFx";

const unit = (id: number, side: "party" | "enemy"): ReplayUnit => ({ id, side, name: `U${id}`, size: [1, 1], maxHp: 10, maxMp: 0, maxSanity: 0 }) as unknown as ReplayUnit;
const units = new Map([1, 2, 3].map((id) => [id, unit(id, id === 3 ? "enemy" : "party")]));

describe("strikesOf", () => {
  it("draws a Magus's Ember as a fire spell and a sword blow as melee", () => {
    const ember = strikesOf([{ t: "use", unit: 1, ability: "ember", target: { side: "enemy", col: 0, row: 0 } }, { t: "hit", unit: 1, target: 3, damage: 9, element: "fire" }], units);
    expect(ember).toEqual([{ from: 1, to: 3, kind: "spell", wave: 0, element: "fire" }]);
    const blow = strikesOf([{ t: "use", unit: 2, ability: "attack", target: { side: "enemy", col: 0, row: 0 } }, { t: "hit", unit: 2, target: 3, damage: 9, crit: true }], units);
    expect(blow).toEqual([{ from: 2, to: 3, kind: "melee", wave: 0, crit: true }]);
  });

  it("lands two actions in one turn one after the other", () => {
    const s = strikesOf([
      { t: "use", unit: 1, ability: "ember", target: { side: "enemy", col: 0, row: 0 } },
      { t: "hit", unit: 1, target: 3, damage: 9, element: "fire" },
      { t: "use", unit: 2, ability: "attack", target: { side: "enemy", col: 0, row: 0 } },
      { t: "miss", unit: 2, target: 3 },
    ], units);
    expect(s.map((x) => x.wave)).toEqual([0, 1]);
    expect(s[1]!.miss).toBe(true);
    expect(landsAt(s[1]!)).toBeGreaterThan(WAVE_MS);
  });

  it("draws a heal as a heal", () => {
    expect(strikesOf([{ t: "heal", unit: 1, target: 2, amount: 5 }], units)[0]!.kind).toBe("heal");
  });

  it("draws a blessing on an ally, a cure and a curse with no blow (Josh 2026-11-03: heals and buffs felt flat)", () => {
    const use = (ability: string) => ({ t: "use" as const, unit: 1, ability, target: { side: "party" as const, col: 0, row: 0 } });
    expect(strikesOf([use("attack"), { t: "status", target: 2, status: "haste@100", on: true }], units)).toEqual([{ from: 1, to: 2, kind: "boon", wave: 0, status: "haste" }]);
    expect(strikesOf([use("attack"), { t: "status", target: 3, status: "poison", on: true }], units)[0]).toMatchObject({ kind: "bane", status: "poison" });
    expect(strikesOf([use("attack"), { t: "sanity", target: 2, amount: 10 }], units)[0]).toMatchObject({ kind: "boon", status: "sanity" });
    // A status that only runs out is not drawn; nor is a blessing with no one acting.
    expect(strikesOf([use("attack"), { t: "status", target: 2, status: "haste", on: false }], units)).toEqual([]);
    expect(strikesOf([{ t: "status", target: 2, status: "haste", on: true }], units)).toEqual([]);
    // A blow's own poison rides the blow; a heal that also blesses is drawn once, as the heal.
    expect(strikesOf([use("attack"), { t: "hit", unit: 1, target: 3, damage: 4 }, { t: "status", target: 3, status: "poison", on: true }], units).map((x) => x.kind)).toEqual(["melee"]);
    expect(strikesOf([use("attack"), { t: "status", target: 2, status: "regen", on: true }, { t: "heal", unit: 1, target: 2, amount: 5 }], units).map((x) => x.kind)).toEqual(["heal"]);
  });

  it("sends a song's notes from the Minstrel to each hearer, and draws a Siphon back to the one who struck (Josh 2026-11-11)", () => {
    const song = strikesOf([
      { t: "status", target: 1, status: "hearthsong", on: true },
      { t: "status", target: 2, status: "hearthsong", on: true },
      { t: "use", unit: 1, ability: "hearthsong", target: { side: "party", col: 0, row: 0 } },
    ], units);
    expect(song).toEqual([
      { from: 1, to: 1, kind: "boon", wave: 0, status: "hearthsong", song: "hearthsong" },
      { from: 1, to: 2, kind: "boon", wave: 0, status: "hearthsong", song: "hearthsong" },
    ]);
    const dirge = strikesOf([{ t: "status", target: 3, status: "dirge", on: true }, { t: "use", unit: 1, ability: "dirge", target: { side: "enemy", col: 0, row: 0 } }], units);
    expect(dirge[0]).toMatchObject({ kind: "bane", song: "dirge", to: 3 });
    const siphon = strikesOf([
      { t: "use", unit: 1, ability: "attack", target: { side: "enemy", col: 0, row: 0 } },
      { t: "hit", unit: 1, target: 3, damage: 9 },
      { t: "status", target: 3, status: "haste", on: false, by: 1 },
    ], units);
    expect(siphon.map((x) => x.kind)).toEqual(["melee", "bane"]);
    expect(siphon[1]).toMatchObject({ from: 1, to: 3, wave: 0, status: "haste", siphon: true });
  });

  it("draws a spear's blow as a thrust", () => {
    const spear = new Map(units);
    spear.set(2, { ...units.get(2)!, weapon: "spear" });
    expect(strikesOf([{ t: "use", unit: 2, ability: "attack", target: { side: "enemy", col: 0, row: 0 } }, { t: "hit", unit: 2, target: 3, damage: 9 }], spear)[0]).toMatchObject({ kind: "melee", thrust: true });
  });

  it("draws a magic weapon's blow as its slash in its element's colours, a creature's as a spell", () => {
    const armed = new Map(units);
    armed.set(2, { ...units.get(2)!, weapon: "sword" });
    const hit = (unit: number, extra: object) => strikesOf([{ t: "use", unit, ability: "attack", target: { side: "enemy", col: 0, row: 0 } }, { t: "hit", unit, target: 3, damage: 9, ...extra }], armed)[0];
    expect(hit(2, { element: "fire" })).toMatchObject({ kind: "melee", element: "fire", charm: true });
    expect(hit(2, { edge: "dark" })).toMatchObject({ kind: "melee", element: "dark", charm: true });
    expect(hit(2, {})).not.toHaveProperty("charm");
    expect(hit(1, { element: "fire" })).toMatchObject({ kind: "spell", element: "fire" });
  });
});

