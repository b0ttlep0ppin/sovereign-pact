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
});
