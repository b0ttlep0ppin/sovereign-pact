import { describe, expect, it } from "vitest";
import { TUNING } from "../tuning.ts";
import { enemyCombatant, newBattle } from "./build.ts";
import { standardParty, warbandBattle } from "./fixtures.ts";
import { renderGrid, renderLog } from "./render.ts";
import { simulate } from "./sim.ts";

describe("enemy scaling (§14.2)", () => {
  // Power follows the formula (6 + 3L + 0.1L²); the spec's table rounds L5 and L10 differently (DECISIONS).
  it.each([
    [1, 50, 9.1, 70, 10],
    [5, 150, 23.5, 90, 18],
    [10, 300, 46, 115, 28],
  ])("matches the base block at L%i", (L, hp, power, acc, eva) => {
    // The Hollow Soldier's stats are the bruiser's; divide them back out.
    const e = enemyCombatant("barrow_hollow_soldier", { id: 1, level: L, col: 0, row: 0 });
    // The tuning pass's softening of the first levels comes on top of the block.
    const soft = TUNING.enemies.soften[L - 1] ?? 1;
    expect(e.maxHp / 1.6 / soft).toBeCloseTo(hp, -1);
    expect(e.weapon.power).toBeCloseTo(power, 0);
    expect(e.weapon.acc).toBe(acc);
    expect(e.evasion / 0.6).toBeCloseTo(eva, -1);
    // Their damage takes its own softening and the global multiplier instead (Josh: "not threatening enough").
    expect(e.enemyScale).toBeCloseTo(TUNING.enemies.roles.bruiser.atk * (1 + TUNING.combat.enemyLevelFactor * L) * (TUNING.enemies.softenAtk[L - 1] ?? 1) * TUNING.enemies.atkMult);
  });

  it("takes role multipliers when an enemy names no stats of its own", () => {
    const e = enemyCombatant("barrow_skeleton", { id: 1, level: 1, col: 0, row: 0 });
    expect(e.maxHp).toBe(Math.round(52.5 * TUNING.enemies.roles.fodder.hp * TUNING.enemies.soften[0]!));
  });
});

describe("the headless simulator", () => {
  it("replays a battle exactly from its seed", () => {
    const a = warbandBattle(11, 3);
    const b = warbandBattle(11, 3);
    expect(simulate(a)).toEqual(simulate(b));
    expect(a.events).toEqual(b.events);
  });

  it("finishes every battle, and every plan the gambits make is legal", () => {
    for (const fight of ["warband", "battery"] as const) {
      for (let level = 1; level <= 10; level += 3) {
        for (let seed = 1; seed <= 12; seed++) {
          const s = simulate(warbandBattle(seed, level, fight), 2_000, true);
          expect(["victory", "defeat"], `${fight} L${level} seed ${seed}`).toContain(s.outcome);
        }
      }
    }
  });

  it("keeps the low levels near §14.2's target: a sure win for a modest share of HP", () => {
    let wins = 0;
    let hp = 0;
    const runs = 60;
    for (let seed = 1; seed <= runs; seed++) {
      const s = simulate(warbandBattle(seed, 1));
      if (s.outcome === "victory") wins++;
      hp += s.hpLost;
    }
    expect(wins / runs).toBeGreaterThan(0.95);
    expect(hp / runs).toBeLessThan(0.35);
  });

  it("stays JSON: a battle survives a round trip mid-fight", () => {
    const b = warbandBattle(4, 2);
    simulate(b, 10);
    expect(JSON.parse(JSON.stringify(b))).toEqual(b);
  });

  it("draws the grids and writes a log", () => {
    const b = newBattle(1, [...standardParty(1, 3), enemyCombatant("barrow_skeleton", { id: 99, level: 1, col: 0, row: 3 })]);
    expect(renderGrid(b).split("\n")).toHaveLength(9);
    simulate(b);
    expect(renderLog(b)).toMatch(/Battle over: (victory|defeat)/);
  });
});
