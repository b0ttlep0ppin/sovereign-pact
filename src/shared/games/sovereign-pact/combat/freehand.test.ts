import { describe, expect, it } from "vitest";
import { ITEM_BASE_BY_ID } from "../content.ts";
import { calm, campaign } from "../testing.ts";
import { TUNING } from "../tuning.ts";
import { abilityOf } from "./battle.ts";
import { scionCombatant } from "./build.ts";
import { baseDamage } from "./damage.ts";

describe("a one-hand weapon with the off hand empty", () => {
  const s = calm(campaign(1, 4));
  const p = s.people.find((x) => x.status === "scion")!;
  const weapon = { kind: "sword", power: 100, acc: 90, crit: 5, reach: "melee", hands: 1 } as const;
  const hit = (extra: object) => {
    const u = { ...scionCombatant(p, { id: 1, col: 0, row: 0, weapon }), ...extra };
    return baseDamage(u, abilityOf(u, "attack")!);
  };

  it(`strikes ${TUNING.combat.freeHandPct}% harder than with a shield or a second blade`, () => {
    const free = hit({});
    expect(free / hit({ offhand: "shield" })).toBeCloseTo(1 + TUNING.combat.freeHandPct / 100);
    expect(free / hit({ offWeapon: weapon })).toBeCloseTo(1 + TUNING.combat.freeHandPct / 100);
    // Two hands on one weapon is not a free hand.
    expect(hit({ weapon: { ...weapon, hands: 2 } })).toBeCloseTo(hit({ offhand: "shield" }));
  });

  it("counts a spear among the one-hand weapons", () => {
    expect(ITEM_BASE_BY_ID.get("spear")?.hands).toBe(1);
  });
});
