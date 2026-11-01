// Parts (§14.1): a big enemy's sub-entities on its cells, struck on their own, sharing damage with the
// body, losing the body an ability and staggering it when destroyed, never taking turns.
import { describe, expect, it } from "vitest";
import { createRng } from "../../rng.ts";
import { advance, cannotUse, resolve } from "./combat/battle.ts";
import { newBattle } from "./combat/build.ts";
import { place } from "./combat/encounter.ts";
import { partBox } from "./combat/enemyparts.ts";
import { standardParty } from "./combat/fixtures.ts";
import { choose, decide } from "./combat/gambits.ts";
import { meleeTargets, unitAt, unitsIn } from "./combat/grid.ts";
import { simulate } from "./combat/sim.ts";
import { cellOf } from "./combat/targets.ts";
import type { AbilityDef } from "./combat/types.ts";
import { ENEMY_BY_ID, type EnemyDef } from "./content.ts";

const dz = ENEMY_BY_ID.get("barrow_dragon_zombie")!;
const hit = (power: number): AbilityDef => ({ id: "test_hit", shape: "single", side: "foe", power, accuracy: 999, reach: "ranged" });

function fight() {
  const party = standardParty(1, 18);
  const [body, skull] = place([dz], 6);
  const b = newBattle(1, [...party, body!, skull!]);
  return { b, party, body: body!, skull: skull! };
}

describe("Parts", () => {
  it("sit on their cells of the body as their own combatants with their own HP", () => {
    const { b, body, skull } = fight();
    expect(skull.partOf).toBe(body.id);
    expect([skull.col - body.col, skull.row - body.row]).toEqual([0, 1]);
    expect(skull.maxHp).toBe(Math.round(body.maxHp * 0.2));
    expect(unitAt(b, cellOf(skull))).toBe(skull);
    expect(unitAt(b, { side: "enemy", col: 1, row: skull.row })).toBe(body);
    expect(skull.affinity.holy).toBe(-100);
    expect(partBox({ id: "x", name: "X", cells: [[0, 0], [0, 1]], hp: 0.1 }).size).toEqual([1, 2]);
    expect(() => partBox({ id: "x", name: "X", cells: [[0, 0], [1, 1]], hp: 0.1 })).toThrow();
  });

  it("can be struck in melee alongside the body in the front column, and an area hits each once", () => {
    const { b, party, body, skull } = fight();
    const soldier = party.find((u) => u.col === 0)!;
    soldier.row = skull.row;
    expect(meleeTargets(b, soldier)).toEqual(expect.arrayContaining([body, skull]));
    const all = unitsIn(b, Array.from({ length: 3 }, (_, c) => ({ side: "enemy" as const, col: c, row: skull.row })));
    expect(all).toEqual(expect.arrayContaining([body, skull]));
    expect(all).toHaveLength(2);
  });

  it("pass a share of their damage to the body, and when destroyed take an ability away and stagger the body", () => {
    const { b, party, body, skull } = fight();
    const archer = party.find((u) => u.col === 2)!;
    body.ct = 80;
    const before = body.hp;
    resolve(b, createRng(1), archer, hit(1), cellOf(skull));
    const dealt = skull.maxHp - skull.hp;
    expect(dealt).toBeGreaterThan(0);
    expect(before - body.hp).toBe(Math.round(dealt / 2));
    skull.hp = 1;
    resolve(b, createRng(2), archer, hit(1), cellOf(skull));
    expect(skull.dead).toBe(true);
    expect(body.lost).toContain("rot_breath");
    expect(cannotUse(body, body.abilities.find((a) => a.id === "rot_breath")!)).toBe("part");
    expect(body.ct).toBe(30);
    expect(b.events.some((e) => e.t === "part" && e.part === "rotting_skull")).toBe(true);
    expect(b.outcome).toBeUndefined();
  });

  it("never take turns, die with the body, and do not hold the field once it falls", () => {
    const { b, body, skull } = fight();
    for (const u of b.units) u.ct = 0;
    skull.ct = 500;
    body.ct = 100;
    expect(advance(b, createRng(1))).toBe(body);
    body.hp = 1;
    resolve(b, createRng(1), b.units[2]!, hit(1), cellOf(body));
    expect(body.dead && skull.dead).toBe(true);
    expect(b.outcome).toBe("victory");
  });

  it("are a gambit target and a gambit count", () => {
    const { b, body, skull, party } = fight();
    expect(choose(createRng(1), party[0]!, [body, skull], "part")).toBe(skull);
    const test: EnemyDef = { ...dz, gambits: [{ if: "parts<1", do: "bone_claw" }, { do: "tail_sweep" }] };
    const [body2] = place([test], 6, 300);
    expect(decide({ ...b, units: [...b.units, body2!] }, createRng(1), body2!).action).toMatchObject({ ability: "bone_claw" });
  });

  it("fight to the end in the bots' hands", () => {
    const party = standardParty(3, 18);
    const b = newBattle(3, [...party, ...place([dz], 6)]);
    expect(simulate(b).outcome).toBeDefined();
  });
});
