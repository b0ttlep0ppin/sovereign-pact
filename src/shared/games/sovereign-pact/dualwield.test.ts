// Dual wield (§13.2): any two one-hand weapons the Job allows, the off hand striking after the
// basic Attack at 50% (80% with Dual Wield Mastery) with its own weapon, both weapons' properties on.
import { describe, expect, it } from "vitest";
import { createRng } from "../../rng.ts";
import { act } from "./combat/battle.ts";
import { enemyCombatant, newBattle, scionCombatant } from "./combat/build.ts";
import { offHandPct } from "./combat/damage.ts";
import { cellOf } from "./combat/targets.ts";
import { promote, rollRecruit } from "./generate.ts";
import { cannotEquip, equip, gearTotals, mint } from "./items.ts";
import type { BASE_JOBS, Person, SovState } from "./state.ts";
import { campaign } from "./testing.ts";

const scion = (s: SovState, job: (typeof BASE_JOBS)[number]): Person => {
  const p = promote(rollRecruit(createRng(s.nextId), s.nextId++, 0), job);
  s.people.push(p);
  return p;
};

describe("dual wield", () => {
  it("pairs any two one-hand weapons the Job allows, never beside a two-hander", () => {
    const s = campaign(1);
    const sol = scion(s, "soldier");
    equip(s, sol, mint(s, "sword", 0), "main");
    expect(cannotEquip(s, sol, mint(s, "axe", 0), "off")).toBeNull();
    expect(cannotEquip(s, sol, mint(s, "greataxe", 0), "off")).toMatch(/slot/);
    const mag = scion(s, "magus");
    equip(s, mag, mint(s, "knife", 0), "main");
    expect(cannotEquip(s, mag, mint(s, "sword", 0), "off")).toMatch(/Job/);
    equip(s, sol, mint(s, "greatsword", 0), "main");
    expect(cannotEquip(s, sol, mint(s, "knife", 0), "off")).toMatch(/two-handed/);
  });

  it("strikes with the off hand after the Attack, at half power", () => {
    const s = campaign(1);
    const sol = scion(s, "soldier");
    equip(s, sol, mint(s, "sword", 0, 2, 3), "main");
    equip(s, sol, mint(s, "knife", 0, 2, 3), "off");
    const gear = gearTotals(s, sol);
    expect(gear.offWeapon?.kind).toBe("knife");
    const u = { ...scionCombatant(sol, { id: 1, col: 0, row: 3, gear }), flags: Array<string>(4).fill("sure_hit") };
    const t = { ...enemyCombatant("barrow_skeleton", { id: 10, level: 3, col: 0, row: 3 }), hp: 9999, maxHp: 9999 };
    const b = newBattle(1, [u, t]);
    b.actor = u.id;
    u.ct = 100;
    act(b, createRng(1), u, { do: "ability", ability: "attack", target: cellOf(t) });
    expect(b.events.filter((e) => e.t === "hit" && e.unit === u.id)).toHaveLength(2);
    expect(u.weapon.kind).toBe("sword");
    expect(offHandPct(u)).toBe(50);
    expect(offHandPct({ ...u, mods: { dualWieldMastery: 1 } })).toBe(80);
  });
});
